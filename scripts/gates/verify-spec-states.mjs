// Cross-check the sprite specification's declared count, state rows, STATE_NAMES,
// STATE_TABLE including dynamic burst values, and each character's manifest playback.
// The state-machine priority list must match STATE_TABLE row order.
// This read-only deterministic check catches syntactically valid semantic drift.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { STATE_NAMES, STATE_TABLE } from '../../dist/client/logic.js'

const ROOT = resolve(import.meta.dirname, '../..')
// The authoritative state-table heading declares a count verified against its rows.
const TITLE_RE = /^## 状态总表（权威，(\d+) 状态）$/
// Read state table rows; ignore headings and separators.
const STATE_ROW_RE = /^\| `([a-z-]+)` \|.*\| `([a-z]+)` \|/
// Priority list rows may contain multiple state tokens; ignore full-width parenthesized notes.
const PRIORITY_ROW_RE = /^\d+\.\s+/

/** Validate specification states, priority order, and manifest playback; return { ok, errors }. */
export function check(root = ROOT) {
  const errors = []
  const spec = join(root, 'docs', 'sprites-spec.md')
  let lines
  try {
    lines = readFileSync(spec, 'utf8').split('\n')
  } catch (error) {
    return { ok: false, errors: [`docs/sprites-spec.md 无法读取：${error instanceof Error ? error.message : String(error)}`] }
  }
  let declared = null
  let inTable = false
  const rows = [] // { name, playback }
  for (const line of lines) {
    const t = TITLE_RE.exec(line)
    if (t !== null) {
      declared = Number(t[1])
      inTable = true
      continue
    }
    if (inTable) {
      if (line.startsWith('#')) break // The first table ends at the next h2 or h3 heading.
      const m = STATE_ROW_RE.exec(line)
      if (m !== null && !line.includes('---')) rows.push({ name: m[1], playback: m[2] })
    }
  }
  if (declared === null) {
    errors.push('docs/sprites-spec.md 缺少「状态总表（权威，N 状态）」标题')
    return { ok: false, errors }
  }
  if (rows.length !== declared) {
    errors.push(`状态总表声明 ${declared} 状态，表格实际 ${rows.length} 行（新增/删除状态须同步标题数字与表格）`)
  }
  const specSet = new Set(rows.map((r) => r.name))
  const nameSet = new Set(STATE_NAMES)
  for (const name of nameSet) {
    if (!specSet.has(name)) errors.push(`client STATE_NAMES 有 ${name}，spec 状态总表缺（须同步 docs/sprites-spec.md）`)
  }
  for (const name of specSet) {
    if (!nameSet.has(name)) errors.push(`spec 状态总表有 ${name}，client STATE_NAMES 缺（须同步 client/logic.mjs）`)
  }
  // Every row state, including dynamic burst resolutions, must belong to STATE_NAMES.
  for (const row of STATE_TABLE) {
    if (row.state !== 'burst' && !nameSet.has(row.state)) {
      errors.push(`STATE_TABLE 行状态 ${row.state} 不在 STATE_NAMES（新增状态须同步权威集合与 spec）`)
    }
  }
  for (const dynamic of ['welcome', 'celebrate', 'error', 'disappointed']) {
    if (!nameSet.has(dynamic)) errors.push(`burst 动态解析值 ${dynamic} 不在 STATE_NAMES`)
  }
  // Cross-check documented playback semantics with each manifest entry.
  const manifestPath = join(root, 'lib', 'assets', 'manifest.json')
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const specPlayback = new Map(rows.map((r) => [r.name, r.playback]))
    const collect = (states, label) => {
      for (const [name, cfg] of Object.entries(states ?? {})) {
        if (cfg !== null && typeof cfg === 'object' && typeof cfg.playback === 'string') {
          const expected = specPlayback.get(name)
          if (expected !== undefined && cfg.playback !== expected) {
            errors.push(`${label}.${name}: manifest playback "${cfg.playback}" ≠ spec 状态总表播放行为 "${expected}"（须同步）`)
          }
        }
      }
    }
    if (manifest?.characters !== null && typeof manifest?.characters === 'object') {
      for (const [id, ch] of Object.entries(manifest.characters)) {
        if (ch !== null && typeof ch === 'object') collect(ch.states, `characters.${id}.states`)
      }
    } else {
      collect(manifest?.states, 'states')
    }
  } catch {
    // The asset gate owns unreadable or malformed manifests; avoid duplicate failures here.
  }
  // The documentation priority list must match STATE_TABLE row order.
  const docOrder = parsePriorityList(join(root, 'docs', 'state-machine.md'))
  if (docOrder === null) {
    errors.push('docs/state-machine.md 缺少「## 优先级」逐行列表（N. 行，verify-spec-states 机械校验行序）')
  } else {
    const tableOrder = STATE_TABLE.map((r) => r.state)
    if (JSON.stringify(docOrder) !== JSON.stringify(tableOrder)) {
      errors.push(`优先级列表行序 [${docOrder.join(', ')}] ≠ STATE_TABLE 行序 [${tableOrder.join(', ')}]（文档与文法单源漂移）`)
    }
  }
  return { ok: errors.length === 0, errors }
}

/** Parse priority-list state tokens; return null if the list is missing. */
export function parsePriorityList(file) {
  let lines
  try {
    lines = readFileSync(file, 'utf8').split('\n')
  } catch {
    return null
  }
  const order = []
  let inList = false
  for (const line of lines) {
    if (/^## (?:优先级|Приоритеты)(?:\s|（|$)/u.test(line)) { inList = true; continue }
    if (inList) {
      if (line.startsWith('## ')) break
      if (PRIORITY_ROW_RE.test(line)) {
        // Remove full-width parenthesized notes, then collect all backtick-delimited tokens.
        // A combined eat/play list row represents two consecutive STATE_TABLE rows.
        const withoutNotes = line.replace(/（[^）]*）/g, '')
        const tokens = [...withoutNotes.matchAll(/`([a-z-]+)`/g)].map((m) => m[1])
        if (tokens.length > 0) order.push(...tokens)
      }
    }
  }
  return order.length > 0 ? order : null
}

// CLI entry point; imports do not execute it.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { ok, errors } = check()
  for (const e of errors) console.error(`[verify-spec-states] ${e}`)
  if (!ok) {
    console.error(`[verify-spec-states] ${errors.length} 处违规`)
    process.exit(1)
  }
  console.log(`[verify-spec-states] OK（${STATE_NAMES.length} 状态与 spec 总表一致）`)
}
