/**
 * 包名归一化。这条口径错了的表现很安静，所以值得单独钉：
 *  - 依赖闭包**漏包**——取 matplotlib 不带 pillow（`depends` 里写 `pillow`，目录里叫 `Pillow`）；
 *  - 用户按自己记得的名字打字（`Pillow` / `scikit_learn`）却被回一句「不认识这个包名」。
 *
 * 用例直接取 lock 里的**真实分歧**，而不是编几个字符串——那份数据就是这条规则存在的理由。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { canonicalPackageName } from './pkg-names.ts'

const LOCK = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'assets', 'pyodide', 'pyodide-lock.json')

describe('canonicalPackageName', () => {
  it('大小写与 [-_.] 都折成同一个形式（PEP 503）', () => {
    for (const spelling of ['pillow', 'Pillow', 'PILLOW', 'PilLow']) {
      expect(canonicalPackageName(spelling), spelling).toBe('pillow')
    }
    expect(canonicalPackageName('MarkupSafe')).toBe('markupsafe')
    expect(canonicalPackageName('astropy_iers_data')).toBe('astropy-iers-data')
    expect(canonicalPackageName('ruamel.yaml')).toBe('ruamel-yaml')
    expect(canonicalPackageName('scikit_learn')).toBe('scikit-learn')
    expect(canonicalPackageName('python_dateutil')).toBe('python-dateutil')
  })

  it('前后空白不算名字的一部分（手输时很容易带上）', () => {
    expect(canonicalPackageName('  scipy\t')).toBe('scipy')
  })

  it('幂等：已经是规范形式的再过一遍不变', () => {
    for (const name of ['pillow', 'astropy-iers-data', 'scikit-learn']) {
      expect(canonicalPackageName(canonicalPackageName(name))).toBe(name)
    }
  })

  it('lock 里键与 name 字段不一致的每一条，归一化后都落到同一个名字上', () => {
    const lock = JSON.parse(readFileSync(LOCK, 'utf8')) as { packages: Record<string, { name: string }> }
    const mismatched = Object.entries(lock.packages).filter(([key, entry]) => entry.name !== key)
    // 这批分歧就是这条规则存在的理由；哪天 lock 把它们统一了，这条用例会在「没有分歧」处提醒我们
    expect(mismatched.length).toBeGreaterThan(0)
    for (const [key, entry] of mismatched) {
      expect(canonicalPackageName(entry.name), `键 ${key} / 字段 ${entry.name}`).toBe(canonicalPackageName(key))
    }
  })

  it('lock 里**每一条依赖引用**归一化后都能落到某个键上——374 条一条不漏', () => {
    // 这是「取一个包要连依赖一起取」能成立的前提：对不上就等于静默漏包。
    // 实测：只按键解析会落空 8 条，只按 name 字段解析会落空 11 条（含 pillow）。
    const lock = JSON.parse(readFileSync(LOCK, 'utf8')) as {
      packages: Record<string, { name: string; file_name: string; depends?: string[] }>
    }
    const keys = new Set(Object.keys(lock.packages).map(canonicalPackageName))
    const unresolved: string[] = []
    let refs = 0
    for (const [key, entry] of Object.entries(lock.packages)) {
      if (!/\.(whl|zip)$/u.test(entry.file_name)) continue
      for (const dependency of entry.depends ?? []) {
        refs += 1
        if (!keys.has(canonicalPackageName(dependency))) unresolved.push(`${key} -> ${dependency}`)
      }
    }
    expect(refs).toBeGreaterThan(300)
    expect(unresolved).toEqual([])
  })
})
