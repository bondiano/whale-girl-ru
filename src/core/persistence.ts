// Pure pet-ledger normalization and serialization; the backend entry owns file I/O.
// normalizeState merges INITIAL_STATE and tolerates field-level numeric, array, and title corruption
// from edited or older files. Invalid state returns null so the host can use its initial state.
// serializeState returns JSON text.
import type { PetState } from './pet-state.js'
import { INITIAL_STATE, levelFor, MEMORY_MAX, TITLES } from './pet-state.js'

const KNOWN_TITLES = new Set(TITLES.map((t) => t.id))

/** Safe XP cap for corrupt or edited files; far above realistic totals and bounded for constant-time levelFor. */
export const XP_CAP = 1e12

function num(v: unknown) {
  return typeof v === 'number' && Number.isFinite(v) ? v : NaN
}

function int(v: unknown, lo = 0) {
  const n = num(v)
  return Number.isFinite(n) ? Math.max(lo, Math.floor(n)) : lo
}

/** Normalize saved state; invalid input returns null. */
export function normalizeState(value: unknown): PetState | null {
  const saved = value as Record<string, unknown> | null
  if (typeof saved !== 'object' || saved === null) return null
  const xpRaw = num(saved.xp)
  if (!Number.isFinite(xpRaw)) return null
  // Cap and round edited or corrupt XP values to a safe integer.
  const xp = Math.max(0, Math.floor(Math.min(xpRaw, XP_CAP)))
  // Merge INITIAL_STATE.stats so new fields survive loading older files.
  const savedStats = saved.stats as Record<string, unknown> | undefined
  const stats = {
    ...INITIAL_STATE.stats,
    tasksDone: int(savedStats?.tasksDone),
    failures: int(savedStats?.failures),
    sessions: int(savedStats?.sessions),
    activeMs: num(savedStats?.activeMs) > 0 ? num(savedStats?.activeMs) : 0,
    firstSeenAt: num(savedStats?.firstSeenAt) || null,
  }
  const titles = [...new Set(Array.isArray(saved.titles)
    ? saved.titles.filter((t) => typeof t === 'string' && KNOWN_TITLES.has(t))
    : [])]
  const memory = Array.isArray(saved.memory)
    ? saved.memory.filter((m) => typeof m === 'string').slice(-MEMORY_MAX)
    : []
  const updatedAt = num(saved.updatedAt)
  // Recompute level from XP to reject inconsistent hand-edited values.
  return {
    ...INITIAL_STATE,
    xp,
    level: levelFor(xp),
    stats,
    titles,
    memory,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
  }
}

/** Serialize state to JSON text. */
export function serializeState(state: PetState) {
  return JSON.stringify(state)
}
