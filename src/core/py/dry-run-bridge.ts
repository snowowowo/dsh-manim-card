/**
 * 预检用桥：跑一遍代码但不建任何真对象——Host 在工具返回前用它「干跑」一次，
 * 语法错、未定义名、manim-web 实测缺失的能力、构造参数写错，都能在模型看到结果之前回给它。
 *
 * 为什么不直接用真桥：真桥要 manim-web 与 WebGL，Host 是 Node 且不该为此背上 5MB 依赖。
 *
 * 判定的口径**不在本文件**——全部问 `surface.ts`（支持面 SSOT），与真桥取同一份，
 * 所以同一段代码两端**同判**：预检放行的，真桥不会当场拒；预检拒的，真桥也拒。
 */
import { ANIMATE_KIND, HANDLE_KEY, type AnimationSpec, type ManimBridge } from './bridge.ts'
import {
  METHOD_RETURNS,
  planAnimate,
  planAnimation,
  planAttrRead,
  planCreate,
  planMethod,
  planPlayOptions,
} from './surface.ts'

export function createDryRunBridge(): ManimBridge {
  let nextHandle = 1
  const fake = (): { [HANDLE_KEY]: number } => ({ [HANDLE_KEY]: nextHandle++ })
  /**
   * 组类句柄的子物体个数（VGroup 的位置参数就是子物体）。
   *
   * 为什么要记：真桥的 `m[i]` 越界返回 undefined（过桥是 None），适配层据此抛 IndexError，
   * `for m in group` 才收得了尾。预检桥若对任何下标都返句柄，那段代码在预检里会**永远取下去**
   * 直到把 Host 的内存吃满——用户写一个再普通不过的 `for m in group:` 就能把工具调用挂死。
   */
  const sizes = new Map<number, number>()

  return {
    create(kind, args, kwargs) {
      // 名字缺失、位置参数与构造规则对不上，都在这里当场拒——和真桥同一份判定
      planCreate(kind, args, kwargs)
      const handle = nextHandle++
      if (kind === 'VGroup') sizes.set(handle, args.length)
      return handle
    },
    method(handle, name, args, kwargs) {
      planMethod(name, args, kwargs)
      // 取下标越界 → 与真桥同判「取不到」（见上面 sizes 的注释）；不越界照旧返占位句柄。
      // 注意：只在**登记过大小的组**上判——别的种类的子物体数这里并不建模，保持原行为不动。
      if ((name === 'get' || name === 'getPart') && sizes.has(handle)) {
        const index = args[0]
        if (typeof index === 'number' && Number.isInteger(index) && index >= sizes.get(handle)!) {
          return undefined
        }
      }
      // 取「值」的方法按真桥的形状返占位：坐标类是数值数组、数值类是数。
      // 一律返句柄的话，`(ax.c2p(a) + ax.c2p(b)) / 2`、`tracker.get_value() ** 2`
      // 这类**合法算术**会被判成 Mobject 运算错误（真机事故，见 METHOD_RETURNS 的注释）。
      const shaped = METHOD_RETURNS[name]
      if (shaped === 'vector') return [0, 0, 0]
      if (shaped === 'number') return 0
      return fake()
    },
    getAttr(handle, name) {
      planAttrRead(name)
      // 与真桥同判：登记过子物体数的组，length 报真实个数（`len(group)` 才对得上）。
      // 别的种类不建模，返占位——适配层 int(占位) 抛 TypeError，与真桥读不到 length 同类。
      if (name === 'length' && sizes.has(handle)) return sizes.get(handle)
      return fake()
    },
    add() {},
    async play(_handle, animations: AnimationSpec[], kwargs) {
      // play 级选项也要判——不然 rate_func 写错名会过预检、到真桥才炸（正是 SSOT 要消灭的那类）
      planPlayOptions(kwargs)
      for (const animation of animations) {
        if (animation.kind === ANIMATE_KIND) planAnimate(animation.calls ?? [])
        else planAnimation(animation.kind, animation.targets, animation.kwargs)
      }
    },
    async wait() {},
    async flush() {},
  }
}
