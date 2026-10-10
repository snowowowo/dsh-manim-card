/**
 * Python 侧的 manim 适配层源码。
 * 由运行时注册成 Python 的 `manim` 模块，于是 AI 写的 `from manim import *`
 * 拿到的是它——写法与标准 Manim 一致，真正的对象/动画/渲染都在 JS 侧。
 *
 * 颜色、形状类、动画类、速率名**由 api-map（探针逐项实测 manim-web 的三态表）自动生成**：
 * 覆盖面跟着实测表走，新增支持只需重跑探针，不用手抄别名。
 * 属性读取（`m.width` 这类）与下标取段（`m[i]`）也由支持面表生成（见 surface.ts 的 PROP_READS /
 * INDEX_GETTERS）——那两处踩过「表里说支持、适配层没实现」的坑。
 * 手写的只有：常量/方向、句柄包装、桥转发、Scene 与驱动。
 *
 * 运行在真 CPython（Pyodide）上，所以 numpy 是真的——向量就是 ndarray，运算天然逐元素。
 */
import { PY_ANIMATE_METHODS, PY_API_MAP, PY_COLOR_HEX } from './api-map.generated.ts'
import { ABSTRACT_CLASSES, ANIMATE_REWRITES, INDEX_GETTERS, PROP_READS } from './surface.ts'

/** snake_case → camelCase（manim-web 的方法名是 camel）。 */
const camel = (name: string): string => name.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())

/** 场景基类不是「能 new 的物体」，不能生成成形状别名。 */
const SCENE_CLASSES = new Set([
  'Scene',
  'ThreeDScene',
  'MovingCameraScene',
  'ZoomedScene',
  'LinearTransformationScene',
  'VectorScene',
  'GraphScene',
])

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/


/** 适配层自己定义的名字：生成别名时一律让路，免得被表里的同名项覆盖掉。 */
const RESERVED = new Set([
  'PI', 'TAU', 'DEGREES', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'ORIGIN', 'IN', 'OUT',
  'UL', 'UR', 'DL', 'DR', 'X_AXIS', 'Y_AXIS', 'Z_AXIS',
  'NORMAL', 'BOLD', 'ITALIC', 'OBLIQUE',
  'Mobject', 'Scene', '_Animation', '_wrap', '_tag', '_tag_args', '_tag_kwargs',
  '_animation', '_shape', '_run', '_compile', '_run_source',
  '_stub', '_missing', '_abstract',
])

const usable = (name: string): boolean => IDENTIFIER.test(name) && !RESERVED.has(name)

/** 颜色常量：从探针实测的色值表生成。 */
function colorAliases(): string {
  return Object.entries(PY_COLOR_HEX)
    .filter(([name]) => usable(name))
    .map(([name, hex]) => `${name} = ${JSON.stringify(hex)}`)
    .join('\n')
}

/** 形状类与动画类：从三态表里 state=ok 的项生成。 */
function objectAliases(): string {
  const animations: string[] = []
  const shapes: string[] = []
  for (const [name, entry] of Object.entries(PY_API_MAP)) {
    if (entry.state !== 'ok' || !usable(name)) continue
    // 抽象基类不生成形状别名——它要的是一个「用一下就抛、并说清替代」的存根（见 missingAliases）。
    if (ABSTRACT_CLASSES[name] !== undefined) continue
    if (entry.kind === 'anim') animations.push(`${name} = _animation("${name}")`)
    else if (entry.kind === 'class' && !SCENE_CLASSES.has(name)) shapes.push(`${name} = _shape("${name}")`)
  }
  return `${animations.join('\n')}\n\n${shapes.join('\n')}`
}

/**
 * 场景家族：`ThreeDScene` / `MovingCameraScene` / … 都定义为 Scene 的子类。
 *
 * 探针把它们记成 ok（manim-web 里确实有这些类），但**本实现只有一块画布**——真桥的 create
 * 只对 "Scene" 返回已建好的句柄，其它 kind 会去 new 一个没有容器的场景对象。所以这里统一
 * 继承 Scene、共用同一个句柄；不定义的话 `class X(ThreeDScene)` 直接 NameError
 * （技能把 ThreeDScene 列在可用清单里，模型照写就炸——真机事故）。
 */
function sceneAliases(): string {
  return [...SCENE_CLASSES]
    .filter((name) => name !== 'Scene' && usable(name))
    .map((name) => `class ${name}(Scene):\n    pass`)
    .join('\n\n')
}

/** 缺失项存根：表里 state=missing 的名字生成一个「用一下就抛」的存根，报错带上替代写法。
 *  颜色不在其列——它是**值**不是调用，存根拦不住（用到才炸，且 NameError 里已经有名字）。 */
function missingAliases(): string {
  const stubs = Object.entries(PY_API_MAP)
    .filter(([name, entry]) => entry.state === 'missing' && entry.kind !== 'color' && usable(name))
    .map(([name, entry]) => `${name} = _missing(${JSON.stringify(name)}, ${JSON.stringify(entry.alt ?? '查支持速查表')})`)
  // 抽象基类（表里是 ok）与缺失项共用同一套存根：只说「有这个名字」没用，要说清该换成什么。
  // 措辞不同（「无对应」vs「是抽象基类」）——前者是 manim-web 真没有，后者是有但不能直接构造。
  const abstracts = Object.entries(ABSTRACT_CLASSES).map(
    ([name, alt]) => `${name} = _abstract(${JSON.stringify(name)}, ${JSON.stringify(alt)})`,
  )
  return [...stubs, ...abstracts].join('\n')
}

/** animate 链的方法名映射：探针实测的代理方法（snake → camel）+ 支持面的改写（如 set_value → animateTo）。 */function animateAliases(): string {
  const entries = [
    ...PY_ANIMATE_METHODS.map((name) => [name, camel(name)] as const),
    ...Object.entries(ANIMATE_REWRITES),
  ].map(([from, to]) => `    ${JSON.stringify(from)}: ${JSON.stringify(to)}`)
  return `_ANIMATE_METHODS = {\n${entries.join(',\n')}\n}`
}

/**
 * 速率函数名：由表里 state=ok 的 rate 项生成。
 *
 * 值就是**一个字符串**（CE 侧的名字），不是对象标记——桥的 kwargs 里嵌字典会被 Pyodide 的
 * dict_converter 吞成空对象（实测：`{"__rate": "smooth"}` 过桥变成 `{}`），字符串没这个问题。
 * 校验落在判定里（`planRate` 查表），所以写错名是当场报错，不是静默失效。
 * 表是按**行为**实测的（不是查名字在不在），所以 `wiggle` 这种「导出存在但其实是动画工厂」的
 * 不会被误记成可用。
 */
function rateAliases(): string {
  return Object.entries(PY_API_MAP)
    .filter(([name, entry]) => entry.kind === 'rate' && entry.state === 'ok' && usable(name))
    .map(([name]) => `${name} = ${JSON.stringify(name)}`)
    .join('\n')
}

/**
 * Mobject 上的属性读取与下标取段：都由支持面表生成（PROP_READS / INDEX_GETTERS），
 * 免得在 Python 里另写一份、跟判定漂移。`__getattr__` 对任何名字都返回调用包装，
 * 所以不在这份表里的属性读出来会是个函数——那几个宁可报错（见 planAttrRead）。
 * `__iter__` 靠 `__getitem__` 越界抛 IndexError 收尾，所以越界**绝不能**返回空物体。
 * `__len__` 读 PROP_READS 的 `length`（VGroup / MathTex 有、别的物体没有）——与 `__iter__`
 * 同一件事的另一面，两者一起才是完整的「分组协议」。
 */
function memberSection(): string {
  const props = Object.entries(PROP_READS).map(([name, spec]) => {
    const read =
      spec.method !== undefined
        ? `_wrap(_mb_method(self._h, ${JSON.stringify(spec.method)}, [], {}))`
        // 桥的 getAttr 收 **CE 名**（它自己查 PROP_READS 映射到 fillColor 这类 JS 名）——
        // 传 JS 名会查不到表、误报「不支持读属性」（fill_color / stroke_color 首踩）。
        // 外面统一过一遍 _wrap：多数属性是标量（宽度 / 颜色），但 `target` 读出来是个**物体**
        // （句柄标记），不 wrap 的话拿到的是个 dict，`m.target.shift(...)` 直接
        // "'dict' object has no attribute 'shift'"。
        : `_wrap(_mb_getattr(self._h, ${JSON.stringify(name)}))`
    return `    @property\n    def ${name}(self):\n        return ${read}`
  })
  const getters = INDEX_GETTERS.map((getter) => JSON.stringify(getter)).join(', ')
  const index =
    `    _INDEX_GETTERS = (${getters},)\n\n` +
    '    def __getitem__(self, index):\n' +
    '        """CE 的 m[i] 取子物体：分段物体才有效（MathTex 是 getPart、VGroup 是 get）。\n\n' +
    '        取不到必须抛 IndexError——**迭代协议就靠它收尾**。以前取不到只是把 None / 句柄\n' +
    '        原样返回，于是 `for m in group` 永远取得到「下一个」，越取越多直到把内存吃满卡死\n' +
    '        （真机事故，回归网见 syntax 组的 group-iteration 语料）。真桥那边越界返回 undefined，\n' +
    '        过桥就是 None——所以 None 必须当「这个取值器不认」，而不是当子物体。\n' +
    '        """\n' +
    '        last = None\n' +
    '        for getter in self._INDEX_GETTERS:\n' +
    '            try:\n' +
    '                value = _mb_method(self._h, getter, [index], {})\n' +
    '            except Exception as error:\n' +
    '                last = error\n' +
    '                continue\n' +
    '            if value is not None:\n' +
    '                return _wrap(value)\n' +
    '        raise IndexError("m[%r] 取不到子物体（只对分段物体有效：VGroup / MathTex）：%s" % (index, last))\n\n' +
    '    def __iter__(self):\n' +
    '        index = 0\n' +
    '        while True:\n' +
    '            try:\n' +
    '                yield self[index]\n' +
    '            except IndexError:\n' +
    '                return\n' +
    '            index += 1\n\n' +
    '    def __len__(self):\n' +
    '        """CE 的 len(group) / len(mathtex)：子物体个数（manim-web 的 VGroup.length）。\n\n' +
    '        int() 不能省——JS 数字过桥是 Python float，而 __len__ 必须给 int（float 会被 Python 拒）。\n' +
    '        非分组物体读 length 得到 None，int(None) 抛 TypeError——与 CE「Circle 没有 len()」同类；\n' +
    '        预检/记录桥对登记过子物体数的组同判（三处口径一致，见 PROP_READS.length）。\n' +
    '        """\n' +
    '        return int(self.length)'
  return `${props.join('\n\n')}\n\n${index}`
}

const SHIM_BASE = `"""manim 适配层：标准 Manim 写法 → JS 桥（_mb_*）。"""

import ast as _ast
import inspect as _inspect
import numpy as _np
# 回调要**返回真数组**时用（向量场的 func）：Python list 过桥是个代理对象，manim-web 解构不了。
# 与桥引导里的 to_js 是同一个（那处已在 __main__ 里导入过，pyodide.ffi 必然可用）。
from pyodide.ffi import to_js as _to_js

# CE 的 from manim import * 会带出 np（实测 manim 模块上确有 np 属性）——照 CE 补一个公开名。
# 不补的话，「照 numpy 文档写 np.sin / np.linspace」在用户代码里就是 NameError；
# 更阴的是写在 lambda 里时**不报错**（函数没被调用），等真跑起来才炸。
np = _np

PI = 3.141592653589793
TAU = 6.283185307179586
DEGREES = 0.017453292519943295

# CE 的文字字重 / 字形常量（Text(weight=BOLD, slant=ITALIC) 这类写法要用）。
NORMAL = "normal"
BOLD = "bold"
ITALIC = "italic"
OBLIQUE = "oblique"

# 方向就是 numpy 向量：UP * 0.2、RIGHT * 2、UP + RIGHT 这类逐元素运算在 Manim 里到处都是。
UP = _np.array([0.0, 1.0, 0.0])
DOWN = _np.array([0.0, -1.0, 0.0])
LEFT = _np.array([-1.0, 0.0, 0.0])
RIGHT = _np.array([1.0, 0.0, 0.0])
ORIGIN = _np.array([0.0, 0.0, 0.0])
UL = _np.array([-1.0, 1.0, 0.0])
UR = _np.array([1.0, 1.0, 0.0])
DL = _np.array([-1.0, -1.0, 0.0])
DR = _np.array([1.0, -1.0, 0.0])
OUT = _np.array([0.0, 0.0, 1.0])
IN = _np.array([0.0, 0.0, -1.0])

# 轴向常量：CE 里 X_AXIS/Y_AXIS/Z_AXIS 就是 RIGHT/UP/OUT，Axes 相关代码常直接拿它当方向用。
# ⚠️ 这几个名字要同步登记在 probe-api.mjs 的 ADAPTER_CONSTANTS 里（否则表会把它记成缺失）。
X_AXIS = RIGHT
Y_AXIS = UP
Z_AXIS = OUT


def _is_number(value):
    return isinstance(value, (int, float, _np.integer, _np.floating)) and not isinstance(value, bool)


def _wrap(result):
    """桥的返回值归一：带 __handle 的字典是 manim 对象；数值数组（坐标/向量）换成向量。

    坐标类方法（c2p / get_center / get_bounding_box…）返回的是数值数组。必须换成向量，
    否则 ax.c2p(...) + vec(...) 会走 list.__add__ 把两个坐标**拼接**成一个长列表——
    静默算错，最难查。
    """
    if isinstance(result, dict) and "__handle" in result:
        return Mobject(result["__handle"])
    if isinstance(result, list) and result and all(_is_number(v) for v in result):
        return _np.array(result, dtype=float)
    return result


def _tag(value):
    """参数交给桥前的归一：Mobject → 句柄标记；向量 → 普通 list；numpy 标量 → Python 标量。

    桥只能理解 JS 值，而 to_js 不认识 ndarray，所以在这里就把它降成 list。

    **list / tuple / dict 要递归下去**：Mobject 装在容器里过桥时，不递归就只是「一个 Python
    对象的代理」，桥既认不出它是物体（不是 {"__handle": n}），也拿不到方法。踩过的：
    Table 的单元格与 col_labels 就是这么变成空壳的，报错是 manim-web 自己抛的
    getThreeObject is not a function——完全看不出根因。
    """
    if isinstance(value, Mobject):
        return {"__handle": value._h}
    if isinstance(value, _Animation):
        return value._to_spec()
    if isinstance(value, (list, tuple)):
        return [_tag(item) for item in value]
    if isinstance(value, dict):
        return dict((key, _tag(item)) for key, item in value.items())
    if isinstance(value, _np.ndarray):
        return value.tolist()
    if isinstance(value, _np.generic):
        return value.item()
    return value


def _tag_args(args):
    return [_tag(value) for value in args]


def _tag_kwargs(kwargs):
    return dict((key, _tag(value)) for key, value in kwargs.items())


# updater 包装表：句柄 -> {id(原函数): 包装后的双参函数}。
# 按句柄存而不是挂在 Mobject 实例上——桥每返回一次句柄就新建一个包装实例，
# 同一物体可能有多个实例（m.shift() 也会回新实例），挂在实例上会丢。
# 每次跑用户源码前清空（见 _run_source）：句柄号每轮从 1 重新计，残留会串味。
_UPDATER_WRAPPERS = {}


def _updater_arity(func):
    """判断 updater 收几个位置参数；判不出来按 2 算（宁可多传一个也别少传）。"""
    try:
        params = list(_inspect.signature(func).parameters.values())
    except (TypeError, ValueError):
        return 2
    kinds = [_inspect.Parameter.POSITIONAL_ONLY, _inspect.Parameter.POSITIONAL_OR_KEYWORD]
    if any(p.kind is _inspect.Parameter.VAR_POSITIONAL for p in params):
        return 2
    return len([p for p in params if p.kind in kinds])


def _register_updater(handle, func):
    """把 updater 包成 manim-web 要的双参形式，并让它看到的是 **Python 包装**而不是裸 JS 对象。

    两件事都得在这儿做完：

    ① **参数个数**：manim-web 固定按 updater(mobject, dt) 调（Mobject.update 里就是 t(this, dt)），
       而模型按 CE 习惯常写单参 lambda m: ...——单参直接抛
       "takes 1 positional argument but 2 were given"。
    ② **第一个参数是什么**：manim-web 传的是它自己的 JS 对象，上面只有 camelCase 方法，
       m.move_to(...) / m.set_value(...) 这些 CE 名一律 AttributeError。
       所以闭包里换成当次登记的句柄包出来的 Mobject——反正被更新的就是它自己。

    ①只踩到「报错」；②踩到的是「页面一直转」：这个错抛在**渲染循环里**，manim-web 捕获后
    停掉循环，play 的 promise 就永远不 resolve，卡片一直「渲染中」。现象是「跑得特别久」，
    根因却是参数个数与参数类型。
    """
    target = Mobject(handle)
    if _updater_arity(func) == 1:
        wrapped = lambda _mobject, dt: func(target)
    else:
        wrapped = lambda _mobject, dt: func(target, dt)
    _UPDATER_WRAPPERS.setdefault(handle, {})[id(func)] = wrapped
    return wrapped


def _forget_updater(handle, func):
    """取下包装并返回（remove_updater 必须拿到当初传给 manim-web 的那一个才算数）。"""
    return _UPDATER_WRAPPERS.get(handle, {}).pop(id(func), func)


class Mobject(object):
    """manim 对象句柄的 Python 包装：方法一律转发给桥，按需换回新对象。

    加减乘按 Manim 语义实现成「复制后位移/缩放」——mob.get_center() + UP * 2、
    mob + RIGHT 这类写法在 Manim 代码里很常见，返回新对象、不改原对象。
    """

    def __init__(self, handle=None):
        # 无参 = 建一个空的 manim-web Mobject。标准 Manim 里 Mobject() 很常见
        # （没有内容、只用来挂 updater 当动画驱动器），所以不能因为「句柄包装类」就拒收无参。
        self._h = _mb_create("Mobject", [], {}) if handle is None else handle

    def __getattr__(self, name):
        # m.animate.<方法>(...) 是一条独立的动画写法，不能当普通方法转发（否则
        # 拿到的是个 Python 函数，再取 .shift 就是 'function' object has no attribute）。
        if name == "animate":
            return _AnimateChain(self._h, [])
        if name.startswith("_"):
            raise AttributeError(name)

        def call(*args, **kwargs):
            return _wrap(_mb_method(self._h, name, _tag_args(args), _tag_kwargs(kwargs)))

        return call

    def _copy_moved(self, method, amount):
        moved = self.copy()
        getattr(moved, method)(amount)
        return moved

    def __add__(self, other):
        return self._copy_moved("shift", other)

    def __radd__(self, other):
        return self._copy_moved("shift", other)

    def __sub__(self, other):
        return self._copy_moved("shift", -other)

    def __mul__(self, factor):
        return self._copy_moved("scale", factor)

    def __rmul__(self, factor):
        return self._copy_moved("scale", factor)

    def __neg__(self):
        return self._copy_moved("scale", -1)

    def add_updater(self, update_function, index=None, call_updater=True):
        """挂更新器。这些必须是**真方法**（不能靠 __getattr__ 转发）：单参 updater 要在这里包成双参。

        CE 的 call_updater 对应 manim-web 的 callOnAdd；CE 的 index（插到第几个）没有对应物，忽略。
        """
        wrapped = _register_updater(self._h, update_function)
        _mb_method(self._h, "add_updater", [wrapped], {"callOnAdd": True} if call_updater else {})
        return self

    def remove_updater(self, update_function):
        _mb_method(self._h, "remove_updater", [_forget_updater(self._h, update_function)], {})
        return self

    def clear_updaters(self):
        _mb_method(self._h, "clear_updaters", [], {})
        _UPDATER_WRAPPERS.pop(self._h, None)
        return self

    def get_parts(self):
        """CE 的 MathTex.get_parts()：把分段列成一个列表。

        manim-web 没有「一次取完所有段」的方法（它的 getParts 挂在单段 MathTexPart 上，
        不在 MathTex 本体上），所以按段迭代出来——分段协议（__getitem__ / __len__）本来就是
        「取第 i 段 + 有几段」这两件事。非分段物体在这里会抛 TypeError / IndexError，与 CE 同类。
        """
        return [self[index] for index in range(len(self))]

    # __GENERATED_MEMBERS__


class _Animation(object):
    """动画描述：不在 Python 侧建对象，只记下 kind / 目标参数 / 选项，交给 scene.play。

    选项在这里就 _tag_kwargs：FadeIn(c, shift=UP) 的 UP 是 ndarray，不降成 list 的话
    to_js 认不出来，真桥拿到的是个空壳（typia 报「$input.shift 类型不对」）。
    """

    def __init__(self, kind, targets, kwargs):
        self._spec = {"kind": kind, "targets": targets, "kwargs": _tag_kwargs(kwargs)}

    def _to_spec(self):
        return self._spec


def _as_target(value):
    """动画位置参数归一：嵌套动画取它的 spec，Mobject 取**句柄标记**，其余原样。

    句柄必须带 {"__handle": n} 标记，不能用裸号码——Rotate(c, PI) 里 PI 也是数字，
    桥分不清哪个是对象，只好一律去查句柄表，于是报「未知的对象句柄 3.14159」。
    取 spec 走 _to_spec() 而不是 _spec：_AnimateChain 没有 _spec，只有 _to_spec()。
    """
    if isinstance(value, _Animation):
        return value._to_spec()
    if isinstance(value, Mobject):
        return {"__handle": value._h}
    return _tag(value)


class _AnimateChain(_Animation):
    """m.animate.<方法>(...) 的链：攒下连续调用，交给 scene.play 播。

    manim-web 的 animate 代理只在 _ANIMATE_METHODS 这组方法上可用（写死的 builder，不转发）；
    支持面里记了改写的（ValueTracker 的 set_value → animateTo）先用改写名；都没有的当场报错并
    列出可用方法，别让它静默失效。链式调用返回新对象、不动原对象——与 manim-web 的 builder 写法一致。
    """

    def __init__(self, handle, calls):
        self._handle = handle
        self._calls = calls

    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(name)
        if name not in _ANIMATE_METHODS:
            raise AttributeError(
                "animate 链不支持 %s()——只支持：%s；改属性可直接调同名方法，再用 play(Transform(...)) 补动画"
                % (name, " / ".join(sorted(_ANIMATE_METHODS)))
            )

        def chain(*args, **kwargs):
            return _AnimateChain(self._handle, self._calls + [(name, _tag_args(args), _tag_kwargs(kwargs))])

        return chain

    def _to_spec(self):
        # 方法名在这里就换成 manim-web 的 camelCase：桥拿到的 animate 动作是可直接取属性的名字。
        return {
            "kind": "animate",
            "targets": [{"__handle": self._handle}],
            "kwargs": {},
            "calls": [
                {"name": _ANIMATE_METHODS[name], "args": args, "kwargs": kwargs}
                for name, args, kwargs in self._calls
            ],
        }


# 这些动画收「一组动画」而不是单个目标：AnimationGroup([Create(a), FadeIn(b)])
_GROUP_ANIMATIONS = ("AnimationGroup", "LaggedStart", "Succession")

# 这些动画的第一参是「数字物体」、第二参是回调：CE 的 ChangingDecimal(decimal, f(t))。
_CHANGING_DECIMAL = "ChangingDecimal"


def _changing_decimal(targets, kwargs):
    """CE ChangingDecimal(decimal, f)：每帧把显示的数字设成 f(t)。

    manim-web 的 changingDecimal 只收 { startValue, endValue }（线性），表达不了任意 f(t)；
    但它的 updateFromAlphaFunc(mob, (mob, alpha) => …) 正好是「每帧按进度调一次回调」——
    语义与 CE 一致，所以落到它上面。回调里用 Python 句柄改数字（与 updater 同一套办法），
    manim-web 传进来的它自己那个对象忽略掉即可。
    """
    if len(targets) < 2:
        raise TypeError("ChangingDecimal 要两个参数：数字物体与回调 f(t) -> 数")
    decimal, func = targets[0], targets[1]
    if not isinstance(decimal, Mobject) or not callable(func):
        raise TypeError(
            "ChangingDecimal(decimal, f) 的第一参要是 DecimalNumber / Integer，第二参要是回调函数"
        )
    wrapped = lambda _mobject, alpha: decimal.set_value(func(alpha))
    return _Animation("UpdateFromAlphaFunc", [{"__handle": decimal._h}, wrapped], kwargs)


# 这些动画的第一参是**动画类**而不是物体：LaggedStartMap(FadeIn, group)。
# 类没法过桥（Python 函数对象过不去），所以把它的 CE 名取出来当标记，由桥换回 manim-web 的类。
_MAP_ANIMATIONS = ("LaggedStartMap",)


def _map_animation(kind, targets, kwargs):
    """LaggedStartMap(FadeIn, group)：把动画类折成名字标记，把组折成它的**子物体数组**。

    manim-web 的 laggedStartMap(animClass, mobjects, options) 要一个数组——
    而 CE 习惯传一个 VGroup。传 VGroup 进去它内部按数组用，拿不到子物体；所以在这里就展开成
    「每个子物体的句柄」的列表（迭代走 __getitem__，非分组物体会抛 IndexError，报错能看懂）。
    """
    anim = targets[0] if len(targets) > 0 else None
    name = getattr(anim, "_ce_name", None)
    if name is None:
        raise TypeError(
            "%s 的第一参要是动画类（如 FadeIn / Create / GrowFromCenter），收到 %s"
            % (kind, type(anim).__name__)
        )
    group = targets[1] if len(targets) > 1 else None
    if not isinstance(group, Mobject):
        raise TypeError("%s 的第二参要是物体（通常是一个 VGroup）" % kind)
    return _Animation(kind, [{"__animClass": name}, [{"__handle": child._h} for child in group]], kwargs)

# 这些动画收一个**回调函数**，而 manim-web 回调时塞给它的第一个参数是它自己的 JS 对象：
#   UpdateFromFunc / UpdateFromAlphaFunc 的 interpolate(alpha) 里就是 this._func(this.mobject, alpha)
# （见 manim-web 的 animation/UpdateFromFunc.ts；两者签名都是 func(mobject, alpha)）。
# 那个对象上只有 camelCase 方法，模型按 CE 习惯写的 lambda m, a: m.set_opacity(...) 直接
# AttributeError——与 add_updater 是**同一个坑的另一个入口**，而且同样抛在渲染循环里：
# manim-web 捕获后停掉循环，play 的 promise 永不 resolve，卡片一直「渲染中」（真机现象：
# 「点了没反应 / 一直转」，日志里只有一句 headless render loop error ... AttributeError: set_opacity）。
_FUNC_ANIMATIONS = ("UpdateFromFunc", "UpdateFromAlphaFunc")


def _wrap_func_animation(kind, targets):
    """把这类动画里的回调换成「第一个参数已包装」的版本——回调里还是拿得到 CE 方法名。

    与 _register_updater 同一套办法：闭包里换成本次动画目标（第一个位置参数）的 Mobject 包装，
    manim-web 传什么进来都不管。参数个数按回调自己的签名定：CE 里 UpdateFromFunc 的回调习惯写
    单参 lambda m: ...，而 manim-web 固定按 (mobject, alpha) 调——不按签名裁一刀就是
    "takes 1 positional argument but 2 were given"。
    """
    if kind not in _FUNC_ANIMATIONS or len(targets) < 2:
        return targets
    target, func = targets[0], targets[1]
    if not isinstance(target, Mobject) or not callable(func):
        return targets
    proxy = Mobject(target._h)
    if _updater_arity(func) == 1:
        wrapped = lambda _mobject, _alpha: func(proxy)
    else:
        wrapped = lambda _mobject, alpha: func(proxy, alpha)
    return (target, wrapped) + tuple(targets[2:])


def _animation(kind):
    def make(*targets, **kwargs):
        # 第一参是动画类的那几支（LaggedStartMap）：先单独处理，别按普通目标展开。
        if kind in _MAP_ANIMATIONS:
            return _map_animation(kind, targets, kwargs)
        # ChangingDecimal 的 f(t) 没法照原样过桥，改落到 updateFromAlphaFunc 上。
        if kind == _CHANGING_DECIMAL:
            return _changing_decimal(targets, kwargs)
        # 多参动画的标准写法：Transform(a, b)、Rotate(m, angle)；各组动画还可直接收一个列表
        if kind in _GROUP_ANIMATIONS and len(targets) == 1 and isinstance(targets[0], (list, tuple)):
            targets = tuple(targets[0])
        # 组动画的位置参数是「一串动画」，用 __animations 标记——不能靠「是不是数组」区分，
        # 因为普通参数里也有数组（GrowFromEdge(c, LEFT) 的方向就是）。
        if kind in _GROUP_ANIMATIONS:
            return _Animation(kind, [{"__animations": [_as_target(t) for t in targets]}], kwargs)
        targets = _wrap_func_animation(kind, targets)
        return _Animation(kind, [_as_target(t) for t in targets], kwargs)

    # 记下 CE 名：LaggedStartMap(FadeIn, …) 要按名字把类找回来（类本身过不桥）。
    make._ce_name = kind
    return make


# 这三支收一个**向量函数**：CE 的 func(p) 收一个点、返回向量；manim-web 的 func(x, y) 收两个数、
# 返回一个**真数组**（Python list 过桥是个代理对象，manim-web 解构不了——它要 [vx, vy]）。
_VECTOR_FIELD_KINDS = ("VectorField", "ArrowVectorField", "StreamLines")


def _vector_field(kind, args, kwargs):
    func = kwargs.get("func", args[0] if len(args) > 0 else None)
    if not callable(func):
        raise TypeError("%s 要一个函数：收一个点（或 x, y）、返回一个向量" % kind)
    rest = dict(kwargs)
    rest.pop("func", None)
    # 回调收几个参数就给它几个（CE 习惯收一个点，也有人写 (x, y)）。
    if _updater_arity(func) <= 1:
        wrapped = lambda x, y: _to_js(func(_np.array([x, y, 0.0])))
    else:
        wrapped = lambda x, y: _to_js(func(x, y))
    returned = _mb_create(kind, _tag_args(args[1:] if len(args) > 0 else ()), _tag_kwargs(dict(rest, func=wrapped)))
    return Mobject(returned)


def _shape(kind):
    def make(*args, **kwargs):
        if kind in _VECTOR_FIELD_KINDS:
            return _vector_field(kind, args, kwargs)
        return Mobject(_mb_create(kind, _tag_args(args), _tag_kwargs(kwargs)))

    return make


def _stub(message):
    """造一个「用一下即抛」的存根**类**（不是函数——当基类用时函数会抛
    「function() argument 'code' must be code」，看不出根因）。"""
    class _Stub(object):
        def __init__(self, *args, **kwargs):
            raise NotImplementedError(message)

        def __init_subclass__(cls, **kwargs):
            raise NotImplementedError(message)

    return _Stub


def _missing(name, alt):
    """表里实测缺失的写法：用一下即抛，报错里带上替代。

    不生成存根的话只会得到一句 NameError（只有名字、没有改法）——模型知道名字不对，
    却不知道该换成什么（技能承诺「带行号与提示」，这里才真的兑现）。
    存根与判定同源（都从三态表的 alt 生成），不会各说各话。颜色不在其列（它是值、不是调用）。
    """
    return _stub("%s 在 manim-web 无对应——%s" % (name, alt))


def _abstract(name, alt):
    """抽象基类：名字在 manim-web 里**有**，但构造即抛内部错误（用户完全看不懂）——
    换成「用一下即抛、并说清该用哪个具体类」的存根。"""
    return _stub("%s 是抽象基类、不能直接构造——%s" % (name, alt))


async def _flush_after(value):
    """MathTex/Tex 构造后等渲染：排版是异步的，渲染完之前宽度是 0，随后的
    to_edge / next_to 会按 0 宽定位错（角落标签被顶出画面）。由 _AwaitTransform
    在 construct 里对这些类的构造调用自动补 await，手写代码不用管。"""
    await _mb_flush()
    return value


# 用户源码 exec 在独立名字空间里，取不到本模块的名字——与 _mb_* 同理挂进 builtins。
import builtins as _bi
_bi._flush_after = _flush_after


def _checked_mobjects(where, values):
    """物体参数校验：非物体当场说清。**返回校验过的物体本身**——怎么编码（裸句柄号 / 句柄标记）
    由调用方定，因为两条通道要的不一样（见 add / remove）。

    动画在适配层只是一份**描述**（_Animation），根本没有 manim-web 句柄；原样过桥会变成
    「未知的对象句柄 <manim._Animation object at 0x...>」这种没人看得懂的报错。所以在这里拦下：
    报错发生在纯 Python 里，预检（Host 侧的干跑）也能拦到，模型拿到的是能照着改的话。
    """
    for value in values:
        if not isinstance(value, Mobject):
            hint = "——动画请用 self.play(...)" if isinstance(value, _Animation) else ""
            raise TypeError("%s 只接受物体（Mobject），收到 %s%s" % (where, type(value).__name__, hint))
    return values


class Scene(object):
    """场景：一块已建好的 manim-web 画布的句柄 + add / remove / play / wait。

    play / wait 是 async——CPython 里没法在同步函数中途让出控制权去等渲染完成，
    所以由 _compile 把 construct 与其中的调用改写成 async / await（见下）。
    """

    def __init__(self):
        self._h = _mb_create("Scene", [], {})

    def add(self, *mobjects):
        # add 走桥的**专用入口**（Scene.add(...mobjects)，收裸句柄号）。
        _mb_add(self._h, [value._h for value in _checked_mobjects("add", mobjects)])

    def remove(self, *mobjects):
        # remove 没有专用入口，走**通用 method 通道**——那条通道只认 {"__handle": n} 标记。
        # 直接传裸句柄号的话，桥把它当成一个普通整数原样转给 manim-web 的 scene.remove()，
        # 于是「不报错、也没删掉」（语料 scene/02-remove 的物体一直留在画面上就是这个）。
        _mb_method(self._h, "remove", _tag_args(_checked_mobjects("remove", mobjects)), {})

    def clear(self):
        """清空场景（CE 的 self.clear()）——移掉画布上所有物体。"""
        _mb_method(self._h, "clear", [], {})

    async def play(self, *animations, **kwargs):
        for animation in animations:
            if not isinstance(animation, _Animation):
                raise TypeError("play 只接受动画对象，例如 Create(circle)、Transform(a, b)")
        # CE 的 Wait(run_time) 是「什么都不做的动画」；manim-web 的 wait 是**场景方法**
        # （wait(mobject, duration) 还要一个物体挂靠）——在这里把它从 play 里摘出来，
        # 直接落到场景的 wait 上，别拿它去构造一个 manim-web 里不存在的动画。
        remains = []
        for animation in animations:
            spec = animation._to_spec()
            if spec["kind"] == "Wait":
                duration = spec["kwargs"].get("run_time", spec["targets"][0] if spec["targets"] else 1.0)
                await _mb_wait(self._h, duration)
            else:
                remains.append(animation)
        if remains:
            await _mb_play(self._h, [a._to_spec() for a in remains], kwargs)

    async def wait(self, duration=1.0):
        await _mb_wait(self._h, duration)


async def _run(namespace):
    """驱动：在传入的名字空间里找 Scene 子类，实例化并 await 它的 construct。

    要排掉**适配层自己的场景家族**（ThreeDScene / MovingCameraScene … 会随 star-import 一起进
    用户名字空间，且排在用户类前面）——按定义处认：本模块定义的类 __module__ 就是本模块名，
    用户类是 "__main__"。
    """
    for value in namespace.values():
        if not isinstance(value, type) or value is Scene or not issubclass(value, Scene):
            continue
        if getattr(value, "__module__", None) == __name__:
            continue
        await value().construct()
        return
    raise ValueError("没有找到 Scene 子类：请写 class 你的类名(Scene): 的 construct(self) 方法")


# play / wait 需要 await 才能等到渲染完成。这个改写必须做在**语法树**上，不能拿正则凑：
# 要精确识别「construct 里的表达式语句且被调方法是 play/wait」，还要只作用于 construct。
_AWAIT_METHODS = ("play", "wait")

# 排版异步的类：construct 里对这些类的构造调用自动包一层 await _flush_after(...)，
# 让随后的 to_edge / next_to / move_to 测到渲染后的真实宽度（缺了这步，角落标签会超界）。
_FLUSH_AFTER_CTORS = ("MathTex", "Tex", "SingleStringMathTex", "Variable")


def _to_async(node):
    """def construct → async def construct，其余字段原样保留。"""
    converted = _ast.AsyncFunctionDef(
        name=node.name,
        args=node.args,
        body=node.body,
        decorator_list=node.decorator_list,
        returns=node.returns,
        type_comment=getattr(node, "type_comment", None),
        type_params=getattr(node, "type_params", []),
    )
    return _ast.copy_location(converted, node)


class _AwaitTransform(_ast.NodeTransformer):
    def __init__(self):
        _ast.NodeTransformer.__init__(self)
        self._in_construct = False

    def _visit_function(self, node):
        previous = self._in_construct
        self._in_construct = node.name == "construct"
        node = self.generic_visit(node)
        self._in_construct = previous
        if node.name == "construct" and isinstance(node, _ast.FunctionDef):
            node = _to_async(node)
        return node

    visit_FunctionDef = _visit_function
    visit_AsyncFunctionDef = _visit_function

    def visit_Expr(self, node):
        node = self.generic_visit(node)
        if not self._in_construct:
            return node
        call = node.value
        if (
            isinstance(call, _ast.Call)
            and isinstance(call.func, _ast.Attribute)
            and call.func.attr in _AWAIT_METHODS
        ):
            return _ast.Expr(value=_ast.Await(value=call))
        return node

    def visit_Call(self, node):
        node = self.generic_visit(node)
        if not self._in_construct:
            return node
        if isinstance(node.func, _ast.Name) and node.func.id in _FLUSH_AFTER_CTORS:
            wrapped = _ast.Call(
                func=_ast.Name(id="_flush_after", ctx=_ast.Load()),
                args=[node],
                keywords=[],
            )
            return _ast.copy_location(_ast.Await(value=wrapped), node)
        return node


def _compile(source, filename):
    """把用户源码编译成 code——先做 async 改写，行号保持与原文一致（报错行号才对得上）。"""
    tree = _ast.parse(source, filename)
    tree = _AwaitTransform().visit(tree)
    _ast.fix_missing_locations(tree)
    return compile(tree, filename, "exec")


def _exec_source(source):
    """只编译执行、不驱动场景（纯 Python 片段用）。"""
    _UPDATER_WRAPPERS.clear()
    namespace = {"__name__": "__main__"}
    exec(_compile(source, "<manim>"), namespace)


async def _run_source(source):
    """跑一份用户源码：在独立名字空间里 exec，然后驱动其中的 Scene 子类。"""
    _UPDATER_WRAPPERS.clear()
    namespace = {"__name__": "__main__"}
    exec(_compile(source, "<manim>"), namespace)
    await _run(namespace)


# ===== 以下由 api-map.generated.ts（探针实测）生成，勿手改：重跑探针即更新 =====

`

/** Python 适配层模块的完整源码。手写部分里的 __GENERATED_MEMBERS__ 换成表生成的属性/下标。 */
export const MANIM_SHIM_SOURCE = `${SHIM_BASE.replace('    # __GENERATED_MEMBERS__\n', `${memberSection()}\n`)}${
  animateAliases()
}\n\n${rateAliases()}\n\n${colorAliases()}\n\n${objectAliases()}\n\n${sceneAliases()}\n\n${missingAliases()}\n`