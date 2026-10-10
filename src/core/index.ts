// Host 侧门面：core.js 的入口（tsdown 第二产物，ESM / node）。源码两端共用同一份。
// 全部能力都在 py/：Pyodide 运行时（真 CPython + 真 numpy）+ manim 适配层
// + 支持面（surface：哪些写法被支持）+ 桥（真桥接 manim-web，dry-run 桥供 Host 预检）。
export {
  runPython,
  toPyRuntimeError,
  setPyodideLoader,
  PyRuntimeError,
  type RunOptions,
  type PyodideLoader,
  type PyodideRuntime,
} from './py/runtime.ts'
export {
  createRecordingBridge,
  HANDLE_KEY,
  GROUP_KEY,
  ANIMATE_KIND,
  type AnimationTarget,
  type ManimBridge,
  type RecordingBridge,
  type BridgeOp,
  type AnimationSpec,
} from './py/bridge.ts'
export {
  planCreate,
  planAnimation,
  planAnimationOptions,
  planPlayOptions,
  planAttrRead,
  planMethod,
  planAnimate,
  camel,
  camelKeys,
  PROP_READS,
  INDEX_GETTERS,
  PY_API_MAP,
  PY_COLOR_HEX,
  PY_ANIMATE_METHODS,
  type AnimationPlan,
  type MethodCall,
  type MethodPlan,
  type PlayPlan,
  type RatePlan,
  type PyApiEntry,
} from './py/surface.ts'
export { createDryRunBridge } from './py/dry-run-bridge.ts'
export { canonicalPackageName } from './py/pkg-names.ts'
export {
  createManimWebBridge,
  type ManimNamespace,
  type ManimWebBridgeOptions,
} from './py/manim-bridge.ts'
export { CORPUS_ROUTE, SHOTS_ROUTE } from './routes.ts'