// Single authoritative gate registry; documentation links here rather than copying the list.
// Usage: node scripts/gates/run.ts [--group local|ci] or <gate-name>.
// Run every selected gate and report all failures together.
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')

/** Authoritative gates: local is the selected developer set; ci includes local and exhaustive checks. */
const GATES = [
  { name: 'verify-md-links', group: 'local', args: ['scripts/gates/verify-md-links.ts'] },
  { name: 'verify-decisions', group: 'local', args: ['scripts/gates/verify-decisions.ts'] },
  { name: 'verify-assets', group: 'local', args: ['scripts/gates/verify-assets.ts'] },
  { name: 'verify-spec-states', group: 'local', args: ['scripts/gates/verify-spec-states.ts'] },
  { name: 'verify-config-sync', group: 'local', args: ['scripts/gates/verify-config-sync.ts'] },
  { name: 'verify-routes-sync', group: 'local', args: ['scripts/gates/verify-routes-sync.ts'] },
  { name: 'verify-client-seams', group: 'local', args: ['scripts/gates/verify-client-seams.ts'] },
  { name: 'verify-gate-self-coverage', group: 'local', args: ['scripts/gates/verify-gate-self-coverage.ts'] },
  { name: 'verify-settings-schema', group: 'local', args: ['scripts/gates/verify-settings-schema.ts'] },
  { name: 'verify-doc-budget', group: 'local', args: ['scripts/gates/verify-doc-budget.ts'] },
  { name: 'verify-prose', group: 'local', args: ['scripts/gates/verify-prose.ts'] },
  { name: 'check-generated', group: 'local', args: ['scripts/build-client.ts', '--check'] },
  { name: 'unit-tests', group: 'ci', args: ['--test', 'tests/*.test.ts'] },
  { name: 'tool-tests', group: 'ci', runner: 'python3', args: ['tests/slice-sheet.test.py'] },
  { name: 'gate-self-tests', group: 'ci', args: ['--test', 'scripts/gates/*.test.ts'] },
]

function usage() {
  console.error('用法: node scripts/gates/run.ts [--group local|ci] | [gate-name]')
  process.exit(2)
}

const groupArg = process.argv.indexOf('--group')
let selected = null
if (groupArg !== -1) {
  const group = process.argv[groupArg + 1]
  if (group !== 'local' && group !== 'ci') usage()
  selected = GATES.filter((g) => (group === 'ci' ? true : g.group === 'local'))
} else if (process.argv[2]) {
  selected = GATES.filter((g) => g.name === process.argv[2])
  if (selected.length === 0) usage()
} else {
  selected = GATES.filter((g) => g.group === 'local')
}

const failed = []
for (const gate of selected) {
  const runner = gate.runner ?? process.execPath
  const res = spawnSync(runner, gate.args, { cwd: ROOT, stdio: 'inherit', encoding: 'utf8' })
  if (res.status !== 0) failed.push(gate.name)
}
if (failed.length > 0) {
  console.error(`[gates] ${failed.length}/${selected.length} 个门禁失败：${failed.join(', ')}`)
  process.exit(1)
}
console.log(`[gates] ${selected.length} 个门禁全部通过`)
