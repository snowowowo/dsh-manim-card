// 冒烟③：手动输入那条路——取一个不在常用清单里、且带依赖的包。
// 跑法：node _tmp-smoke-manual.mjs （验完即删）
import { createServer } from 'node:http'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { packagesRoute, resolveCacheDir } from './src/host/pyodide.js'

const cacheDir = resolveCacheDir({ get: () => undefined })
const route = packagesRoute(cacheDir)
const server = createServer((request, response) => route.handler(request, response))
await new Promise((done) => server.listen(0, '127.0.0.1', done))
const base = `http://127.0.0.1:${server.address().port}/dsh-plugins/manim-renderer/packages`

const inventory = async () => (await fetch(base)).json()
const post = async (names) => {
  const response = await fetch(`${base}/cache`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ names }),
  })
  return response.json()
}

const before = await inventory()
const byName = new Map(before.entries.map((entry) => [entry.name, entry]))

// 常用清单（与 src/client/packages.ts 的 COMMON_PACKAGES 一致）
const COMMON = ['numpy', 'sympy', 'matplotlib', 'pandas', 'scipy', 'scikit-learn', 'statsmodels', 'networkx', 'pillow', 'opencv-python']
console.log('常用清单里各包的状态：')
for (const name of COMMON) {
  const entry = byName.get(name)
  console.log(`  ${name.padEnd(16)} ${entry ? entry.state.padEnd(8) + (entry.bytes === null ? '' : String(entry.bytes) + ' 字节') : '不在清单里！'}`)
}

// 手动输入那条路：挑一个不在常用清单里、带依赖、还没在本地的小包
const target = ['python-dateutil', 'six'].map((name) => byName.get(name)).find((entry) => entry?.state === 'absent')
if (target === undefined) {
  console.log('\npython-dateutil / six 都已在本地，手动那条路这回被跳过了（界面会说「已经在本机了」）')
} else {
  console.log(`\n手动目标：${target.name}（不在常用清单里）`)
  const result = await post([target.name])
  console.log(`  取回：${JSON.stringify(result.results)}`)
  console.log(`  落地：${existsSync(join(cacheDir, target.fileName))}  ${existsSync(join(cacheDir, target.fileName)) ? statSync(join(cacheDir, target.fileName)).size + ' 字节' : ''}`)
  // 依赖是否也被一起取（客户端会按依赖闭包逐个发请求；这里核它的依赖当前状态）
  for (const dep of target.depends) {
    const now = (await inventory()).entries.find((entry) => entry.name === dep)
    console.log(`  依赖 ${dep.padEnd(16)} -> ${now ? now.state : '（不在清单里）'}`)
  }
}

// 手动输入一个不存在的名字：Host 的说法（界面另有一层「不认识这个包名」的本地判定）
console.log(`\n不存在的名字：${JSON.stringify((await post(['seaborn'])).results)}`)

server.close()
