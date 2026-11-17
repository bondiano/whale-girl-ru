// Single authoritative route prefix, enforced by verify-routes-sync.
// The browser and backend share these endpoints; prefix changes belong only here.
// Do not duplicate literal plugin-route paths elsewhere: drift breaks consumers.
// See 2026-08-10-doc-system-single-source-and-gates.md.
// These dependency-free constants work in the esbuild client bundle and the backend.
export const ROUTE_PREFIX = '/whale-girl';
export const STATE_PATH = `${ROUTE_PREFIX}/state`;
export const INTERACT_PATH = `${ROUTE_PREFIX}/interact`;
export const CONFIG_PATH = `${ROUTE_PREFIX}/config`;
export const ASSETS_PATH = `${ROUTE_PREFIX}/assets`;
export const EVENTS_PATH = `${ROUTE_PREFIX}/events`;
export const PRESENCE_PATH = `${ROUTE_PREFIX}/presence`;
export const SESSIONS_PATH = `${ROUTE_PREFIX}/sessions`;
export const UPDATE_PATH = `${ROUTE_PREFIX}/update`;
export const CHAT_PATH = `${ROUTE_PREFIX}/chat`;
export const VOICE_PATH = `${ROUTE_PREFIX}/voice`;
export const MODELS_PATH = `${ROUTE_PREFIX}/models`;
export const TRANSCRIBE_PATH = `${ROUTE_PREFIX}/transcribe`;
