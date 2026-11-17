const ROUTE_PREFIX = "/whale-girl";
function ROUTE(path) {
  return `${ROUTE_PREFIX}${path}`;
}
function createLogger({ quiet = false, tag = "whale-girl-desktop" } = {}) {
  const ts = () => (/* @__PURE__ */ new Date()).toLocaleTimeString("zh-CN", { hour12: false });
  const write = (level, ...args) => {
    if (quiet && level === "debug") return;
    console.log(`[${ts()}] [${tag}] [${level}]`, ...args);
  };
  return {
    info: (...a) => write("info", ...a),
    debug: (...a) => write("debug", ...a),
    warn: (...a) => write("warn", ...a),
    error: (...a) => write("error", ...a)
  };
}
export {
  ROUTE,
  ROUTE_PREFIX,
  createLogger
};
