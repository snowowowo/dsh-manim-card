/**
 * 子路径记账的自检与治疗——修上游 morph 留下的一类「坏物体」。
 *
 * 背景（manim-web 的数据模型）：每个 VMobject 有两套「子路径长度」——
 * `_baseSubpathLengths`（物体自己的结构，读 `getSubpathLengths()`）与
 * `_transformSubpathLengths`（morph 期间被改写成**目标**那套，读 `getTransformSubpathLengths()`）；
 * 真正生效的是 `getEffectiveSubpathLengths()` = 后者 ?? 前者（两套都没有就返回 undefined，
 * 上游退回 `alignPoints` 逐点重采样兜底）。
 *
 * 事故：morph 收尾时未必把点数摆回与记账同一套。两边一旦对不上，上游 `alignVmobjectPair`
 * 的第一道对账就会抛，而这个物体之后再被 morph 就一路炸：
 *   `alignVmobjectPair(source): subpath lengths sum (74) does not match point count (72)`
 * 实测（真浏览器 + 真 WebGL + 真 KaTeX）最小复现是**同一个 MathTex 连续 morph 两次**：
 *   `self.play(Transform(n4, n8)); self.play(Transform(n4, n20))`
 * 第二段一进去就抛。首次复现来自一张「黎曼和逼近」的卡（同样的 `Transform(n4, n8)` 之后
 * 紧跟 `Transform(n4, n20)`），界面上的表现是「第一段动画放完了，第二段报错」。
 *
 * 为什么不能只躲不治：坏物体还留在场景里，渲染时算「子路径朝向」用的是同一份记账，同样会抛。
 * 所以两手都要：**跑之前查**（对不上就别 morph，退回交叉淡入淡出），**跑完治**（清掉对不上的记账）。
 *
 * 为什么必须走进子物：按子物配对的 morph 是**逐子物递归对齐**的。顶层 VGroup 自己往往压根没有记账
 * （探测只看到 undefined），坏的是它内部的字形子物——只在顶层查会一路放行，进去之后才炸。
 * 真机上就是这么被骗过去的。
 */

/** 记账相关的读写口（manim-web 的 VMobject 公开方法，名字未经压缩）。 */
export interface SubpathBookkeeping {
  getLocalPoints?: () => unknown[]
  getEffectiveSubpathLengths?: () => readonly number[] | undefined
  getSubpathLengths?: () => readonly number[] | undefined
  setTransformSubpathLengths?: (value: readonly number[] | undefined) => void
  setBaseSubpathLengths?: (value: readonly number[] | undefined) => void
  children?: readonly unknown[]
}

/** 往子物里走的深度上限：字形树也就两三层，超过这个数的多半是环或异常结构。 */
const MAX_DEPTH = 8

/** 这一个物体的子路径记账与点数是否自洽（压根没有记账也算自洽——上游会走 `alignPoints`）。 */
export function subpathsConsistent(mobject: unknown): boolean {
  // 自己守门，不指望调用方：`view?.getX()` 只护属性不护基对象，`null.getX` 照样抛。
  if (mobject === null || typeof mobject !== 'object') return true
  const view = mobject as SubpathBookkeeping
  const lengths = view.getEffectiveSubpathLengths?.()
  if (lengths === undefined || lengths.length === 0) return true
  const points = view.getLocalPoints?.()
  if (points === undefined) return true
  let sum = 0
  for (const length of lengths) sum += length
  return sum === points.length
}

/**
 * 遍历一棵物体树（含子物）。
 * @returns `visit` 是否曾返回 true（true 即提前收工）。
 */
function walk(mobject: unknown, visit: (candidate: unknown) => boolean, depth: number): boolean {
  if (depth > MAX_DEPTH || mobject === null || typeof mobject !== 'object') return false
  if (visit(mobject)) return true
  const children = (mobject as SubpathBookkeeping).children
  if (!Array.isArray(children)) return false
  for (const child of children) {
    if (walk(child, visit, depth + 1)) return true
  }
  return false
}

/** 这一棵物体树（含子物）的记账是否都自洽——morph 前的准入判据。 */
export function subpathTreeConsistent(mobject: unknown): boolean {
  return !walk(mobject, (candidate) => !subpathsConsistent(candidate), 0)
}

/**
 * 治好一棵树上「记账与点数对不上」的节点：先退回物体自己的基准记账；基准也对不上就两套都清空
 * （上游于是走 `alignPoints` 兜底——几何仍在，只是不再假装知道子路径怎么分）。
 *
 * @returns 是否真的改过（调用方据此补一帧渲染）。
 */
export function healSubpathBookkeeping(mobject: unknown): boolean {
  let healed = false
  walk(mobject, (candidate) => {
    if (subpathsConsistent(candidate)) return false
    const view = candidate as SubpathBookkeeping
    try {
      // 先试「退回物体自己的基准记账」——多数情况这就够了，还保住了子路径怎么分。
      view.setTransformSubpathLengths?.(view.getSubpathLengths?.())
      if (!subpathsConsistent(candidate)) {
        // 基准也对不上（点集早被 morph 换成另一套了）：**两套一起清**。
        // 只清基准是不够的——生效值是「transform ?? base」，transform 那套还挂着照样对不上。
        view.setTransformSubpathLengths?.(undefined)
        view.setBaseSubpathLengths?.(undefined)
      }
      healed = true
    } catch {
      // 治不动别把一次 play 弄挂：morph 前那道 `subpathTreeConsistent` 仍然拦得住。
    }
    return false
  }, 0)
  return healed
}
