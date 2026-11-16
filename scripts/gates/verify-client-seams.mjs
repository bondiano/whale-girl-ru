// Reject retired host client service names in source and the generated bundle.
// Cordis strictly waits for injected services; a retired dependency can leave the
// entire pet and settings card pending indefinitely. This check is read-only and deterministic.
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = resolve(import.meta.dirname, '../..')

/** Retired client service names and their current replacements; update with host API changes. */
export const RETIRED_SEAMS = {
  settingsScope: 'configForms.get(namespace)（同步 settingsSchema）',
  'settings.plugin.item': 'plugins.item / plugins.bundle.config / plugins.row.config',
}

/** Scan client sources and their generated bundle. */
function scanTargets(root) {
  const dir = join(root, 'src', 'client')
  const files = readdirSync(dir).filter((name) => name.endsWith('.ts')).map((name) => join(dir, name))
  files.push(join(root, 'lib', 'client.js'))
  return files
}

/** Validate client service references and return { ok, errors }. */
export function check(root = ROOT) {
  const errors = []
  let targets
  try {
    targets = scanTargets(root)
  } catch {
    return { ok: false, errors: ['lib/client: 无法列举（client half 源码目录缺失）'] }
  }
  for (const file of targets) {
    let src
    try {
      src = readFileSync(file, 'utf8')
    } catch {
      errors.push(`${file.slice(root.length + 1)}: 无法读取（client half 产物缺失）`)
      continue
    }
    for (const [name, replacement] of Object.entries(RETIRED_SEAMS)) {
      if (src.includes(name)) {
        errors.push(`${file.slice(root.length + 1)}: 引用已退役的客户端缝名 ${name}（现行：${replacement}）`)
      }
    }
  }
  return { ok: errors.length === 0, errors }
}

// CLI entry point; imports do not execute it.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { ok, errors } = check()
  for (const e of errors) console.error(`[verify-client-seams] ${e}`)
  if (!ok) {
    console.error(`[verify-client-seams] ${errors.length} 处违规`)
    process.exit(1)
  }
  console.log('[verify-client-seams] OK（client half 只用现行宿主缝名）')
}
