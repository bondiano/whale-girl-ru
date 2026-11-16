// Check Markdown relative links and image references point to existing files.
// Read-only and deterministic; skip external schemes, anchor-only links, and frozen
// archived documents, including their outgoing links.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, resolve, normalize, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = resolve(import.meta.dirname, '../..')
const SKIP_DIRS = new Set(['.git', 'node_modules', 'archived'])
const SKIP_TARGET_PREFIXES = ['http://', 'https://', 'mailto:', 'data:', 'tel:']
const LINK_RE = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g

/** Collect Markdown files under root, excluding SKIP_DIRS. */
export function collectMarkdownFiles(root) {
  const out = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      out.push(...collectMarkdownFiles(join(root, entry.name)))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(join(root, entry.name))
    }
  }
  return out
}

function existsSafe(p) {
  try {
    const s = statSync(p)
    return s.isFile() || s.isDirectory()
  } catch {
    return false
  }
}

function rel(root, p) {
  return p === root ? '.' : p.replace(root + sep, '')
}

/** Validate all relative Markdown links beneath root; return { ok, errors }. */
export function check(root = ROOT) {
  const errors = []
  for (const file of collectMarkdownFiles(root)) {
    const lines = readFileSync(file, 'utf8').split('\n')
    for (let i = 0; i < lines.length; i++) {
      LINK_RE.lastIndex = 0
      let m
      while ((m = LINK_RE.exec(lines[i])) !== null) {
        const raw = m[1]
        const target = raw.split('#')[0].trim()
        if (target === '' || SKIP_TARGET_PREFIXES.some((p) => target.startsWith(p))) continue
        const resolved = target.startsWith('/')
          ? normalize(join(root, target))
          : normalize(join(dirname(file), target))
        if (!existsSafe(resolved)) {
          errors.push(`${rel(root, file)}:${i + 1}: 链接 "${raw}" 指向不存在的路径 ${rel(root, resolved)}`)
        }
      }
    }
  }
  return { ok: errors.length === 0, errors }
}

// CLI entry point; imports do not execute it.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { ok, errors } = check()
  for (const e of errors) console.error(`[verify-md-links] ${e}`)
  if (!ok) {
    console.error(`[verify-md-links] ${errors.length} 个失效链接`)
    process.exit(1)
  }
  console.log('[verify-md-links] OK')
}
