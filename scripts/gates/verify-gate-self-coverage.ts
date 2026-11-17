// Require a corresponding regression test for every implemented gate in run.ts.
// A test glob alone cannot detect a missing test file. Test-group entries are exempt.
// This check is read-only and deterministic.
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = resolve(import.meta.dirname, '../..')
// These registry entries are test groups, without a gate implementation or matching self-test.
const TEST_GROUPS = new Set(['unit-tests', 'tool-tests', 'gate-self-tests'])

/** Extract gate names from run.ts without importing or executing it. */
export function parseGateNames(runSrc) {
  return [...runSrc.matchAll(/name:\s*'([a-z-]+)'/g)].map((m) => m[1])
}

/** Verify that every implemented gate has a regression test; return { ok, errors }. */
export function check(root = ROOT) {
  const errors = []
  const gatesDir = join(root, 'scripts', 'gates')
  const runSrc = readFileSync(join(gatesDir, 'run.ts'), 'utf8')
  const names = parseGateNames(runSrc)
  if (names.length === 0) {
    return { ok: false, errors: ['scripts/gates/run.ts 未解析到 GATES 条目（GATES 格式变更？）'] }
  }
  const present = new Set(readdirSync(gatesDir).filter((f) => f.endsWith('.test.ts')))
  for (const name of names) {
    if (TEST_GROUPS.has(name)) continue
    if (!present.has(`${name}.test.ts`)) {
      errors.push(`门禁 ${name} 缺自证测试 scripts/gates/${name}.test.ts（法则 2：每个非平凡门禁必须有证明它会拒绝的测试）`)
    }
  }
  return { ok: errors.length === 0, errors }
}

// CLI entry point; imports do not execute it.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { ok, errors } = check()
  for (const e of errors) console.error(`[verify-gate-self-coverage] ${e}`)
  if (!ok) {
    console.error(`[verify-gate-self-coverage] ${errors.length} 处违规`)
    process.exit(1)
  }
  console.log('[verify-gate-self-coverage] OK（GATES 全部有自证测试）')
}
