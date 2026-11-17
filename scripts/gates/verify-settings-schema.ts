// Validate configuration schema declarations deterministically without writes.
// Numeric fields need min/max bounds; all checked fields need defaults.
// Ledger semantics such as XP, levels, titles, and retention limits cannot become settings.
// This heuristic gate complements the host's final Schemastery validation.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = resolve(import.meta.dirname, '../..')

/** Semantic ledger field names are forbidden on the configuration surface. */
export const SEMANTIC_KEYS = new Set([
  'xp', 'taskXp', 'sessionXp', 'resumeXp', 'level', 'titles', 'title',
  'memoryMax', 'activeCap', 'xpCap', 'xpSafeMax',
])

/**
 * Check numeric/boolean schema declarations for field names, bounds, and defaults.
 * Return { ok, errors }.
 */
export function check(root = ROOT) {
  const errors = []
  const src = readFileSync(join(root, 'src', 'core', 'config.ts'), 'utf8')

  // Extract declarations inside buildSchema.
  const fnMatch = /export function buildSchema\(\) \{([\s\S]*?)\n\}/.exec(src)
  if (fnMatch === null) {
    return { ok: false, errors: ['src/config.mjs 未找到 buildSchema 函数'] }
  }
  const body = fnMatch[1]

  // Read field chains such as key: z.number().min(...).max(...).default(...).
  const fieldRe = /([a-zA-Z][a-zA-Z0-9]*):\s*z\.(number|boolean)\(\)(\.min\([^)]*\))?(\.max\([^)]*\))?(\.default\([^)]*\))?/g
  let m
  let found = 0
  while ((m = fieldRe.exec(body)) !== null) {
    found++
    const [full, key, type, min, max, def] = m
    if (SEMANTIC_KEYS.has(key)) {
      errors.push(`buildSchema.${key}: 字段名落入语义层黑名单（${[...SEMANTIC_KEYS].join('/')}——配置面不得承载积累语义）`)
    }
    if (type === 'number') {
      if (min === undefined) errors.push(`buildSchema.${key}: 数值字段缺 min（未 clamp 下限）`)
      if (max === undefined) errors.push(`buildSchema.${key}: 数值字段缺 max（未 clamp 上限）`)
    }
    if (def === undefined) errors.push(`buildSchema.${key}: 缺默认值（default(...)）`)
  }
  if (found === 0) {
    errors.push('buildSchema 内未扫描到任何 z.number/z.boolean 字段声明（schema 可能未用 schemastery 或结构异常）')
  }
  return { ok: errors.length === 0, errors }
}

// CLI entry point; imports do not execute it.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { ok, errors } = check()
  for (const e of errors) console.error(`[verify-settings-schema] ${e}`)
  if (!ok) {
    console.error(`[verify-settings-schema] ${errors.length} 处违规`)
    process.exit(1)
  }
  console.log('[verify-settings-schema] OK（配置 schema 声明合法：字段 clamp + 默认值 + 无语义层泄漏）')
}
