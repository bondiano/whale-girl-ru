import { app, BrowserWindow, ipcMain } from "electron";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "../client/http.mjs";
import { createCompanion } from "../client/companion.mjs";
const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDER_DIR = join(__dirname, "..", "..", "render");
const DEFAULT_SIZE = 110;
let win = null;
let companion = null;
function createWindow() {
  win = new BrowserWindow({
    width: DEFAULT_SIZE + 40,
    // Leave extra room for visual shadow.
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
      preload: join(RENDER_DIR, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // Sandboxed preload uses only contextBridge/ipcRenderer.
      // The renderer has no Node globals and sees only the whaleGirl API.
      sandbox: true
    }
  });
  win.setAlwaysOnTop(true, "screen-saver");
  win.loadFile(join(RENDER_DIR, "index.html"));
  win.setIgnoreMouseEvents(true, { forward: true });
  win.on("closed", () => {
    win = null;
  });
  return win;
}
function setupIpc(client) {
  const sheetCache = /* @__PURE__ */ new Map();
  ipcMain.handle("wg:manifest", async () => {
    try {
      return await client.getManifest();
    } catch (err) {
      return { error: err.message };
    }
  });
  ipcMain.handle("wg:sheet", async (_e, { characterId = "whale-girl", sheet }) => {
    const key = `${characterId}/${sheet}`;
    if (sheetCache.has(key)) return sheetCache.get(key);
    const url = `${client.url(`/assets/characters/${characterId}/${sheet}`)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      const { nativeImage } = await import("electron");
      const img = nativeImage.createFromBuffer(buf);
      const dataURL = img.toDataURL();
      sheetCache.set(key, dataURL);
      return dataURL;
    } catch (err) {
      console.error(`[wg:sheet] ${key} \u5931\u8D25:`, err.message);
      return null;
    }
  });
  ipcMain.on("wg:interact", async (_e, action) => {
    if (companion) await companion.interact(action === "play" ? "play" : "feed");
  });
  ipcMain.on("wg:set-hitarea", (_e, rect) => {
    if (!win) return;
    win.setIgnoreMouseEvents(rect === null, { forward: true });
  });
  ipcMain.on("wg:drag-window", (_e, { dx, dy }) => {
    if (!win) return;
    const [x, y] = win.getPosition();
    win.setPosition(x + Math.round(dx), y + Math.round(dy));
  });
}
async function runDesktop({ cfg, log }) {
  const client = createClient({ baseURL: cfg.baseURL });
  await app.whenReady();
  log.info("Electron \u5C31\u7EEA\uFF0C\u521B\u5EFA\u5BA0\u7269\u7A97\u53E3");
  createWindow();
  setupIpc(client);
  companion = await createCompanion(cfg, {
    onSnapshot: (snap) => {
      if (win) win.webContents.send("wg:snapshot", snap);
    },
    onAnimation: (anim) => {
      if (win) win.webContents.send("wg:anim", anim);
    },
    onReply: (reply) => {
      if (win) win.webContents.send("wg:reply", reply);
    }
  });
  log.info(`\u684C\u9762\u6E32\u67D3\u8FD0\u884C\u4E2D\uFF1ABaseURL=${cfg.baseURL}\uFF08\u5728\u573A\u4E0A\u7EBF\uFF09`);
  const shutdown = async () => {
    if (companion) await companion.stop();
    app.quit();
  };
  app.on("before-quit", (e) => {
  });
  app.on("window-all-closed", () => {
    shutdown();
  });
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
export {
  runDesktop
};
