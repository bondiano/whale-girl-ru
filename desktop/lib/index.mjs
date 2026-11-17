#!/usr/bin/env node
import { loadConfig } from "./src/config.mjs";
import { createLogger } from "./client/utils.mjs";
const cfg = loadConfig();
const log = createLogger({ tag: "whale-girl-desktop" });
const isElectronMain = typeof process !== "undefined" && process.versions?.electron !== void 0;
const headless = !cfg.renderEnabled || process.argv.includes("--headless");
const renderJson = process.argv.includes("--render-json");
if (renderJson) {
  const origLog = console.log.bind(console);
  console.log = (...args) => process.stderr.write(`${args.join(" ")}
`);
  const { createCompanion } = await import("./client/companion.mjs");
  const out = (obj) => process.stdout.write(`${JSON.stringify(obj)}
`);
  const companion = await createCompanion(cfg, {
    onSnapshot: (snap) => out({ type: "snapshot", snapshot: snap }),
    onAnimation: (anim) => out({ type: "anim", name: anim.name, context: anim.context }),
    onReply: (reply) => out({ type: "reply", reply })
  });
  out({ type: "ready", baseURL: cfg.baseURL });
  let buf = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    buf += chunk;
    let nl;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        const cmd = JSON.parse(line);
        if (cmd.type === "interact") companion.interact(cmd.action ?? "feed");
        else if (cmd.type === "stop") companion.stop().then(() => process.exit(0));
      } catch {
      }
    }
  });
  const shutdown = () => companion.stop().then(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.stdout.on("error", (err) => {
    if (err.code === "EPIPE") process.exit(0);
  });
} else if (isElectronMain && !headless) {
  const { runDesktop } = await import("./render/window.mjs");
  process.nextTick(() => {
    runDesktop({ cfg, log }).catch((err) => {
      try {
        log.error("\u684C\u9762\u6E32\u67D3\u542F\u52A8\u5931\u8D25:", err?.message ?? err);
      } catch {
      }
      process.exit(1);
    });
  });
} else {
  const { createCompanion } = await import("./client/companion.mjs");
  const companion = await createCompanion(cfg, {
    onSnapshot: (snap) => {
      const act = snap?.activity?.name ?? "?";
      const lv = snap?.pet?.level ?? "?";
      const online = snap?.companionOnline === true;
      log.info(`state: activity=${act} Lv.${lv} companionOnline=${online}`);
    },
    onAnimation: (anim) => log.debug(`anim \u2192 ${anim.name}`),
    onReply: (reply) => log.info(`reply: ${reply}`)
  });
  log.info(`headless \u6A21\u5F0F\u8FD0\u884C\u4E2D\uFF1ABaseURL=${cfg.baseURL} pollMs=${cfg.pollMs} heartbeatMs=${cfg.heartbeatMs}`);
  log.info("\u6309 Ctrl+C \u9000\u51FA\uFF08\u9000\u51FA\u65F6\u81EA\u52A8\u53D1\u9001 {online:false}\uFF09");
  const shutdown = () => {
    companion.stop().then(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("unhandledRejection", (err) => log.warn("unhandled rejection:", err?.message ?? err));
}
