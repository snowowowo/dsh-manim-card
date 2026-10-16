// 本机环境探测的取数：绑定核心包的探测客户端到本插件的路由。
// 解析与请求形状（含「逐项独立、HTTP 失败抛错」的口径）都在核心包 `manim-live`——
// 任何消费者都能用，不必依赖本插件。
import { createMachineClient, type EnvCheck, type EnvPlan, type EnvResult, type EnvStatus } from 'manim-live'
import { ENVIRONMENT_ROUTE } from '../routes.js'

const client = createMachineClient({ environmentUrl: ENVIRONMENT_ROUTE })

/** 取探测计划（秒回：Host 只列要测什么，不跑命令）。 */
export const loadEnvPlan = (): Promise<EnvPlan> => client.loadPlan()

/** 跑一项探测。失败抛错，由调用方把这一行标成出错（别的行不受影响）。 */
export const probeEnv = (id: string): Promise<EnvResult> => client.probe(id)

export type { EnvCheck, EnvPlan, EnvResult, EnvStatus } from 'manim-live'
