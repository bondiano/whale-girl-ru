// Pure per-session activity views backing GET /whale-girl/sessions, without host dependencies.
// Input follows the host session/event shape { type, seq, time, data }, as defined by @deepseek-ai/dsh-session.
// The event discriminator is type, shared with session-events.ts.
// Activity is thinking, tool:<name>, waiting for approval, or done; desktop clients may label shell tools specially.
// turn/start enters thinking; tool/call records its tool; turn/end enters waiting only for reason.kind === 'blocked', otherwise done.
// session/title changes only the title. Invalid or unrelated events return null.
// applySessionView is immutable and preserves the original reference when nothing changes.
/** Derive an activity or title change from one host session/event value. */
export function parseSessionEvent(value) {
    const event = value;
    if (event === null || typeof event !== 'object')
        return null;
    const type = typeof event.type === 'string' ? event.type : null;
    const data = typeof event.data === 'object' && event.data !== null ? event.data : null;
    if (type === 'turn/start')
        return { kind: 'activity', value: 'thinking' };
    if (type === 'tool/call') {
        const name = data !== null && typeof data.name === 'string' ? data.name : null;
        if (name === null || name === '')
            return null;
        return { kind: 'activity', value: `tool:${name}` };
    }
    if (type === 'turn/end') {
        const reason = data !== null ? data.reason : null;
        const blocked = typeof reason === 'object' && reason !== null && 'kind' in reason && reason.kind === 'blocked';
        return { kind: 'activity', value: blocked ? 'waiting' : 'done' };
    }
    if (type === 'session/title') {
        const title = data !== null && typeof data.title === 'string' ? data.title : null;
        if (title === null || title === '')
            return null;
        return { kind: 'title', value: title };
    }
    return null;
}
/** Create a { id, title, activity, since } session view; since is a Unix-epoch millisecond timestamp. */
export function createSessionView(id, since) {
    return { id, title: null, activity: 'done', since };
}
/** Apply a session event immutably; return the original view when unchanged. */
export function applySessionView(view, event) {
    const parsed = parseSessionEvent(event);
    if (parsed === null)
        return view;
    if (parsed.kind === 'title') {
        if (parsed.value === view.title)
            return view;
        return { ...view, title: parsed.value };
    }
    if (parsed.value === view.activity)
        return view;
    return { ...view, activity: parsed.value };
}
/** Read the last nonempty session/title event from a session log. */
export function titleFromLog(events) {
    if (!Array.isArray(events))
        return null;
    let title = null;
    for (const event of events) {
        const parsed = parseSessionEvent(event);
        if (parsed !== null && parsed.kind === 'title')
            title = parsed.value;
    }
    return title;
}
/**
 * Apply additive turn timing immutably, preserving unrelated fields.
 * turn/start sets turnStartedAt and clears toolCalls; tool/call increments toolCalls and records lastTool.
 * turn/end appends its duration to recentTurnMs, retaining the last five samples.
 * Unrelated events return the original view; now is Unix-epoch milliseconds.
 */
export function applySessionTiming(view, value, now) {
    const event = value;
    if (view === null || typeof view !== 'object')
        return view;
    if (event === null || typeof event !== 'object')
        return view;
    const type = typeof event.type === 'string' ? event.type : null;
    const at = Number.isFinite(now) ? now : Date.now();
    if (type === 'turn/start') {
        return { ...view, turnStartedAt: at, toolCalls: 0 };
    }
    if (type === 'tool/call') {
        const data = typeof event.data === 'object' && event.data !== null ? event.data : null;
        const name = data !== null && typeof data.name === 'string' ? data.name : null;
        const next = { ...view, toolCalls: (Number.isInteger(view.toolCalls) ? view.toolCalls : 0) + 1 };
        if (name !== null && name !== '')
            next.lastTool = name;
        return next;
    }
    if (type === 'turn/end') {
        const started = Number.isFinite(view.turnStartedAt) ? view.turnStartedAt : null;
        if (started === null)
            return view;
        const duration = Math.max(0, at - started);
        const recent = Array.isArray(view.recentTurnMs) ? view.recentTurnMs : [];
        return { ...view, recentTurnMs: [...recent, duration].slice(-5), turnStartedAt: 0 };
    }
    return view;
}
