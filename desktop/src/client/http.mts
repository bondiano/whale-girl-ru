// Native-fetch HTTP client for pet reads plus interact/presence writes.
// Local requests without Origin/Sec-Fetch-Site follow the host's same-origin contract.
// Network and HTTP errors throw with status so callers can distinguish failures.

import { ROUTE } from './utils.mjs'

/**
 * Create a pet HTTP client bound to one base URL.
 * @param {{ baseURL: string, routePrefix?: string, pollMs?: number }} opts
 */
export function createClient({ baseURL, routePrefix = '/whale-girl' }) {
  const url = (path) => new URL(`${routePrefix}${path}`, baseURL).toString()

  async function request(method, path, body, { signal } = {}) {
    const res = await fetch(url(path), {
      method,
      headers: body !== undefined
        ? { 'content-type': 'application/json' }
        : { accept: 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
    if (!res.ok) {
      const err = new Error(`whale-girl ${method} ${path} → HTTP ${res.status}`)
      err.status = res.status
      throw err
    }
    return res.json()
  }

  return {
    baseURL,
    url,

    /** GET /state → { apiVersion, pet, activity, configRevision, companionOnline } */
    getState: () => request('GET', '/state'),

    /** GET /config → { config, revision } */
    getConfig: () => request('GET', '/config'),

    /** GET /sessions → Array<{ id, title, activity, since }> */
    getSessions: () => request('GET', '/sessions'),

    /** Fetch character, state, and frame configuration from the asset manifest. */
    getManifest: () => request('GET', '/assets/manifest.json'),

    /**
     * Update presence.
     * @param {boolean} online true renews presence; false goes offline immediately.
     * @param {{signal?: AbortSignal}} [opts] Optional shutdown timeout signal.
     */
    setPresence: (online = true, opts = {}) => request('POST', '/presence', { online }, opts),

    /**
     * Submit an interaction and receive { pet, reply }.
     * @param {'feed'|'play'} action Enjoyment-only interaction, without direct ledger mutation.
     */
    interact: (action = 'feed') => request('POST', '/interact', { action }),
  }
}

export { ROUTE }
