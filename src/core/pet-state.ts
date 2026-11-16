// Accumulating pet ledger: no decay, penalties, or needs; progress only grows.
// State contains level/XP, stats, unlocked title IDs, recent memory capped at MEMORY_MAX, and updatedAt.
// All updates are immutable event-driven functions returning { state, unlocked, leveledUp }; there is no tick/decay path.
// Titles derive idempotently from stat thresholds. Level derives from the triangular XP curve and must not be assigned independently.

export interface PetStats {
  tasksDone: number
  failures: number
  sessions: number
  activeMs: number
  firstSeenAt: number | null
}
export interface PetState {
  level: number
  xp: number
  stats: PetStats
  titles: string[]
  memory: string[]
  updatedAt: number
}
export interface PetTitle { id: string; name: string; when: (stats: PetStats) => boolean }

export const INITIAL_STATE: Readonly<PetState> = Object.freeze({
  level: 1,
  xp: 0,
  stats: { tasksDone: 0, failures: 0, sessions: 0, activeMs: 0, firstSeenAt: null },
  titles: [],
  memory: [],
  updatedAt: 0,
})

export const MEMORY_MAX = 8
export const TASK_XP = 10
export const SESSION_XP = 5
export const RESUME_XP = 2

/** Cumulative XP needed for a level: triangular sequence L2=50, L3=150, L4=300. */
export function xpForLevel(level: number) {
  return (50 * level * (level - 1)) / 2
}

/** Internal levelFor safety cap: 4*xp/25 must stay finite; practical values are bounded further by persistence XP_CAP. */
const XP_SAFE_MAX = 1e15

/** Derive level from XP with the O(1) inverse triangular formula; large XP must not cause an unbounded loop. */
export function levelFor(xp: number) {
  const xpSafe = Math.max(0, Math.min(xp, XP_SAFE_MAX))
  return Math.floor((1 + Math.sqrt(1 + (4 * xpSafe) / 25)) / 2)
}

/** Closed title definitions; additions must also update the achievement table in docs/growth-system.md. */
export const TITLES: PetTitle[] = [
  { id: 'first-task', name: 'Первое сотрудничество', when: (s) => s.tasksDone >= 1 },
  { id: 'helper', name: 'Трудолюбивый напарник', when: (s) => s.tasksDone >= 20 },
  { id: 'veteran', name: 'Закалён в боях', when: (s) => s.tasksDone >= 100 },
  { id: 'regular', name: 'Постоянный спутник', when: (s) => s.activeMs >= 6 * 3_600_000 },
  { id: 'resilient', name: 'Не сдаётся', when: (s) => s.failures >= 5 },
  { id: 'social', name: 'Душа компании', when: (s) => s.sessions >= 10 },
]

/** Look up a title name; preserve unknown IDs to tolerate older data. */
export function titleName(id: string) {
  return TITLES.find((t) => t.id === id)?.name ?? id
}

function stamp(nowMs: number) {
  const d = new Date(nowMs)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

function truncate(label: string, max = 14) {
  return label.length > max ? `${label.slice(0, max)}…` : label
}

function checkTitles(stats: PetStats, titles: readonly string[]) {
  return TITLES.filter((t) => !titles.includes(t.id) && t.when(stats))
}

/** Commit one event: merge stat changes, add optional XP, derive level/titles, and append recent memory. */
function commit(state: PetState, patch: Partial<PetStats>, nowMs: number, entry: string | null, xpGain = 0) {
  const stats = { ...state.stats, ...patch }
  const xp = state.xp + xpGain
  const level = levelFor(xp)
  const leveledUp = level > state.level
  const unlocked = checkTitles(stats, state.titles)
  const titles = unlocked.length ? [...state.titles, ...unlocked.map((t) => t.id)] : state.titles
  const memory = [...state.memory]
  if (entry) memory.push(`[${stamp(nowMs)}] ${entry}`)
  if (leveledUp) memory.push(`[${stamp(nowMs)}] Новый уровень: ${level} 🎉`)
  return {
    state: { ...state, stats, xp, level, titles, memory: memory.slice(-MEMORY_MAX), updatedAt: nowMs },
    unlocked: unlocked.map((t) => t.name),
    leveledUp,
  }
}

/** Completed task: add TASK_XP and record statistics and memory. */
export function recordTaskCompleted(state: PetState, taskLabel: string, nowMs: number) {
  const n = state.stats.tasksDone + 1
  return commit(state, { tasksDone: n }, nowMs, `Задача «${truncate(taskLabel)}» выполнена (№${n})`, TASK_XP)
}

/** Failed task: record statistics and memory without penalties or lost XP. */
export function recordFailure(state: PetState, nowMs: number) {
  const n = state.stats.failures + 1
  return commit(state, { failures: n }, nowMs, `Задача провалилась (№${n}) — ничего, ещё раз`)
}

/** New startup session: add SESSION_XP, record firstSeenAt, and increment session count. */
export function recordSession(state: PetState, nowMs: number) {
  const n = state.stats.sessions + 1
  return commit(
    state,
    { sessions: n, firstSeenAt: state.stats.firstSeenAt ?? nowMs },
    nowMs,
    `Начата новая сессия (№${n})`,
    SESSION_XP,
  )
}

/** Resume/compact/clear: add RESUME_XP without incrementing sessions or changing firstSeenAt. */
export function recordSessionResume(state: PetState, nowMs: number) {
  return commit(state, {}, nowMs, 'Вернулись в старую сессию — продолжаем вместе', RESUME_XP)
}

/** Cap each active-time increment so the first poll after machine sleep cannot count the whole sleeping interval. */
export const ACTIVE_CAP_MS = 5 * 60_000

/** Accumulate working time on host polls, capped at ACTIVE_CAP_MS per update. */
export function recordActive(state: PetState, elapsedMs: number, nowMs: number) {
  const capped = Math.min(Math.max(0, elapsedMs), ACTIVE_CAP_MS)
  return commit(state, { activeMs: state.stats.activeMs + capped }, nowMs, null)
}
