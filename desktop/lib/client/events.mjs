import { EventEmitter } from "node:events";
const DEFAULT_RETRY_MS = 3e3;
const HEARTBEAT_GUARD_MS = 9e4;
function findBlockBoundary(buffer) {
  const lf = buffer.indexOf("\n\n");
  const crlf = buffer.indexOf("\r\n\r\n");
  if (lf === -1) return crlf;
  if (crlf === -1) return lf;
  return Math.min(lf, crlf);
}
function createSSEClient(url, { retryMs = DEFAULT_RETRY_MS, signal } = {}) {
  const em = new EventEmitter();
  let controller = null;
  let closed = false;
  let retry = Number(retryMs) || DEFAULT_RETRY_MS;
  let lastPingAt = 0;
  async function streamOnce() {
    if (closed) return;
    controller = new AbortController();
    const abort = () => controller.abort();
    if (signal) {
      if (signal.aborted) {
        close();
        return;
      }
      signal.addEventListener("abort", abort, { once: true });
    }
    try {
      const res = await fetch(url, {
        headers: { accept: "text/event-stream" },
        signal: controller.signal
      });
      if (!res.ok || !res.body) {
        throw new Error(`SSE connect HTTP ${res.status}`);
      }
      em.emit("open");
      lastPingAt = Date.now();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (!closed && !controller.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep;
        while ((sep = findBlockBoundary(buffer)) !== -1) {
          const raw = buffer.slice(0, sep);
          buffer = buffer.slice(sep + (buffer[sep] === "\r" ? 4 : 2));
          handleChunk(raw);
        }
      }
    } catch (err) {
      if (closed || controller.signal.aborted) return;
      em.emit("error", err);
    } finally {
      if (signal) signal.removeEventListener("abort", abort);
      if (!closed) scheduleReconnect();
    }
  }
  function handleChunk(raw) {
    const dataLines = [];
    for (const line of raw.split("\n")) {
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      } else if (line.startsWith(":")) {
      } else if (line.startsWith("retry:")) {
        const v = Number(line.slice(6).trim());
        if (Number.isFinite(v) && v > 0) retry = v;
      }
    }
    lastPingAt = Date.now();
    if (dataLines.length) {
      const payload = dataLines.join("\n");
      em.emit("event", payload);
    }
  }
  let reconnectTimer = null;
  function scheduleReconnect() {
    if (closed) return;
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (closed) return;
      em.emit("reconnect");
      streamOnce();
    }, retry);
  }
  const guard = setInterval(() => {
    if (closed) return;
    if (Date.now() - lastPingAt > HEARTBEAT_GUARD_MS) {
      controller?.abort();
    }
  }, Math.min(3e4, HEARTBEAT_GUARD_MS));
  function close() {
    closed = true;
    clearInterval(guard);
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    controller?.abort();
    em.emit("close");
  }
  streamOnce();
  return { events: em, close };
}
export {
  createSSEClient
};
