// Keep route constants in one authoritative core routes module.
// Reject handwritten route-prefix literals or missing route imports in the client,
// settings card, server entry, and asset handler. Read-only and deterministic.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = resolve(import.meta.dirname, '../..')
// Match the routes module name independently of its relative import path.
const IMPORT_RE = /from\s+['"][^'"]*routes\.js['"]/

/** Extract ROUTE_PREFIX from its source; return null when absent. */
function readPrefix(routesSrc) {
  const m = /ROUTE_PREFIX\s*=\s*['"]([^'"]+)['"]/.exec(routesSrc)
  return m === null ? null : m[1]
}

/** Validate the single route source and return { ok, errors }. */
export function check(root = ROOT) {
  const errors = []
  const consumers = [
    { file: 'src/client/index.ts', label: 'client/index.mjs' },
    { file: 'src/client/settings-card.ts', label: 'client/settings-card.mjs' },
    { file: 'src/index.ts', label: 'index.mjs' },
    { file: 'src/core/assets.ts', label: 'src/assets.mjs' },
  ]
  const routesSrc = readFileSync(join(root, 'src', 'core', 'routes.ts'), 'utf8')
  const prefix = readPrefix(routesSrc)
  if (prefix === null) {
    errors.push('src/core/routes.ts 未定义 ROUTE_PREFIX（路由单一来源缺失）')
    return { ok: false, errors }
  }
  // Route-prefix literals belong only in the authoritative routes module.
  const literalRe = new RegExp(`['"]${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
  for (const { file, label } of consumers) {
    const src = readFileSync(join(root, file), 'utf8')
    if (literalRe.test(src)) {
      errors.push(`${label} 手写路由前缀字面量（须从 src/routes.mjs import 端点常量）`)
    }
    if (!IMPORT_RE.test(src)) {
      errors.push(`${label} 未从 src/routes.mjs import 端点常量（路由端点须单一来源）`)
    }
  }
  return { ok: errors.length === 0, errors }
}

// CLI entry point; imports do not execute it.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { ok, errors } = check()
  for (const e of errors) console.error(`[verify-routes-sync] ${e}`)
  if (!ok) {
    console.error(`[verify-routes-sync] ${errors.length} 处违规`)
    process.exit(1)
  }
  console.log('[verify-routes-sync] OK（路由端点单一来源 src/routes.mjs，消费文件无字面量）')
}
