// 文案口径的回归网：**代码里取过的键，字典里必须都有；传的参数必须与占位符对得上**。
//
// 为什么需要它：宿主 `locale.bind` 拿不到键时给回来的东西没保证（实测是个空串），
// 于是「漏了一个键」在界面上表现为**那块地方就是空白**——不报错、不进控制台，单测也全绿。
// 真机上刚发生过一次：设置页新加的浏览器运行时卡片引用了二十多个 `rt*` 键，字典里一个都没有，
// 整张卡片的文字全是空的。占位符对不上的两种表现也都见过：文案写了 `{count}` 却没传
// （界面上原样显示 `{count}`）、传了 `count` 而文案写的是 `{n}`（那句话缺一块）。
//
// 取键两路：源码里的 `t('…')` 字面量（覆盖绝大多数），以及阶段表这类**键名写在别处**的
// （`RUNTIME_PHRASE` / `KATEX_PHRASE` 的值就是键名——取的是运行时的真值，不在这儿再抄一遍）。
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DICT } from './i18n'
import { KATEX_PHRASE, RUNTIME_PHRASE } from './runtime-status'

const SRC = join(__dirname, '..')

/** src 下所有参与打包的 .ts / .tsx（测试不算：里面出现的键是替身；声明文件没有代码）。 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    if (!/\.tsx?$/.test(name) || /\.test\./.test(name) || name.endsWith('.d.ts')) return []
    return [path]
  })
}

/** 一次取词：键 + 传进去的参数名（没传对象参数时为 null）。 */
interface Call {
  key: string
  params: Set<string> | null
  file: string
}

/**
 * 参数名（含 `{ a, b }` 这种简写）。逗号要按括号深度切，否则
 * `{ missing: missingLabels(a, b) }` 会被切成两段、把内层标识符当成参数名。
 */
function paramNames(body: string): Set<string> {
  const chunks: string[] = []
  let depth = 0
  let chunk = ''
  for (const char of body) {
    if (char === '(' || char === '[' || char === '{') depth += 1
    else if (char === ')' || char === ']' || char === '}') depth -= 1
    if (char === ',' && depth === 0) {
      chunks.push(chunk)
      chunk = ''
      continue
    }
    chunk += char
  }
  chunks.push(chunk)

  const names = new Set<string>()
  for (const raw of chunks) {
    const text = raw.trim()
    if (text.length === 0) continue
    const keyed = /^([A-Za-z][A-Za-z0-9]*)\s*:/.exec(text)
    if (keyed !== null) {
      names.add(keyed[1])
      continue
    }
    // 简写（`{ count }`）；带展开运算符之类的取不到名字，跳过——宁可漏报，不要误报
    if (/^[A-Za-z][A-Za-z0-9]*$/.test(text)) names.add(text)
  }
  return names
}

/** 一个文件里所有的 `t('key')` / `t('key', { … })`。 */
function callsIn(file: string): Call[] {
  const source = readFileSync(file, 'utf8')
  const out: Call[] = []
  for (const match of source.matchAll(/\bt\('([A-Za-z][A-Za-z0-9]*)'/g)) {
    const key = match[1]
    const rest = source.slice(match.index + match[0].length).replace(/^\s*/, '')
    if (!rest.startsWith(',')) {
      out.push({ key, params: null, file })
      continue
    }
    const body = rest.slice(1).replace(/^\s*/, '')
    if (!body.startsWith('{')) {
      out.push({ key, params: null, file })
      continue
    }
    let depth = 0
    let end = -1
    for (let index = 0; index < body.length; index += 1) {
      if (body[index] === '{') depth += 1
      else if (body[index] === '}') {
        depth -= 1
        if (depth === 0) {
          end = index
          break
        }
      }
    }
    out.push({ key, params: end < 0 ? null : paramNames(body.slice(1, end)), file })
  }
  return out
}

/** 源码里取过的全部键（含两个阶段表的值）。 */
function usedKeys(): Map<string, string> {
  const used = new Map<string, string>()
  for (const file of sourceFiles(SRC)) for (const call of callsIn(file)) used.set(call.key, file)
  for (const key of [...Object.values(RUNTIME_PHRASE), ...Object.values(KATEX_PHRASE)]) used.set(key, 'runtime-status.ts（阶段表）')
  return used
}

const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)\}/g

describe('文案字典', () => {
  it('源码里取过的每一个键，字典里都有', () => {
    const missing = [...usedKeys()]
      .filter(([key]) => DICT.zh[key] === undefined)
      .map(([key, file]) => `${key} ← ${file}`)
    expect(missing).toEqual([])
  })

  it('带参数的取词：传的名字与文案里的占位符对得上', () => {
    const mismatched: string[] = []
    for (const file of sourceFiles(SRC)) {
      for (const call of callsIn(file)) {
        const text = DICT.zh[call.key]
        if (text === undefined || call.params === null) continue
        const wanted = new Set([...text.matchAll(PLACEHOLDER)].map((match) => match[1]))
        for (const name of wanted) if (!call.params.has(name)) mismatched.push(`${call.key}：文案要 {${name}}，调用没传`)
        for (const name of call.params) if (!wanted.has(name)) mismatched.push(`${call.key}：传了 ${name}，文案里没有 {${name}}`)
      }
    }
    expect([...new Set(mismatched)]).toEqual([])
  })
})
