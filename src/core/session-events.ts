// Pure turn-edge detection from the host SessionEvent shape, without host dependencies.
// Input is the second session/event callback argument: { type, seq, time, data }, as defined by @deepseek-ai/dsh-session.
// The event discriminator is type, not kind; confusing them loses thinking and completion signals.
// See 2026-08-10-session-event-field.md.
// Return null for unrelated or malformed events, otherwise { kind: 'start' | 'end', blocked }.
// Only turn/end with reason.kind === 'blocked' waits for approval/permission; other end reasons are not blocked.
// turn/start always returns blocked: false.

/** Detect the turn edge from one host session/event value; unrelated events return null. */
export function parseTurnEvent(value: unknown): { kind: 'start' | 'end'; blocked: boolean } | null {
  const event = value as { type?: unknown; data?: { reason?: unknown } } | null
  if (event === null || typeof event !== 'object') return null
  const type = typeof event.type === 'string' ? event.type : null
  if (type === 'turn/start') return { kind: 'start', blocked: false }
  if (type === 'turn/end') {
    const reason = typeof event.data === 'object' && event.data !== null ? event.data.reason : null
    const blocked = typeof reason === 'object' && reason !== null && 'kind' in reason && reason.kind === 'blocked'
    return { kind: 'end', blocked }
  }
  return null
}
