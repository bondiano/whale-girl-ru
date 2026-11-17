// SSE client for the pet event stream, using native Node >=18 streaming fetch.
// Events request a state refresh; payload fields are not interpreted here.
// Reconnect using the retry interval and ignore comment heartbeats.
// Lifecycle and data callbacks expose event, reconnect, error, and open notifications.

import { EventEmitter } from 'node:events'

/** Default reconnect interval; the server's retry field may override three seconds. */
const DEFAULT_RETRY_MS = 3000
/** Allow enough silence for the server's 25-second heartbeat, then reconnect stalled streams. */
const HEARTBEAT_GUARD_MS = 90000

/** Find the earliest SSE blank-line boundary for LF or CRLF; return -1 when incomplete. */
function findBlockBoundary(buffer) {
  const lf = buffer.indexOf('\n\n')
  const crlf = buffer.indexOf('\r\n\r\n')
  if (lf === -1) return crlf
  if (crlf === -1) return lf
  return Math.min(lf, crlf)
}

/**
 * SSE EventEmitter with event/reconnect/error/open notifications.
 * @param {string} url Event stream URL.
 * @param {object} [opts]
 * @param {number|string} [opts.retryMs] Initial reconnect interval; server retry may override it.
 * @param {AbortSignal} [opts.signal] Shutdown signal.
 */
export function createSSEClient(url, { retryMs = DEFAULT_RETRY_MS, signal } = {}) {
  const em = new EventEmitter()
  let controller = null
  let closed = false
  let retry = Number(retryMs) || DEFAULT_RETRY_MS
  let lastPingAt = 0

  async function streamOnce() {
    if (closed) return
    // Each connection gets its own AbortController, recreated after reconnecting.
    controller = new AbortController()
    const abort = () => controller.abort()
    if (signal) {
      if (signal.aborted) { close(); return }
      signal.addEventListener('abort', abort, { once: true })
    }
    try {
      const res = await fetch(url, {
        headers: { accept: 'text/event-stream' },
        signal: controller.signal,
      })
      if (!res.ok || !res.body) {
        throw new Error(`SSE connect HTTP ${res.status}`)
      }
      em.emit('open')
      lastPingAt = Date.now()
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (!closed && !controller.signal.aborted) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        // Split SSE blocks at the earliest LF or CRLF blank line; recognizing only LF
        // would leave CRLF streams buffered indefinitely.
        let sep
        while ((sep = findBlockBoundary(buffer)) !== -1) {
          const raw = buffer.slice(0, sep)
          // Skip the separator's own newlines.
          buffer = buffer.slice(sep + (buffer[sep] === '\r' ? 4 : 2))
          handleChunk(raw)
        }
      }
    } catch (err) {
      if (closed || controller.signal.aborted) return
      em.emit('error', err)
    } finally {
      if (signal) signal.removeEventListener('abort', abort)
      if (!closed) scheduleReconnect()
    }
  }

  function handleChunk(raw) {
    // Parse SSE data/retry fields and comment lines.
    const dataLines = []
    for (const line of raw.split('\n')) {
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim())
      } else if (line.startsWith(':')) {
        // Ignore comments, including ping heartbeats.
      } else if (line.startsWith('retry:')) {
        const v = Number(line.slice(6).trim())
        if (Number.isFinite(v) && v > 0) retry = v
      }
    }
    lastPingAt = Date.now()
    if (dataLines.length) {
      const payload = dataLines.join('\n')
      em.emit('event', payload)
    }
  }

  let reconnectTimer = null
  function scheduleReconnect() {
    if (closed) return
    // Clear any previous timer to prevent overlapping reconnect schedules.
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      if (closed) return
      em.emit('reconnect')
      streamOnce()
    }, retry)
  }

  // No data within HEARTBEAT_GUARD_MS means a stalled connection; abort and reconnect.
  const guard = setInterval(() => {
    if (closed) return
    if (Date.now() - lastPingAt > HEARTBEAT_GUARD_MS) {
      controller?.abort()
    }
  }, Math.min(30000, HEARTBEAT_GUARD_MS))

  function close() {
    closed = true
    clearInterval(guard)
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    controller?.abort()
    em.emit('close')
  }

  // Start the subscription.
  streamOnce()

  return { events: em, close }
}
