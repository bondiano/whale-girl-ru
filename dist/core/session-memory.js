// Pure local session memory, with no host dependencies or I/O.
// The separate data/whale-girl/sessions.json ledger maps session IDs to parent/title/subagent metadata, timestamps, and tasks;
// its lifecycle and recovery behavior are independent of the pet state.json ledger in persistence.ts.
// User and subagent sessions have independent SESSIONS_MAX and SUBAGENT_SESSIONS_MAX budgets, evicted by at.
// Subagents never announce recalls and cannot crowd user sessions out of memory.
// Fork lineage follows header.parentSession to the nearest ancestor with tasks; missing ancestors return null without guessing.
// Settled jobs use their exact owner; ownerless jobs use the most recently active user session, or are skipped if none exists.
// Normalization tolerates older or edited fields and caps sessions, tasks, and labels; corrupt input becomes an empty ledger.
// These records remain local: they never enter model context, session logs, or network requests.
// Tests: tests/session-memory.test.mjs.
/** Maximum retained user sessions; evict oldest at timestamps beyond this limit. */
export const SESSIONS_MAX = 64;
/** Separate subagent-session budget: subagents never announce recalls and cannot consume the user-session budget, even during large delegations. */
export const SUBAGENT_SESSIONS_MAX = 16;
/** Maximum tasks retained per session, newest last in a bounded buffer. */
export const TASKS_MAX = 8;
/** Maximum task-label length; cap host or edited labels before they can overfill bubbles. */
export const LABEL_MAX = 160;
/** Maximum session-title length. */
export const TITLE_MAX = 120;
/** Maximum lineage hops, bounding malformed cycles in edited files. */
export const LINEAGE_HOPS_MAX = 8;
/** Create an empty session-memory ledger. */
export function emptySessionMemory() {
    return { sessions: {} };
}
function str(v, max) {
    if (typeof v !== 'string' || v === '')
        return null;
    const text = v.trim();
    if (text === '')
        return null;
    return text.length > max ? text.slice(0, max) : text;
}
function num(v) {
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
/** Normalize { label, ok, at }; discard tasks without a label or finite timestamp. */
function normalizeTask(value) {
    const raw = value;
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
        return null;
    const label = str(raw.label, LABEL_MAX);
    const at = num(raw.at);
    if (label === null || at === null)
        return null;
    return { label, ok: raw.ok !== false, at };
}
/** Normalize session metadata and tasks; the session ID remains the ledger key. Discard invalid entries. */
function normalizeEntry(value) {
    const raw = value;
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
        return null;
    const at = num(raw.at);
    if (at === null)
        return null;
    const tasks = (Array.isArray(raw.tasks) ? raw.tasks : [])
        .map(normalizeTask)
        .filter((task) => task !== null)
        .slice(-TASKS_MAX);
    const parent = str(raw.parent, 128);
    const title = str(raw.title, TITLE_MAX);
    return {
        ...(parent === null ? {} : { parent }),
        ...(title === null ? {} : { title }),
        ...(raw.subagent === true ? { subagent: true } : {}),
        at,
        tasks,
    };
}
/** Normalize saved memory; invalid input becomes an empty ledger without blocking the plugin. */
export function normalizeSessionMemory(value) {
    const saved = value;
    if (saved === null || typeof saved !== 'object' || Array.isArray(saved))
        return emptySessionMemory();
    const raw = saved.sessions;
    const entries = {};
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
        for (const [id, value] of Object.entries(raw)) {
            if (typeof id !== 'string' || id === '')
                continue;
            const entry = normalizeEntry(value);
            if (entry !== null)
                entries[id] = entry;
        }
    }
    return { sessions: pruneSessions(entries) };
}
/**
 * Evict user and subagent sessions independently by timestamp; subagents cannot evict users.
 * Newly written sessions have the newest at value. Return the original record when no eviction is needed.
 */
function pruneSessions(entries) {
    const users = [];
    const subagents = [];
    for (const id of Object.keys(entries))
        (entries[id].subagent === true ? subagents : users).push(id);
    const within = (ids, max) => (ids.length <= max
        ? ids
        : [...ids].sort((a, b) => entries[b].at - entries[a].at).slice(0, max));
    const kept = [...within(users, SESSIONS_MAX), ...within(subagents, SUBAGENT_SESSIONS_MAX)];
    if (kept.length === Object.keys(entries).length)
        return entries;
    return Object.fromEntries(kept.map((id) => [id, entries[id]]));
}
/** Serialize the session-memory ledger to JSON text. */
export function serializeSessionMemory(memory) {
    return JSON.stringify(memory);
}
/**
 * Observe a session: refresh parent/title metadata and at while preserving existing tasks.
 * Once true, subagent stays true: session origin is fixed at creation and must not migrate into the user budget.
 */
export function observeSession(memory, obs) {
    if (typeof obs?.id !== 'string' || obs.id === '' || num(obs.at) === null)
        return memory;
    const existing = memory.sessions[obs.id];
    const parent = str(obs.parent, 128);
    const title = str(obs.title, TITLE_MAX);
    const subagent = obs.subagent === true || existing?.subagent === true;
    const entry = {
        ...(parent === null ? (existing?.parent === undefined ? {} : { parent: existing.parent }) : { parent }),
        ...(title === null ? (existing?.title === undefined ? {} : { title: existing.title }) : { title }),
        ...(subagent ? { subagent: true } : {}),
        at: obs.at,
        tasks: existing?.tasks ?? [],
    };
    return { sessions: pruneSessions({ ...memory.sessions, [obs.id]: entry }) };
}
/**
 * Record a settled task, creating the session entry when necessary; lineage/title can be filled on later observation.
 * Keep at most TASKS_MAX tasks per session by dropping the oldest.
 */
export function recordTask(memory, sessionId, task) {
    if (typeof sessionId !== 'string' || sessionId === '')
        return memory;
    const normalized = normalizeTask(task);
    if (normalized === null)
        return memory;
    const existing = memory.sessions[sessionId] ?? { at: normalized.at, tasks: [] };
    const tasks = [...existing.tasks, normalized].slice(-TASKS_MAX);
    return { sessions: pruneSessions({ ...memory.sessions, [sessionId]: { ...existing, at: normalized.at, tasks } }) };
}
/**
 * Whether agent/created should announce recalled memory.
 * Internal subagent creation must not repeatedly trigger reunion bubbles during delegation.
 * Only user sessions announce recall; subagent lineage and task ownership are still recorded.
 */
export function recallable(header) {
    if (header === null || typeof header !== 'object')
        return true;
    return !('origin' in header) || header.origin !== 'subagent';
}
/**
 * Follow sessionId and its parent chain to the nearest session with tasks.
 * A resumed session can recall itself; an empty fork can recall an ancestor.
 * Return null for missing entries, exhausted lineage, hop limits, or cycles; never guess.
 */
export function memoryFor(memory, sessionId) {
    if (typeof sessionId !== 'string' || sessionId === '')
        return null;
    const seen = new Set();
    let current = sessionId;
    for (let hop = 0; hop <= LINEAGE_HOPS_MAX; hop += 1) {
        if (current === null || seen.has(current))
            return null;
        seen.add(current);
        const entry = memory.sessions[current];
        if (entry === undefined)
            return null;
        if (entry.tasks.length > 0) {
            return { sessionId: current, title: entry.title ?? null, tasks: [...entry.tasks], distance: hop };
        }
        current = entry.parent ?? null;
    }
    return null;
}
/** Build the /state memory snapshot from bubble fields plus recall time; the caller owns its visibility window. */
export function memorySnapshot(found, nowMs) {
    if (found === null)
        return null;
    return { at: nowMs, distance: found.distance, title: found.title, tasks: found.tasks };
}
