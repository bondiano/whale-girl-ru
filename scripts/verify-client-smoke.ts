// Browser smoke test: node scripts/verify-client-smoke.ts <web-url>.
// Requires a running web host and Chrome; CHROME_BIN overrides its location.
// Assert client apply succeeds, the pet host exists, and a ready sprite is visible.
// This manual browser check covers client behavior unavailable to HTTP-only probes.
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = process.argv[2]
const DEBUG_PORT = 9240
// Chrome requires --remote-allow-origins for CDP connections with Origin.
// Use an isolated user-data directory so requests cannot attach to an unrelated profile.
const PROFILE_DIR = mkdtempSync(join(tmpdir(), 'whale-girl-smoke-'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

if (!URL) {
  console.error('用法: node scripts/verify-client-smoke.ts <web-url>')
  process.exit(2)
}
if (!existsSync(CHROME)) {
  console.error(`[verify-client-smoke] Chrome 不可用：${CHROME}（用 CHROME_BIN 覆盖）`)
  process.exit(2)
}

/** Assert actual elements rather than matching CSS selectors or module source text. */
function analyze(html) {
  const errors = []
  if (html.includes('Failed to load plugins') || html.includes('plugin tree failed to load')) {
    errors.push('页面出现 harness/插件树加载失败（client apply 失败）')
  }
  // Distinguish the host element's data attribute from a CSS selector mentioning it.
  if (!/<div data-whale-girl[=> ]/.test(html)) errors.push('未找到 [data-whale-girl] 元素（client half 未 apply）')
  if (!/<span class="pet-lv"/.test(html)) errors.push('状态条未渲染（apply 可能中途抛错）')
  // Check the sprite element and its background image.
  const stageHasSprite = /<div class="pet-stage[^"]*"[^>]*>\s*<div class="pet-sprite[^>]*background-image/.test(html)
  if (!stageHasSprite) errors.push('宠物舞台为空（sprite 未渲染）')
  // Regression checks for the idle motion recipe and rendered ledger task count.
  if (!/pet-motion-[a-z]+/.test(html)) errors.push('未找到 pet-motion-* 运动类（motion 配方未生效）')
  // Match the current Russian task-count label.
  if (!/<span class="pet-stats"[^>]*>Задач:\s*\d+/.test(html)) errors.push('账本统计未渲染（任务计数缺失）')
  // Reject invalid sprite scale values, which browsers discard and thereby break sizing/flipping.
  // Extract the first scale() from the combined translate/scale/scaleX transform.
  if (stageHasSprite) {
    const m = /<div class="pet-sprite[^>]*style="[^"]*transform:[^"]*scale\(([^)]+)\)/.exec(html)
    if (m === null || Number.isNaN(Number(m[1])) || !Number.isFinite(Number(m[1]))) {
      errors.push('sprite transform 非法（scale 非有限数——尺寸/flip 可能回归）')
    }
  }
  return { errors, stageHasSprite }
}

// Use real-time CDP rather than virtual-time DOM dumping: the permanent SSE
// connection prevents network-idle completion. Wait for assets and the first state response.
async function dump() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-allow-origins=*', `--user-data-dir=${PROFILE_DIR}`, `--remote-debugging-port=${DEBUG_PORT}`, '--window-size=1280,800', URL], { stdio: 'ignore' })
  let ws
  for (let i = 0; i < 40; i++) {
    await sleep(500)
    try {
      const tabs = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json()
      const page = tabs.find((t) => t.type === 'page')
      if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break }
    } catch { /* Chrome is not ready yet; retry. */ }
  }
  if (!ws) { chrome.kill(); return '' }
  await new Promise((r) => { ws.onopen = r })
  let id = 0
  const call = (method, params) => new Promise((resolve) => {
    const myId = ++id
    const onMsg = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id === myId) { ws.removeEventListener('message', onMsg); resolve(m.result) }
    }
    ws.addEventListener('message', onMsg)
    ws.send(JSON.stringify({ id: myId, method, params }))
  })
  await call('Runtime.enable')
  // Wait for client apply, assets, and the first state response; SSE does not block rendering.
  await sleep(3500)
  const r = await call('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true })
  chrome.kill()
  return typeof r?.result?.value === 'string' ? r.result.value : ''
}

// Allow up to three snapshots for variable real-time resource loading.
let last = null
for (let attempt = 1; attempt <= 3; attempt++) {
  last = analyze(await dump())
  if (last.errors.length === 0) break
  if (attempt < 3) console.error(`[verify-client-smoke] 第 ${attempt} 次 dump 未绿，重试…`)
}
if (last.errors.length > 0) {
  for (const e of last.errors) console.error(`[verify-client-smoke] ${e}`)
  process.exit(1)
}
console.log('[verify-client-smoke] OK：client apply 成功，宠物以 sprite 渲染')
// Close the CDP WebSocket explicitly so a successful probe can exit.
process.exit(0)
