// Desktop runtime configuration controls connection and execution, separately
// from the pet's server-side experience settings. The default web base is loopback:3080.
// Presence renews every 15 seconds within a 45-second TTL.
// CLI arguments and environment variables override defaults through loadConfig().

export const DEFAULTS = Object.freeze({
  // DSH web server root.
  baseURL: 'http://127.0.0.1:3080',
  // Route prefix matches the plugin's authoritative routes module.
  routePrefix: '/whale-girl',
  // State polling interval matches the plugin's 3000 ms default.
  pollMs: 3000,
  // Renew presence every 15 seconds, safely within the 45-second TTL.
  heartbeatMs: 15000,
  // Refresh state immediately when the SSE stream reports an event.
  eventsEnabled: true,
  // Announce presence automatically at startup, including headless mode, so the web pet hides.
  autoPresence: true,
  // Explicitly send online:false during shutdown.
  cleanupOnExit: true,
  // When rendering is disabled, run heartbeats, state polling, and SSE without a desktop window.
  renderEnabled: true,
  // Default pet size in pixels, followed by live server configuration updates.
  size: 110,
  // Enable text badges and reply bubbles.
  showStatus: true,
})

/**
 * Merge runtime defaults with DSH_* environment variables and CLI overrides.
 * @param {{env?: Record<string,string|undefined>, argv?: string[]}} [ctx]
 * @returns {object}
 */
export function loadConfig({ env = process.env ?? {}, argv = process.argv ?? [] } = {}) {
  const cfg = { ...DEFAULTS }

  if (env.WHALE_GIRL_BASE_URL) cfg.baseURL = env.WHALE_GIRL_BASE_URL.replace(/\/+$/, '')
  if (env.WHALE_GIRL_POLL_MS != null) cfg.pollMs = Number(env.WHALE_GIRL_POLL_MS) || cfg.pollMs
  if (env.WHALE_GIRL_HEARTBEAT_MS != null) cfg.heartbeatMs = Number(env.WHALE_GIRL_HEARTBEAT_MS) || cfg.heartbeatMs

  // CLI: --headless / --base-url=<url> / --poll-ms=<n> / --no-presence / --no-render
  if (argv.includes('--headless')) cfg.renderEnabled = false
  if (argv.includes('--no-render')) cfg.renderEnabled = false
  if (argv.includes('--no-presence')) cfg.autoPresence = false
  for (const arg of argv) {
    const m = /^--base-url=(.+)$/.exec(arg)
    if (m) cfg.baseURL = m[1].replace(/\/+$/, '')
    const p = /^--poll-ms=(\d+)$/.exec(arg)
    if (p) cfg.pollMs = Number(p[1])
    const h = /^--heartbeat-ms=(\d+)$/.exec(arg)
    if (h) cfg.heartbeatMs = Number(h[1])
  }
  return cfg
}

/** Read-only experience settings returned by the server; reload only when configRevision changes. */
export const REMOTE_DEFAULTS = Object.freeze({
  enabled: true, size: 110, opacity: 1, pollMs: 3000,
})
