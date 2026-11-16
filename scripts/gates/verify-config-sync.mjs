// Verify shared configuration defaults and namespace identity deterministically.
// The client scalar subset must match core DEFAULTS. The patch entry id, package
// name, core NAMESPACE, and client SETTINGS_NAMESPACE must agree: the host uses
// the entry id for settings and package name for the bundle configuration slot.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = resolve(import.meta.dirname, '../..')

/**
 * Extract and flatten scalar values from a named source object, including nested objects.
 * @param {string} src Source text.
 * @param {string} objectName DEFAULTS or CFG_DEFAULTS.
 * @returns {{ [key: string]: number | boolean | object }}
 */
function extractNumericLeaf(src, objectName) {
  // Support both direct object literals and Object.freeze({...}).
  const re = new RegExp(`${objectName}(?:\\s*:[^=]+)?\\s*=\\s*(?:Object\\.freeze\\()?(\\{[\\s\\S]*?\\n\\})(?:\\))?`)
  const m = re.exec(src)
  if (m === null) return null
  // Evaluate only the extracted data literal; it contains scalar values and nested objects.
  const obj = new Function(`return (${m[1]})`)()
  return flatten(obj)
}

function flatten(obj, prefix = '') {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, key))
    else out[key] = v
  }
  return out
}

/** Read the first insert entry id from cordis.patch.yml; it is the host settings namespace. */
function patchEntryId(patchSrc) {
  let insertIndent = null
  for (const line of patchSrc.split('\n')) {
    const insert = /^(\s*)-\s*insert:/.exec(line)
    if (insert !== null) {
      insertIndent = insert[1].length
      continue
    }
    if (insertIndent === null) continue
    const entry = /^(\s*)-\s*id:\s*(\S+)/.exec(line)
    if (entry !== null && entry[1].length > insertIndent) return entry[2].replace(/['"]/g, '')
  }
  return null
}

/** Extract the four declarations of the settings namespace. */
function identity(root) {
  const patchSrc = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
  const pkgSrc = readFileSync(join(root, 'package.json'), 'utf8')
  const configSrc = readFileSync(join(root, 'src', 'core', 'config.ts'), 'utf8')
  const clientSrc = readFileSync(join(root, 'src', 'client', 'index.ts'), 'utf8')
  return {
    'cordis.patch.yml 条目 id': patchEntryId(patchSrc),
    'package.json 包名': JSON.parse(pkgSrc).name ?? null,
    'src/config.mjs NAMESPACE': /export const NAMESPACE\s*=\s*['"]([^'"]+)['"]/.exec(configSrc)?.[1] ?? null,
    'client SETTINGS_NAMESPACE': /const SETTINGS_NAMESPACE\s*=\s*['"]([^'"]+)['"]/.exec(clientSrc)?.[1] ?? null,
  }
}

/** Validate defaults and namespace identity; return { ok, errors }. */
export function check(root = ROOT) {
  const errors = []
  const configSrc = readFileSync(join(root, 'src', 'core', 'config.ts'), 'utf8')
  const clientSrc = readFileSync(join(root, 'src', 'client', 'index.ts'), 'utf8')

  const defaults = extractNumericLeaf(configSrc, 'DEFAULTS')
  const clientDefaults = extractNumericLeaf(clientSrc, 'CFG_DEFAULTS')
  if (defaults === null) {
    return { ok: false, errors: ['src/config.mjs 未找到 DEFAULTS 对象'] }
  }
  if (clientDefaults === null) {
    return { ok: false, errors: ['client/index.mjs 未找到 CFG_DEFAULTS 对象'] }
  }

  // The client consumes a subset of DEFAULTS; every consumed value must match.
  for (const [key, value] of Object.entries(clientDefaults)) {
    if (!(key in defaults)) {
      errors.push(`client CFG_DEFAULTS.${key} 不在 src/config.mjs DEFAULTS（配置项须先声明于 config.mjs）`)
      continue
    }
    if (defaults[key] !== value) {
      errors.push(`client CFG_DEFAULTS.${key} = ${value} ≠ src/config.mjs DEFAULTS.${key} = ${defaults[key]}（默认值单一来源，漂移即改两处之一）`)
    }
  }

  // All four namespace declarations must exist and agree.
  const names = identity(root)
  const reference = names['src/config.mjs NAMESPACE']
  for (const [label, value] of Object.entries(names)) {
    if (value === null || value === '') {
      errors.push(`${label}：未找到设置命名空间声明（四处须同名：条目 id / 包名 / NAMESPACE / SETTINGS_NAMESPACE）`)
    } else if (reference === null) {
      break
    } else if (value !== reference) {
      errors.push(`${label} = ${value} ≠ src/config.mjs NAMESPACE = ${reference}（设置命名空间 = 条目 id = 包名 = 卡片 key）`)
    }
  }
  return { ok: errors.length === 0, errors }
}

// CLI entry point; imports do not execute it.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { ok, errors } = check()
  for (const e of errors) console.error(`[verify-config-sync] ${e}`)
  if (!ok) {
    console.error(`[verify-config-sync] ${errors.length} 处违规`)
    process.exit(1)
  }
  console.log('[verify-config-sync] OK（默认值与命名空间同一性：条目 id / 包名 / NAMESPACE / client 字面量）')
}
