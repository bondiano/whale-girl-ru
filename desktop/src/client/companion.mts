// Desktop companion engine combines presence heartbeats, state polling, SSE,
// and local scheduling. It emits animation intents and snapshots for headless or desktop rendering.
// Only presence and interact are writable endpoints. The plugin exclusively owns
// XP/titles and the ledger; this engine never rewrites them.

import { createClient } from './http.mjs'
import { createSSEClient } from './events.mjs'
import { createLogger } from './utils.mjs'
import { ROUTE_PREFIX } from './utils.mjs'
import { createScheduler, stepScheduler, applyInteraction } from './scheduler.mjs'
import { pickAnimation } from './state.mjs'

/** Local scheduling ticks faster than polling to advance sleep, wandering, and working interludes. */
const TICK_MS = 250

/**
 * Start the desktop companion engine.
 * @param {object} opts Connection/runtime options from loadConfig().
 * @param {object} [hooks] Rendering or logging callbacks.
 * @param {(snapshot: object) => void} [hooks.onSnapshot] Called after a state refresh.
 * @param {(anim: {name: string, context: object}) => void} [hooks.onAnimation] Called when animation intent changes.
 * @param {(reply: string) => void} [hooks.onReply] Interaction bubble callback.
 * @returns {{ client, stop: () => Promise<void>, interact: (action:'feed'|'play') => Promise<void>, getState: () => object }}
 */
export async function createCompanion(opts, hooks = {}) {
  const log = opts.logger ?? createLogger()
  const client = createClient({
    baseURL: opts.baseURL,
    routePrefix: opts.routePrefix ?? ROUTE_PREFIX,
  })

  // Runtime state.
  let snapshot = null            // Latest state response.
  let remoteConfig = null        // Current server configuration.
  let anim = { name: 'idle', context: {} } // Most recently derived animation intent.
  let stopped = false
  const sched = createScheduler({ sleepAfterMs: opts.sleepAfterMs })

  // Fetch and reapply server configuration only when configRevision changes.
  // Renderer size/opacity following is a separate desktop capability documented in DESIGN.
  let lastConfigRevision = -1
  const applyRemoteConfig = async () => {
    if (snapshot === null || typeof snapshot.configRevision !== 'number') return
    if (snapshot.configRevision === lastConfigRevision) return
    lastConfigRevision = snapshot.configRevision
    try {
      const body = await client.getConfig()
      remoteConfig = body?.config ?? null
    } catch (err) {
      log.warn('拉取 /config 失败（保持上次）:', err.message)
    }
  }

  // Derive animation intent and notify rendering only when it changes.
  let lastAnimName = null
  const computeAnimation = () => {
    const next = pickAnimation(snapshot, sched)
    anim = next
    if (next.name !== lastAnimName) {
      lastAnimName = next.name
      hooks.onAnimation?.(next)
    }
    hooks.onTick?.(next, sched)
    return next
  }

  // State polling coalesces refreshes from timers, SSE, and interactions.
  // Keep one request in flight; a refresh arriving during it schedules one follow-up
  // so concurrent responses cannot race and the latest state is not lost.
  let refreshing = false
  let pendingRefresh = false
  const refreshState = async () => {
    if (refreshing) {
      pendingRefresh = true // Coalesce an in-flight refresh and request one follow-up.
      return null
    }
    refreshing = true
    try {
      do {
        pendingRefresh = false
        try {
          const body = await client.getState()
          snapshot = body
          await applyRemoteConfig()
          hooks.onSnapshot?.(snapshot)
          computeAnimation()
          if (!pendingRefresh) return body
        } catch (err) {
          log.warn('GET /state 失败:', err.message)
          // Run another refresh if requests accumulated while this one was in flight.
          return null
        }
      } while (pendingRefresh)
      return snapshot
    } finally {
      refreshing = false
      pendingRefresh = false
    }
  }

  // SSE events refresh state immediately, reducing latency to one round trip.
  let sse = null
  const startSSE = () => {
    if (opts.eventsEnabled === false) return
    const url = new URL(`${opts.routePrefix ?? ROUTE_PREFIX}/events`, opts.baseURL).toString()
    sse = createSSEClient(url, { signal: opts.signal })
    sse.events.on('event', () => {
      log.debug('SSE 事件 → 立即刷新 /state')
      refreshState()
    })
    sse.events.on('reconnect', () => log.debug('SSE 重连'))
    sse.events.on('error', (err) => log.warn('SSE:', err.message))
  }

  // Presence heartbeats run every 15 seconds; shutdown sends online:false.
  // Bound requests with AbortSignal so an unreachable host cannot stall exit.
  const PRESENCE_TIMEOUT_MS = 2000
  const sendPresence = async (online) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PRESENCE_TIMEOUT_MS)
    try {
      const body = await client.setPresence(online, { signal: controller.signal })
      return body
    } catch (err) {
      log.warn(`POST /presence ${online ? '上线' : '下线'} 失败:`, err.message)
      return null
    } finally {
      clearTimeout(timer)
    }
  }
  let heartbeatTimer = null
  const startHeartbeat = () => {
    if (opts.autoPresence === false) return
    heartbeatTimer = setInterval(() => sendPresence(true), opts.heartbeatMs)
  }

  // Start the engine.
  if (opts.autoPresence !== false) await sendPresence(true) // Announce presence immediately so the web pet can hide.
  startHeartbeat()
  await refreshState()
  startSSE()
  const pollTimer = setInterval(refreshState, opts.pollMs)
  const tickTimer = setInterval(() => {
    if (stopped) return
    stepScheduler(sched, { snapshot, now: Date.now() })
    computeAnimation()
  }, TICK_MS)

  // User interactions.
  const interact = async (action = 'feed') => {
    try {
      const body = await client.interact(action)
      applyInteraction(sched, action, Date.now()) // Apply local transient, joy, and wake effects using the injected clock.
      const reply = body?.reply ?? null
      log.info(`互动 ${action}: ${reply ?? ''}`)
      hooks.onReply?.(reply)
      await refreshState()
      computeAnimation()
      return body
    } catch (err) {
      log.warn(`POST /interact ${action} 失败:`, err.message)
      return null
    }
  }

  // Shutdown cleanup.
  const stop = async () => {
    if (stopped) return
    stopped = true
    clearInterval(heartbeatTimer)
    clearInterval(pollTimer)
    clearInterval(tickTimer)
    if (sse) sse.close()
    if (opts.cleanupOnExit !== false) {
      await sendPresence(false) // Explicitly go offline so the web pet reappears immediately.
    }
    log.info('伴侣已停止（presence 已下线）')
  }

  return {
    client,
    interact,
    getState: () => snapshot,
    getAnimation: () => anim,
    get scheduler() { return sched },
    stop,
  }
}