// Electron main-process shell owns the transparent, frameless, always-on-top window.
// The companion engine sends animation/snapshot/reply data through IPC.
// Rendering has no network access: main fetches assets and supplies data URLs.
// Shutdown goes offline explicitly to restore the web pet.
// Canvas alpha bounds determine pointer passthrough around transparent sprite regions.

import { app, BrowserWindow, ipcMain } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '../client/http.mjs'
import { createCompanion } from '../client/companion.mjs'
import { createLogger } from '../client/utils.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RENDER_DIR = join(__dirname, '..', '..', 'render')

const DEFAULT_SIZE = 110

let win = null
let companion = null

/** Create a transparent, always-on-top pet window. */
function createWindow() {
  win = new BrowserWindow({
    width: DEFAULT_SIZE + 40,   // Leave extra room for visual shadow.
    height: DEFAULT_SIZE + 40,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    fullscreenable: false,
    maximizable: false,
    minimizable: false,
    // Load only the local renderer page and local IPC; do not enable remote access.
    webPreferences: {
      preload: join(RENDER_DIR, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // Sandboxed preload uses only contextBridge/ipcRenderer.
      // The renderer has no Node globals and sees only the whaleGirl API.
      sandbox: true,
    },
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.loadFile(join(RENDER_DIR, 'index.html'))

  // Default to pointer passthrough; the renderer reports actual content bounds.
  win.setIgnoreMouseEvents(true, { forward: true })

  win.on('closed', () => { win = null })
  return win
}

/** Main-process renderer bridge loads the manifest and sprite sheets. */
function setupIpc(client) {
  const sheetCache = new Map() // `${characterId}/${sheet}` → dataURL

  ipcMain.handle('wg:manifest', async () => {
    try {
      return await client.getManifest()
    } catch (err) {
      return { error: err.message }
    }
  })

  ipcMain.handle('wg:sheet', async (_e, { characterId = 'whale-girl', sheet }) => {
    const key = `${characterId}/${sheet}`
    if (sheetCache.has(key)) return sheetCache.get(key)
    const url = `${client.url(`/assets/characters/${characterId}/${sheet}`)}`
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      const buf = Buffer.from(await res.arrayBuffer())
      const { nativeImage } = await import('electron')
      const img = nativeImage.createFromBuffer(buf)
      const dataURL = img.toDataURL()
      sheetCache.set(key, dataURL)
      return dataURL
    } catch (err) {
      console.error(`[wg:sheet] ${key} 失败:`, err.message)
      return null
    }
  })

  ipcMain.on('wg:interact', async (_e, action) => {
    if (companion) await companion.interact(action === 'play' ? 'play' : 'feed')
  })

  // Content bounds control pointer passthrough: visible content enables interactions;
  // a null placeholder remains transparent. Exact window shrinking is a separate enhancement.
  ipcMain.on('wg:set-hitarea', (_e, rect) => {
    if (!win) return
    win.setIgnoreMouseEvents(rect === null, { forward: true })
  })

  // Move the desktop window by the renderer's screen-space drag delta.
  ipcMain.on('wg:drag-window', (_e, { dx, dy }) => {
    if (!win) return
    const [x, y] = win.getPosition()
    win.setPosition(x + Math.round(dx), y + Math.round(dy))
  })
}

/** Start the Electron desktop shell. */
export async function runDesktop({ cfg, log }) {
  const client = createClient({ baseURL: cfg.baseURL })

  await app.whenReady()
  log.info('Electron 就绪，创建宠物窗口')
  createWindow()
  setupIpc(client)

  companion = await createCompanion(cfg, {
    onSnapshot: (snap) => {
      if (win) win.webContents.send('wg:snapshot', snap)
    },
    onAnimation: (anim) => {
      if (win) win.webContents.send('wg:anim', anim)
    },
    onReply: (reply) => {
      if (win) win.webContents.send('wg:reply', reply)
    },
  })

  log.info(`桌面渲染运行中：BaseURL=${cfg.baseURL}（在场上线）`)

  const shutdown = async () => {
    if (companion) await companion.stop()
    app.quit()
  }
  app.on('before-quit', (e) => {
    // Keep shutdown idempotent because before-quit may fire repeatedly.
  })
  app.on('window-all-closed', () => {
    // Closing the pet window exits instead of leaving a background process.
    shutdown()
  })
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}