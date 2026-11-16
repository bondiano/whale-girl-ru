// Lightweight pet-service publish/subscribe boundary for other plugins, without host dependencies.
// subscribe(fn) returns an unsubscribe function; emit(signal, payload) notifies subscribers.
// Subscriber exceptions are isolated from other listeners and from the pet.
export type SignalListener = (signal: string, payload: Record<string, unknown>) => void

export function createSignals() {
  const listeners = new Set<SignalListener>()
  return {
    /** Subscribe fn(signal, payload); return an unsubscribe function. */
    subscribe(fn: SignalListener) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    /** Broadcast a signal while isolating individual subscriber exceptions. */
    emit(signal: string, payload: Record<string, unknown> = {}) {
      // Snapshot subscribers so mutations during emission affect the next signal.
      const current = [...listeners]
      for (const fn of current) {
        try {
          fn(signal, payload)
        } catch {
          // Isolate a failing subscriber.
        }
      }
    },
    /** Current subscriber count for tests and diagnostics. */
    size() {
      return listeners.size
    },
  }
}
