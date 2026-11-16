#!/usr/bin/env node
// Desktop companion entry point. Plain Node runs headless heartbeats, polling,
// SSE, and logs for tests or desktop-free environments. Electron creates a transparent,
// always-on-top window and runs the companion engine in main, sending animation intents over IPC.

import { loadConfig } from './src/config.mjs'
import { createLogger } from './client/utils.mjs'

// Parse CLI arguments before imports with side effects so tests can control them.
const cfg = loadConfig()
const log = createLogger({ tag: 'whale-girl-desktop' })

const isElectronMain = typeof process !== 'undefined' && process.versions?.electron !== undefined
const headless = !cfg.renderEnabled || process.argv.includes('--headless')
const renderJson = process.argv.includes('--render-json')

if (renderJson) {
  // JSON-lines bridge for a lightweight native shell such as Tauri.
  // Write animation/snapshot/reply records to stdout; read interact/stop commands from stdin.
  // Share the same companion/hooks API with other modes and send logs only to stderr.
  const origLog = console.log.bind(console)
  console.log = (...args) => process.stderr.write(`${args.join(' ')}\n`)
  const { createCompanion } = await import('./client/companion.mjs')
  const out = (obj) => process.stdout.write(`${JSON.stringify(obj)}\n`)
  const companion = await createCompanion(cfg, {
    onSnapshot: (snap) => out({ type: 'snapshot', snapshot: snap }),
    onAnimation: (anim) => out({ type: 'anim', name: anim.name, context: anim.context }),
    onReply: (reply) => out({ type: 'reply', reply }),
  })
  out({ type: 'ready', baseURL: cfg.baseURL })
  let buf = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk) => {
    buf += chunk
    let nl
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line) continue
      try {
        const cmd = JSON.parse(line)
        if (cmd.type === 'interact') companion.interact(cmd.action ?? 'feed')
        else if (cmd.type === 'stop') companion.stop().then(() => process.exit(0))
      } catch { /* Ignore malformed command lines. */ }
    }
  })
  const shutdown = () => companion.stop().then(() => process.exit(0))
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  // A parent shell exit closes the pipe; treat stdout EPIPE as graceful shutdown.
  process.stdout.on('error', (err) => {
    if (err.code === 'EPIPE') process.exit(0)
  })
} else if (isElectronMain && !headless) {
  // Electron main entry: do not top-level await runDesktop(), which awaits app.whenReady().
  // Blocking ESM initialization would prevent Electron's ready event. Start the async
  // lifecycle without awaiting here; runDesktop reports errors and exits itself.
  const { runDesktop } = await import('./render/window.mjs')
  process.nextTick(() => {
    runDesktop({ cfg, log }).catch((err) => {
      try { log.error('桌面渲染启动失败:', err?.message ?? err) } catch {}
      process.exit(1)
    })
  })
} else {
  // Headless mode runs only heartbeats, state polling, and SSE for tests or desktop-free environments.
  const { createCompanion } = await import('./client/companion.mjs')
  const companion = await createCompanion(cfg, {
    onSnapshot: (snap) => {
      const act = snap?.activity?.name ?? '?'
      const lv = snap?.pet?.level ?? '?'
      const online = snap?.companionOnline === true
      log.info(`state: activity=${act} Lv.${lv} companionOnline=${online}`)
    },
    onAnimation: (anim) => log.debug(`anim → ${anim.name}`),
    onReply: (reply) => log.info(`reply: ${reply}`),
  })
  log.info(`headless 模式运行中：BaseURL=${cfg.baseURL} pollMs=${cfg.pollMs} heartbeatMs=${cfg.heartbeatMs}`)
  log.info('按 Ctrl+C 退出（退出时自动发送 {online:false}）')

  const shutdown = () => {
    companion.stop().then(() => process.exit(0))
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  // Report unexpected rejected promises instead of failing silently; keep the engine running and retrying.
  process.on('unhandledRejection', (err) => log.warn('unhandled rejection:', err?.message ?? err))
}