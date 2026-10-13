// Pyodide 包缓存：清单、预缓存、清缓存——设置页与实验场共用这一层。
//
// 本层只剩「把核心包的包管理客户端绑到本插件的路由上」：解析 / 依赖闭包 / 补全 /
// 取数全在核心包 `manim-live`（任何消费 Pyodide 运行时的插件都能用，黑板不必依赖本插件）。
// 函数名与搬迁前一致，调用方（设置页 / 实验场）零改动。
import {
  createPackagesClient,
  type PackageInventory,
  type PackagesClient,
} from 'manim-live'
import { CACHE_ROUTE, PACKAGES_ROUTE } from '../routes.js'

const client: PackagesClient = createPackagesClient({
  packagesUrl: PACKAGES_ROUTE,
  cacheUrl: CACHE_ROUTE,
})

export const loadPackages = (): Promise<PackageInventory> => client.loadPackages()
export const cachePackage = (name: string) => client.cachePackage(name)
export const clearPackageCache = () => client.clearPackageCache()
export const clearPackage = (name: string) => client.clearPackage(name)

export {
  findPackage,
  completionFor,
  prefetchPlan,
  formatBytes,
  COMMON_PACKAGES,
} from 'manim-live'
export type {
  PackageEntry,
  PackageInventory,
  PackageState,
  PrefetchOutcome,
  Completion,
} from 'manim-live'
