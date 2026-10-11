/**
 * 卡片的产品规则，都是纯判定，直接钉在这儿：
 *
 * 1. 自动播**每张卡只发生一次**，而且只发生在「刚生成出来的那张」上（老会话回填的卡一律落末帧）；
 * 2. 「用掉就不补」：只播了一半被打断也算播过（`spent` 由 effect 在**决定那一刻**记上，
 *    不是等画布立起来才记——否则同一张卡会因为「进视口后多快滚出去」而有两种待遇）；
 * 3. **同一个 step 里并行发的几张只由最后那张真播**（`batchTail` 由调度器判，见 render-queue）；
 * 4. 用户按下的那两个键**压过上面全部自动规则**：手动播放一定真播、⏩ 一定不演；
 * 5. 被中断的调用不自动渲染（`interrupted` 的判定在 definition.ts，用法在 card.tsx）。
 *
 * 为什么值得单独测：这几条的错法都很安静——多播一次只是"烦"，不播一次则像"坏了"，
 * 而且界面上一眼看不出来是哪一条错了。规则收成一个纯函数（decidePlay）就是为了能这样钉。
 */
import { describe, expect, it } from 'vitest'
import { decidePlay } from './card'

/** 默认一格：刚出炉的卡、这一页还没用掉这张卡的自动播机会、本批由它当代表、也没人按按钮。 */
const input = (over: Partial<Parameters<typeof decidePlay>[0]> = {}) => ({
  live: true,
  spent: false,
  manual: false,
  fast: false,
  skip: false,
  batchTail: true,
  ...over,
})

describe('decidePlay：什么时候放动画', () => {
  it('刚出炉的卡第一次进视口——播一次', () => {
    expect(decidePlay(input())).toBe(true)
  })

  it('同一张卡再进视口（滚回来 / 重挂）——落末帧，不重播', () => {
    expect(decidePlay(input({ spent: true }))).toBe(false)
  })

  it('老会话回填的卡（不是刚出炉）——落末帧', () => {
    expect(decidePlay(input({ live: false }))).toBe(false)
  })

  it('老会话的卡无论进多少次都落末帧（spent 与否都一样）', () => {
    for (const state of [{ spent: false }, { spent: true }]) {
      expect(decidePlay(input({ live: false, ...state })), JSON.stringify(state)).toBe(false)
    }
  })

  it('手动重播：永远真播——播过的、老会话的、甚至批量极速的那张，都放', () => {
    for (const state of [{ spent: true }, { live: false }, { fast: true }, { batchTail: false }]) {
      expect(decidePlay(input({ ...state, manual: true })), JSON.stringify(state)).toBe(true)
    }
  })

  it('按了 ⏩：不演，直接落终态——包括本来该播的那张', () => {
    expect(decidePlay(input({ skip: true }))).toBe(false)
    // ⏩ 也压过手动：两种模式共用一个键，按第二下就是从「真播中」跳到终态
    expect(decidePlay(input({ skip: true, manual: true }))).toBe(false)
  })

  it('实验场的极速档不播动画（等真实 run_time / wait 太慢）', () => {
    expect(decidePlay(input({ fast: true }))).toBe(false)
  })
})

describe('decidePlay：同一批只由代表真播', () => {
  it('不是本批代表 —— 自动那趟直接落终态（一个 step 里只演一段）', () => {
    expect(decidePlay(input({ batchTail: false }))).toBe(false)
  })

  it('兄弟卡缺席时它就是代表 —— 照常播（不能因为「这批发过几张」就整批不播）', () => {
    expect(decidePlay(input({ batchTail: true }))).toBe(true)
  })

  it('批次规则只管自动那趟，管不着用户按的键', () => {
    // 这条是回归线：早先的实现把 batchTail 并在「自动规则之后、手动之前」，
    // 于是在非代表那张上按「手动播放」只会跳到终态 —— 按了个寂寞。
    expect(decidePlay(input({ batchTail: false, manual: true }))).toBe(true)
    expect(decidePlay(input({ batchTail: false, skip: true }))).toBe(false)
  })
})
