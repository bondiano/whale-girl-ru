// Desktop-companion presence: heartbeat writes and expiration, without host dependencies.
// The external desktop client periodically POSTs { online: true } to /whale-girl/presence.
// After exit or a crash, expiration restores the web pet automatically without a manual toggle.
export const PRESENCE_TTL_MS = 45000 // Heartbeat lifetime; the desktop companion renews every 15 seconds.

/** Return the renewed presence deadline, or zero for immediate offline state. */
export function pokePresence(companionUntil: number, nowMs: number, online = true) {
  return online ? nowMs + PRESENCE_TTL_MS : 0
}

/** Whether the companionUntil deadline still indicates an online desktop companion. */
export function companionOnline(companionUntil: number, nowMs: number) {
  return companionUntil > nowMs
}
