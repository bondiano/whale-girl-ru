export function createSignals() {
    const listeners = new Set();
    return {
        /** Subscribe fn(signal, payload); return an unsubscribe function. */
        subscribe(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        /** Broadcast a signal while isolating individual subscriber exceptions. */
        emit(signal, payload = {}) {
            // Snapshot subscribers so mutations during emission affect the next signal.
            const current = [...listeners];
            for (const fn of current) {
                try {
                    fn(signal, payload);
                }
                catch {
                    // Isolate a failing subscriber.
                }
            }
        },
        /** Current subscriber count for tests and diagnostics. */
        size() {
            return listeners.size;
        },
    };
}
