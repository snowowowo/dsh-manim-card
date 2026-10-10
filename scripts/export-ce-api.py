#!/usr/bin/env python3
"""域清单导出：把 Manim CE 的公开 API 枚举成探针的输入（scripts/ce-public-api.json）。

CE 是**构建期依赖**（隔离环境 + 钉版本，见 scripts/probe-requirements.txt）。装它只为这一件事：
枚举「模型会写的名字」，让域跟着 CE 版本走，而不是跟着我们记得的清单走。

分组口径——**只有边界清楚的才自动枚举**：

    classes        ← manim.mobject.* + manim.scene.* 的类
    animations     ← manim.animation.* 的类
    functions      ← manim.animation.* 的函数（always_redraw 这类 updater 助手）
    colors         ← manim 里的 ManimColor 实例
    rates          ← manim.utils.rate_functions 里定义的函数
    constants      ← 方向（值为 ndarray 的名字）+ 数学常量（CE 没有类型标记，按名字固定取 3 个）
    mobjectMethods ← **人工**（沿用 official-api-seed.json）

方法域为什么不自动枚举：CE 的 Mobject 继承体系有 240+ 个公开方法，大半是内部工具
（add_cubic_bezier_curve / align_points_with_larger / gen_subpaths_from_points_2d …），
没有能把「模型会写的」切出来的命名空间边界。自动枚举会把三态表灌满噪声，alt 替代文案也没法给准，
得不偿失——所以这一组仍由人维护（见设计 §4.5 的「人工残留」）。

输出是**随仓提交的生成物**：重跑探针只需要它，不必装 CE；只有「重新生成域清单」才需要 CE。
用法：.venv-probe/bin/python scripts/export-ce-api.py
"""

from __future__ import annotations

import inspect
import json
import platform
import sys
from pathlib import Path

import manim

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "scripts" / "official-api-seed.json"
OUT = ROOT / "scripts" / "ce-public-api.json"

# 数学常量：CE 里它们和 DEFAULT_* 一样是普通 float，没有类型可分辨，只能按名字取。
MATH_CONSTANTS = ("PI", "TAU", "DEGREES")

CLASS_MODULES = ("manim.mobject.", "manim.scene.")
ANIM_MODULES = ("manim.animation.",)
RATE_MODULE = "manim.utils.rate_functions"

COLOR_TYPE = "ManimColor"


def public_names() -> list[str]:
    """manim 的公开名：无前导下划线。"""
    return [name for name in dir(manim) if not name.startswith("_")]


def module_of(value: object) -> str:
    return getattr(value, "__module__", "") or ""


# 适配层自己造的写法，不是 CE 的方法：indexing 是 m[i] 取段（见 manim-shim.ts）。
SYNTHETIC_METHODS = {"indexing"}


def phantom_methods(seed_methods: dict[str, list[str]], names: list[str], values: dict) -> list[str]:
    """种子里的方法名必须在 CE 里真实存在——手维护的清单会漂移（put_start_and_end 就是幽灵名）。

    判据放宽到「任一公开类的属性」：只查 Mobject 会误伤 Axes.plot / MathTex.get_part_by_tex 这类。
    幽灵名会让三态表为一个**不存在的写法**出结论，比漏收录更糟，所以这里必须报出来。
    """
    classes = [values[name] for name in names if inspect.isclass(values[name])]
    return sorted(
        {
            method
            for methods in seed_methods.values()
            for method in methods
            if method not in SYNTHETIC_METHODS and not any(hasattr(cls, method) for cls in classes)
        }
    )


def main() -> int:
    names = public_names()
    values = {name: getattr(manim, name, None) for name in names}

    classes = sorted(
        name
        for name in names
        if inspect.isclass(values[name]) and module_of(values[name]).startswith(CLASS_MODULES)
    )
    animations = sorted(
        name
        for name in names
        if inspect.isclass(values[name]) and module_of(values[name]).startswith(ANIM_MODULES)
    )
    functions = sorted(
        name
        for name in names
        if inspect.isfunction(values[name]) and module_of(values[name]).startswith(ANIM_MODULES)
    )
    colors = sorted(name for name in names if type(values[name]).__name__ == COLOR_TYPE)
    # 速率函数：只取定义在 rate_functions 模块里的（排除 typing / functools 的导入物）
    rates = sorted(
        name
        for name in names
        if inspect.isfunction(values[name]) and module_of(values[name]) == RATE_MODULE
    )
    # 方向常量：CE 用 ndarray 表示方向（UP/DOWN/LEFT/…/X_AXIS）
    direction = sorted(name for name in names if type(values[name]).__name__ == "ndarray")
    math_constants = sorted(name for name in MATH_CONSTANTS if name in values)

    # 方法清单：人工维护那一组，直接沿用
    seed = json.loads(SEED.read_text(encoding="utf-8"))
    mobject_methods = seed["mobjectMethods"]
    phantom = phantom_methods(mobject_methods, names, values)
    if phantom:
        print(
            f"⚠️  种子方法清单有 {len(phantom)} 个名字在 CE {getattr(manim, '__version__', '?')} 里不存在："
            f"{', '.join(phantom)}\n"
            "    它们会让三态表为一个不存在的写法出结论——请从 official-api-seed.json 里清掉"
            "（确实要兼容旧写法就留在这里并注明）。",
            file=sys.stderr,
        )

    payload = {
        "_comment": (
            "Manim CE 的公开域名清单，由 scripts/export-ce-api.py 生成（勿手改）。"
            "probe-api.mjs 逐项实测 manim-web，产出 src/core/py/api-map.generated.ts。"
        ),
        "_source": {
            "package": "manim",
            "version": getattr(manim, "__version__", "unknown"),
            "python": platform.python_version(),
            "generatedBy": "scripts/export-ce-api.py",
        },
        "classes": classes,
        "animations": animations,
        "functions": functions,
        "constants": {"direction": direction, "math": math_constants},
        "colors": colors,
        "rates": rates,
        "mobjectMethods": mobject_methods,
        # 人工清单里对不上 CE 的名字（对照 _source.version 看）：留档以便清理，见 phantom_methods 的说明
        "_phantomMethods": phantom,
    }

    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"域清单完成：{OUT.relative_to(ROOT)}（manim {payload['_source']['version']}，"
        f"共 {len(classes)} 类 / {len(animations)} 动画 / {len(functions)} 函数 / "
        f"{len(colors)} 色 / {len(rates)} 速率 / {len(direction) + len(math_constants)} 常量 / "
        f"方法 {sum(len(v) for v in mobject_methods.values())} 名）"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
