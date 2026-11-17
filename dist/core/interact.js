// Pure /interact dispatch and cross-origin checks, without host dependencies.
// applyAction(state, action, replies) returns { status, body } and owns action error semantics.
// Feeding and playing leave state unchanged; the client displays a short work or programming prompt.
// Missing or empty configured reply pools use the authoritative config defaults.
// isCrossOrigin checks Sec-Fetch-Site first, then Origin; absent headers are treated as same-origin.
import { DEFAULTS } from './config.js';
/** Return an interaction result without changing state; replies contains feed/play string pools. */
export function applyAction(state, action, replies = null) {
    if (action === 'feed' || action === 'play') {
        const pool = (replies?.[action]?.length ?? 0) > 0 ? replies[action] : DEFAULTS.replies[action];
        return {
            status: 200,
            body: { pet: state, reply: pool[Math.floor(Math.random() * pool.length)] },
        };
    }
    return { status: 400, body: { error: `unknown action "${action}"; expected "feed" or "play"` } };
}
/** Return true for a cross-origin request that must be rejected for CSRF protection. */
export function isCrossOrigin(headers, host) {
    const site = headers['sec-fetch-site'];
    if (site !== undefined)
        return site !== 'same-origin' && site !== 'none';
    const origin = headers['origin'];
    if (origin !== undefined) {
        try {
            return new URL(typeof origin === 'string' ? origin : String(origin)).host !== host;
        }
        catch {
            return true;
        }
    }
    return false;
}
