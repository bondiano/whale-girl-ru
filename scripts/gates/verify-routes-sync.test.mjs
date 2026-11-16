// Route gate regressions prove duplicated prefixes or missing imports are rejected.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { check } from './verify-routes-sync.mjs'

const ROUTES_SRC = `export const ROUTE_PREFIX = '/whale-girl'
export const STATE_PATH = \`\${ROUTE_PREFIX}/state\`
export const INTERACT_PATH = \`\${ROUTE_PREFIX}/interact\`
export const CONFIG_PATH = \`\${ROUTE_PREFIX}/config\`
export const ASSETS_PATH = \`\${ROUTE_PREFIX}/assets\``

function makeTree({ routes = ROUTES_SRC, client = OK.client, node = OK.node, assets = OK.assets, card = OK.card } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'vrsync-'))
  const mk = (rel, content) => {
    const p = join(root, rel)
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, content)
  }
  mk('src/core/routes.ts', routes)
  mk('src/client/index.ts', client)
  mk('src/client/settings-card.ts', card)
  mk('src/index.ts', node)
  mk('src/core/assets.ts', assets)
  return root
}

const IMPORT = "import { STATE_PATH } from '../src/routes.js'"
const OK = {
  client: `${IMPORT}\nconst x = 1`,
  card: "import { UPDATE_PATH } from '../src/routes.js'\nconst c = 1",
  node: "import { STATE_PATH } from './src/routes.js'\nconst x = 1",
  assets: "import { ASSETS_PATH } from './routes.js'\nconst x = 1",
}

test('接受：三个消费文件都 import 自 routes.js、无字面量', () => {
  const { ok, errors } = check(makeTree(OK))
  assert.equal(ok, true, errors.join('\n'))
})

test('拒绝：client 手写路由字面量（单一来源被破坏）', () => {
  const { ok, errors } = check(makeTree({ client: "const STATE_PATH = '/whale-girl/state'" }))
  assert.equal(ok, false)
  assert.match(errors.join('\n'), /client\/index\.mjs 手写路由前缀字面量/)
})

test('拒绝：index.mjs 未从 routes.js import（端点散落）', () => {
  const { ok, errors } = check(makeTree({ node: "export const STATE_PATH = '/whale-girl/state'" }))
  assert.equal(ok, false)
  assert.match(errors.join('\n'), /index\.mjs 未从 src\/routes\.js import|index\.mjs 手写路由前缀字面量/)
})

test('拒绝：src/routes.js 缺 ROUTE_PREFIX（单一来源缺失）', () => {
  const { ok, errors } = check(makeTree({ routes: 'export const x = 1' }))
  assert.equal(ok, false)
  assert.match(errors.join('\n'), /未定义 ROUTE_PREFIX/)
})
