import { createClient } from "./http.mjs";
import { createSSEClient } from "./events.mjs";
import { createLogger } from "./utils.mjs";
import { ROUTE_PREFIX } from "./utils.mjs";
import { createScheduler, stepScheduler, applyInteraction } from "./scheduler.mjs";
import { pickAnimation } from "./state.mjs";
const TICK_MS = 250;
async function createCompanion(opts, hooks = {}) {
  const log = opts.logger ?? createLogger();
  const client = createClient({
    baseURL: opts.baseURL,
    routePrefix: opts.routePrefix ?? ROUTE_PREFIX
  });
  let snapshot = null;
  let remoteConfig = null;
  let anim = { name: "idle", context: {} };
  let stopped = false;
  const sched = createScheduler({ sleepAfterMs: opts.sleepAfterMs });
  let lastConfigRevision = -1;
  const applyRemoteConfig = async () => {
    if (snapshot === null || typeof snapshot.configRevision !== "number") return;
    if (snapshot.configRevision === lastConfigRevision) return;
    lastConfigRevision = snapshot.configRevision;
    try {
      const body = await client.getConfig();
      remoteConfig = body?.config ?? null;
    } catch (err) {
      log.warn("\u62C9\u53D6 /config \u5931\u8D25\uFF08\u4FDD\u6301\u4E0A\u6B21\uFF09:", err.message);
    }
  };
  let lastAnimName = null;
  const computeAnimation = () => {
    const next = pickAnimation(snapshot, sched);
    anim = next;
    if (next.name !== lastAnimName) {
      lastAnimName = next.name;
      hooks.onAnimation?.(next);
    }
    hooks.onTick?.(next, sched);
    return next;
  };
  let refreshing = false;
  let pendingRefresh = false;
  const refreshState = async () => {
    if (refreshing) {
      pendingRefresh = true;
      return null;
    }
    refreshing = true;
    try {
      do {
        pendingRefresh = false;
        try {
          const body = await client.getState();
          snapshot = body;
          await applyRemoteConfig();
          hooks.onSnapshot?.(snapshot);
          computeAnimation();
          if (!pendingRefresh) return body;
        } catch (err) {
          log.warn("GET /state \u5931\u8D25:", err.message);
          return null;
        }
      } while (pendingRefresh);
      return snapshot;
    } finally {
      refreshing = false;
      pendingRefresh = false;
    }
  };
  let sse = null;
  const startSSE = () => {
    if (opts.eventsEnabled === false) return;
    const url = new URL(`${opts.routePrefix ?? ROUTE_PREFIX}/events`, opts.baseURL).toString();
    sse = createSSEClient(url, { signal: opts.signal });
    sse.events.on("event", () => {
      log.debug("SSE \u4E8B\u4EF6 \u2192 \u7ACB\u5373\u5237\u65B0 /state");
      refreshState();
    });
    sse.events.on("reconnect", () => log.debug("SSE \u91CD\u8FDE"));
    sse.events.on("error", (err) => log.warn("SSE:", err.message));
  };
  const PRESENCE_TIMEOUT_MS = 2e3;
  const sendPresence = async (online) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PRESENCE_TIMEOUT_MS);
    try {
      const body = await client.setPresence(online, { signal: controller.signal });
      return body;
    } catch (err) {
      log.warn(`POST /presence ${online ? "\u4E0A\u7EBF" : "\u4E0B\u7EBF"} \u5931\u8D25:`, err.message);
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
  let heartbeatTimer = null;
  const startHeartbeat = () => {
    if (opts.autoPresence === false) return;
    heartbeatTimer = setInterval(() => sendPresence(true), opts.heartbeatMs);
  };
  if (opts.autoPresence !== false) await sendPresence(true);
  startHeartbeat();
  await refreshState();
  startSSE();
  const pollTimer = setInterval(refreshState, opts.pollMs);
  const tickTimer = setInterval(() => {
    if (stopped) return;
    stepScheduler(sched, { snapshot, now: Date.now() });
    computeAnimation();
  }, TICK_MS);
  const interact = async (action = "feed") => {
    try {
      const body = await client.interact(action);
      applyInteraction(sched, action, Date.now());
      const reply = body?.reply ?? null;
      log.info(`\u4E92\u52A8 ${action}: ${reply ?? ""}`);
      hooks.onReply?.(reply);
      await refreshState();
      computeAnimation();
      return body;
    } catch (err) {
      log.warn(`POST /interact ${action} \u5931\u8D25:`, err.message);
      return null;
    }
  };
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    clearInterval(heartbeatTimer);
    clearInterval(pollTimer);
    clearInterval(tickTimer);
    if (sse) sse.close();
    if (opts.cleanupOnExit !== false) {
      await sendPresence(false);
    }
    log.info("\u4F34\u4FA3\u5DF2\u505C\u6B62\uFF08presence \u5DF2\u4E0B\u7EBF\uFF09");
  };
  return {
    client,
    interact,
    getState: () => snapshot,
    getAnimation: () => anim,
    get scheduler() {
      return sched;
    },
    stop
  };
}
export {
  createCompanion
};
