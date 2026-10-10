// Host 侧入口：只 re-export src/host/index.js，让入口路径与目录布局解耦。
export { name, inject, apply } from './src/host/index.js'
