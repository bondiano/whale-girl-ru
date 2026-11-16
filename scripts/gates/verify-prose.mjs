// Check resident and normative documentation for planning language, stale history,
// and implementation/review transcripts rather than current contracts.
// Read-only and deterministic. Architecture-evolution documentation is exempt;
// legitimate future-direction sections can use line-level exemptions.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = resolve(import.meta.dirname, '../..')

/** Scan resident and normative documents; decision records have their own format gate. */
const SCAN_FILES = ['AGENTS.md', 'README.md', 'docs/AGENTS.md', 'decisions/README.md']

/** Planning-language patterns forbidden in implemented or resident documentation. */
const PLANNING_RE = /(待迁移|待办|尚未实现|TODO|FIXME|验收标准|将来会|计划中)/
/** Historical narration belongs in commits and decision records, not current contracts. */
const HISTORY_RE = /(之前.*(?:是|为|用)|现在改为|不再(?:是|用|需要)|曾经(?:是|有))/
/** Review and implementation transcript patterns. */
const NARRATIVE_RE = /(测试走查|评审发现|本次重构|本次修复|上一轮)/

/** Files with legitimate design-evolution content; other exceptions use inline markers. */
const EXEMPT_FILES = new Set(['docs/architecture-evolution.md', 'docs/growth-system.md'])

/** Validate prose contracts and return { ok, errors }. */
export function check(root = ROOT) {
  const errors = []
  for (const rel of SCAN_FILES) {
    const file = join(root, rel)
    let lines
    try {
      lines = readFileSync(file, 'utf8').split('\n')
    } catch {
      errors.push(`${rel}: 无法读取（文件缺失）`)
      continue
    }
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Exempt examples that teach which wording to remove rather than using it as a contract.
      const isSlopExample = /❌|不写|删除|删掉|避免|禁止/.test(line)
      if (isSlopExample) continue
      const stripped = line.replace(/<!--.*?-->/g, '') // Inline exemption marker.
      if (PLANNING_RE.test(line)) {
        // Implemented records forbid planning language; resident documents forbid unresolved work markers.
        errors.push(`${rel}:${i + 1}: 规划语气「${line.match(PLANNING_RE)[0]}」——写当前态，规划归提案/文档「未来方向」`)
      } else if (HISTORY_RE.test(line)) {
        errors.push(`${rel}:${i + 1}: 历史叙述「${line.match(HISTORY_RE)[0]}」——写当前态，变更史归 commit/决策记录`)
      } else if (NARRATIVE_RE.test(line) && !EXEMPT_FILES.has(rel)) {
        errors.push(`${rel}:${i + 1}: 实现/评审叙述「${line.match(NARRATIVE_RE)[0]}」——只写契约`)
      }
    }
  }
  return { ok: errors.length === 0, errors }
}

// CLI entry point; imports do not execute it.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { ok, errors } = check()
  for (const e of errors) console.error(`[verify-prose] ${e}`)
  if (!ok) {
    console.error(`[verify-prose] ${errors.length} 处 slop`)
    process.exit(1)
  }
  console.log('[verify-prose] OK（散文只写契约，无规划/历史/叙述残留）')
}
