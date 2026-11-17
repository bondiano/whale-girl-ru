// Enforce resident documentation character budgets deterministically without writes.
// When a budget fails, move or compress material before considering a justified limit change.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = resolve(import.meta.dirname, '../..')

/**
 * Resident-file budgets count characters including newlines.
 * Keep at least 5% headroom; raising a limit requires an independent rationale.
 */
export const BUDGETS = {
  'AGENTS.md': 6000,          // Root resident operating rules.
  'docs/AGENTS.md': 2200,     // Documentation standards.
  'decisions/README.md': 5500, // Decision-record contract.
  'README.md': 19000,         // Russian product entry, including chat and voice documentation; retain at least 5% headroom.
  'README.zh.md': 6500,       // Chinese product entry; retain the established character budget.
}

/** Validate resident-file character budgets and return { ok, errors }. */
export function check(root = ROOT) {
  const errors = []
  for (const [rel, limit] of Object.entries(BUDGETS)) {
    const file = join(root, rel)
    let size
    try {
      size = readFileSync(file, 'utf8').length
    } catch {
      errors.push(`${rel}: 无法读取（文件缺失）`)
      continue
    }
    if (size > limit) {
      errors.push(`${rel}: ${size} 字符 > 上限 ${limit}（超 ${size - limit}——先搬迁/压缩，最后才抬阈值且须独立说明理由）`)
    }
  }
  return { ok: errors.length === 0, errors }
}

// CLI entry point; imports do not execute it.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { ok, errors } = check()
  for (const e of errors) console.error(`[verify-doc-budget] ${e}`)
  if (!ok) {
    console.error(`[verify-doc-budget] ${errors.length} 处违规`)
    process.exit(1)
  }
  console.log('[verify-doc-budget] OK（常驻文件字数在预算内）')
}
