/**
 * 本机环境探测的取数：先拿计划，再**一项一项问**。
 *
 * 为什么不是一次问完：`manim --version` 要 import 整个 Manim，本机上可能十几秒。
 * 一次问完等于让整页等最慢的那一项；逐项问则是逐行亮起来，快的先看到，
 * 慢的/坏的只影响它自己那一行。
 */
import { ENVIRONMENT_ROUTE } from '../routes.js'

const ENV_URL = ENVIRONMENT_ROUTE

/** 一项探测的元信息（Host 只说「测什么、跑哪条命令」，文案在界面这一侧）。 */
export interface EnvCheck {
  id: string
  /** 要在 PATH 里找的可执行文件名。 */
  tool: string
  /** 会跑的命令，原样显示给用户看（「到底测了什么」不该是个谜）。 */
  command: string
}

export interface EnvPlan {
  platform: string
  arch: string
  node: string
  /** Host 实际用来找命令的 PATH（含它补上的常见安装目录）。 */
  path: string
  checks: EnvCheck[]
}

export type EnvStatus = 'ok' | 'missing' | 'error'

export interface EnvResult {
  id: string
  status: EnvStatus
  /** 找到的可执行文件绝对路径；没找到时是 null。 */
  path: string | null
  /** 版本行（status 为 ok 时才有）。 */
  version: string
  /** 没装 / 出错时的说明。 */
  detail: string
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** 探测计划；形状不对回 null（调用方据此报错）。 */
export function parsePlan(payload: unknown): EnvPlan | null {
  if (payload === null || typeof payload !== 'object') return null
  const value = payload as Record<string, unknown>
  if (!Array.isArray(value.checks)) return null
  const checks = value.checks
    .filter((raw): raw is Record<string, unknown> => raw !== null && typeof raw === 'object')
    .map((raw) => ({ id: text(raw.id), tool: text(raw.tool), command: text(raw.command) }))
    .filter((check) => check.id.length > 0)
  if (checks.length === 0) return null
  return {
    platform: text(value.platform),
    arch: text(value.arch),
    node: text(value.node),
    path: text(value.path),
    checks,
  }
}

/** 单项探测结果；形状不对回 null。 */
export function parseResult(payload: unknown): EnvResult | null {
  if (payload === null || typeof payload !== 'object') return null
  const value = payload as Record<string, unknown>
  const status = value.status
  if (status !== 'ok' && status !== 'missing' && status !== 'error') return null
  const id = text(value.id)
  if (id.length === 0) return null
  return {
    id,
    status,
    path: typeof value.path === 'string' ? value.path : null,
    version: text(value.version),
    detail: text(value.detail),
  }
}

/** 取探测计划（秒回：Host 只列要测什么，不跑命令）。 */
export async function loadEnvPlan(): Promise<EnvPlan> {
  const response = await fetch(ENV_URL)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const plan = parsePlan(await response.json())
  if (plan === null) throw new Error('探测计划形状不对')
  return plan
}

/** 跑一项探测。失败抛错，由调用方把这一行标成出错（别的行不受影响）。 */
export async function probeEnv(id: string): Promise<EnvResult> {
  const response = await fetch(`${ENV_URL}/${encodeURIComponent(id)}`)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const result = parseResult(await response.json())
  if (result === null) throw new Error('探测结果形状不对')
  return result
}
