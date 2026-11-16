// Pure asset-path and MIME guards, without host dependencies.
// Extract a relative asset path; reject dot segments, empty segments, backslashes, NUL bytes, and absolute paths.
import { ASSETS_PATH } from './routes.js'
export { ASSETS_PATH }

/**
 * Extract a safe relative path from a decoded URL pathname; return null for invalid paths.
 * @param pathname Decoded URL pathname.
 * @param prefix Asset route prefix.
 */
export function sanitizeAssetPath(pathname: string, prefix = ASSETS_PATH) {
  if (!pathname.startsWith(`${prefix}/`)) return null
  const rel = pathname.slice(prefix.length + 1)
  if (rel === '' || rel.includes('\0')) return null
  const segments = rel.split('/')
  for (const s of segments) {
    if (s === '' || s === '.' || s === '..' || s.includes('\\')) return null
  }
  return rel
}

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.json': 'application/json; charset=utf-8',
}

/** Map a file extension to content-type; unknown extensions use application/octet-stream. */
export function contentTypeFor(rel: string) {
  const dot = rel.lastIndexOf('.')
  const ext = dot === -1 ? '' : rel.slice(dot).toLowerCase()
  return MIME[ext] ?? 'application/octet-stream'
}
