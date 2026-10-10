/**
 * 卡片的产品规则，都是纯判定，直接钉在这儿：
 *
 * 1. 自动播**每张卡只发生一次**，而且只发生在「刚生成出来的那张」上（老会话回填的卡一律落末帧）；
 * 2. 「用掉就不补」：只播了一半被打断也算播过（`spent` 由 effect 在**决定那一刻**记上，
 *    不是等画布立起来才记——否则同一张卡会因为「进视口后多快滚出去」而有两种待遇）；
 * 3. 被中断的调用不自动渲染（`interrupted` 的判定在 definition.ts，用法在 card.tsx）。
 *
 * 为什么值得单独测：这几条的错法都很安静——多播一次只是"烦"，不播一次则像"坏了"，
 * 而且界面上一眼看不出来是哪一条错了。规则抽成纯函数（decidePlay）就是为了能这样钉。
 */
import { describe, expect, it } from 'vitest'
import { decidePlay } from './card'

/** 默认一格：刚出炉的卡、这一页还没用掉这张卡的自动播机会、不是手动重播、也不是批量极速。 */
const input = (over: Partial<Parameters<typeof decidePlay>[0]> = {}) => ({
  live: true,
  spent: false,
  manual: false,
  fast: false,
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
    for (const state of [{ spent: true }, { live: false }, { fast: true }]) {
      expect(decidePlay(input({ ...state, manual: true })), JSON.stringify(state)).toBe(true)
    }
  })

  it('实验场「全部渲染」的极速档不播动画（否则一套上百条要跑几分钟）', () => {
    expect(decidePlay(input({ fast: true }))).toBe(false)
  })
})
