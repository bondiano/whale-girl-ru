// Shared desktop routing and logging helpers.
// The default prefix matches the plugin's authoritative core routes module.

export const ROUTE_PREFIX = '/whale-girl'

/** @returns `{prefix}${path}`; path begins with a slash. */
export function ROUTE(path) {
  return `${ROUTE_PREFIX}${path}`
}

/** Minimal leveled logging; --quiet suppresses output. */
export function createLogger({ quiet = false, tag = 'whale-girl-desktop' } = {}) {
  const ts = () => new Date().toLocaleTimeString('zh-CN', { hour12: false })
  const write = (level, ...args) => {
    if (quiet && level === 'debug') return
    console.log(`[${ts()}] [${tag}] [${level}]`, ...args)
  }
  return {
    info: (...a) => write('info', ...a),
    debug: (...a) => write('debug', ...a),
    warn: (...a) => write('warn', ...a),
    error: (...a) => write('error', ...a),
  }
}
