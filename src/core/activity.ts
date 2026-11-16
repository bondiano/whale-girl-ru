// Pure activity derivation from task snapshots; no host dependencies.
// The host supplies owned and unowned tasks, the previous status map, and wasWorking.
// Returns working, burst, completed/failed task IDs, known, and wasWorking.
// A burst is null or { name: 'celebrate' | 'error', until }; the host records completion XP and failure counts without penalties.

export interface ActivityBurst { name: 'celebrate' | 'error'; until: number }
export interface TaskActivity { id: string; status: string }

export const BURST_MS = 6000

function betterBurst(a: ActivityBurst | null, b: ActivityBurst): ActivityBurst {
  if (a === null) return b
  return b.until > a.until ? b : a
}

/**
 * Merge event-driven and derived celebration windows by the later deadline, without adding durations.
 * An error burst has priority over a concurrent celebration; the host also maintains its separate error cascade.
 * @param burst Derived burst, or null.
 * @param celebrateUntil Host-owned event celebration deadline.
 * @param nowMs Current time.
 * @returns The merged burst.
 */
export function mergeCelebrate(burst: ActivityBurst | null, celebrateUntil: number, nowMs: number): ActivityBurst | null {
  if (celebrateUntil <= nowMs) return burst
  if (burst !== null && burst.name === 'error') return burst
  if (burst === null || celebrateUntil > burst.until) return { name: 'celebrate', until: celebrateUntil }
  return burst
}

/**
 * Derive activity from task snapshots.
 * errorMs controls the failure burst duration; defaults to BURST_MS and may match the host's shorter error window.
 */
export function deriveActivity({ tasks, nowMs, known = new Map(), wasWorking = false, errorMs = BURST_MS }: { tasks: readonly TaskActivity[]; nowMs: number; known?: Map<string, string>; wasWorking?: boolean; errorMs?: number }) {
  // Clear stale task tracking when no tasks remain; there are no transitions to preserve and wasWorking becomes false.
  if (tasks.length === 0) known.clear()
  const running = tasks.filter((t) => t.status === 'running' || t.status === 'stopping')
  const working = running.length > 0
  let burst: ActivityBurst | null = null
  const completed = []
  const failed = []
  let sawKill = false
  for (const t of tasks) {
    const prev = known.get(t.id)
    if (prev === 'running' && t.status === 'completed') {
      completed.push(t.id)
      burst = betterBurst(burst, { name: 'celebrate', until: nowMs + BURST_MS })
    } else if (prev === 'running' && t.status === 'failed') {
      failed.push(t.id)
      burst = betterBurst(burst, { name: 'error', until: nowMs + errorMs })
    } else if (prev === 'running' && t.status === 'killed') {
      sawKill = true
    }
    known.set(t.id, t.status)
  }
  // Disappearing tasks count as completed because lists may retain only active tasks.
  // A running-to-killed transition is neutral: cancellation must not produce a completion celebration.
  if (wasWorking && !working && !sawKill) {
    burst = betterBurst(burst, { name: 'celebrate', until: nowMs + BURST_MS })
  }
  // Prune known to current task IDs even when terminal unowned tasks remain in the list, preventing unbounded growth.
  if (tasks.length > 0) {
    const ids = new Set(tasks.map((t) => t.id))
    for (const key of known.keys()) if (!ids.has(key)) known.delete(key)
  }
  return { working, burst, completed, failed, known, wasWorking: working }
}
