import { ROUTE } from "./utils.mjs";
function createClient({ baseURL, routePrefix = "/whale-girl" }) {
  const url = (path) => new URL(`${routePrefix}${path}`, baseURL).toString();
  async function request(method, path, body, { signal } = {}) {
    const res = await fetch(url(path), {
      method,
      headers: body !== void 0 ? { "content-type": "application/json" } : { accept: "application/json" },
      body: body !== void 0 ? JSON.stringify(body) : void 0,
      signal
    });
    if (!res.ok) {
      const err = new Error(`whale-girl ${method} ${path} \u2192 HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }
  return {
    baseURL,
    url,
    /** GET /state → { apiVersion, pet, activity, configRevision, companionOnline } */
    getState: () => request("GET", "/state"),
    /** GET /config → { config, revision } */
    getConfig: () => request("GET", "/config"),
    /** GET /sessions → Array<{ id, title, activity, since }> */
    getSessions: () => request("GET", "/sessions"),
    /** Fetch character, state, and frame configuration from the asset manifest. */
    getManifest: () => request("GET", "/assets/manifest.json"),
    /**
     * Update presence.
     * @param {boolean} online true renews presence; false goes offline immediately.
     * @param {{signal?: AbortSignal}} [opts] Optional shutdown timeout signal.
     */
    setPresence: (online = true, opts = {}) => request("POST", "/presence", { online }, opts),
    /**
     * Submit an interaction and receive { pet, reply }.
     * @param {'feed'|'play'} action Enjoyment-only interaction, without direct ledger mutation.
     */
    interact: (action = "feed") => request("POST", "/interact", { action })
  };
}
export {
  ROUTE,
  createClient
};
