// Pure update-row presentation/state machine without React, DOM, or host dependencies.
// deriveUpdateRow({ info, phase, notice, noticeTone, translate, onCheck, onUpdate }: RowInput) maps
// Node check results plus local interaction phase to { status, tone, action: { label, disabled,
// primary, run } }. run already selects check/update; components call action.run() without
// rederiving state. outcomeOf(payload: UpdatePayload | undefined, translate: Translate):
// UpdateResult maps POST /whale-girl/update to { phase, notice, tone }. Host application values are
// applied/restart-required/overridden/failed/cancelled; only applied or restart-required count as
// success. reduceRow(state: UpdateRowState, event: UpdateRowEvent): UpdateRowState owns
// transitions; components only dispatch events rather than separately synchronizing useState values
// and risking mismatched states/colors. Coverage: tests/update-state.test.mjs.
/** Initial update-row state shared by the component and state machine. */
export const ROW_INITIAL = { phase: 'loading', info: undefined, notice: undefined, noticeTone: 'default' };
/**
 * State machine events: check-started, checked, check-failed, update-started, and settled carrying
 * phase/notice/tone.
 */
export function reduceRow(state, event) {
    switch (event?.type) {
        case 'check-started': return { ...state, phase: 'loading', notice: undefined, noticeTone: 'default' };
        case 'checked': return { ...state, phase: 'ready', info: event.info };
        case 'check-failed': return { ...state, phase: 'error' };
        case 'update-started': return { ...state, phase: 'updating', notice: undefined, noticeTone: 'default' };
        case 'settled': return { ...state, phase: event.phase, notice: event.notice, noticeTone: event.tone };
        default: return state;
    }
}
/** Upstream target label: short commit for git installations, version for registry installations. */
function targetOf(info) {
    const latest = info?.latest;
    if (latest === null || typeof latest !== 'object')
        return undefined;
    if (typeof latest.commit === 'string' && latest.commit !== '')
        return latest.commit;
    if (typeof latest.version === 'string' && latest.version !== '')
        return latest.version;
    return undefined;
}
/**
 * Current short git commit. Package-page source information shows only version, so this row is the
 * sole commit display.
 */
function currentOf(info) {
    const commit = info?.current?.commit;
    return typeof commit === 'string' && commit !== '' ? commit : undefined;
}
/** Tracked ref for local-path installations; git/registry installations have none. */
function refOf(info) {
    const ref = info?.latest?.ref;
    return typeof ref === 'string' && ref !== '' ? ref : undefined;
}
/**
 * Status wording includes conclusions (current/update available/unknown) and in-progress phases;
 * buttons name only actions.
 */
function statusOf({ info, phase, notice, target, current, translate: t }) {
    if (typeof notice === 'string' && notice !== '')
        return notice;
    if (phase === 'loading')
        return t('checking');
    if (phase === 'updating')
        return t('updating');
    if (phase === 'error')
        return t('checkFailed');
    if (info?.state === 'up-to-date')
        return current === undefined ? t('latest') : t('latestAt', { current });
    if (info?.state === 'update-available') {
        if (target === undefined)
            return t('updateUnknown');
        // If an update exists but the host lacks package management, explain in the status row and
        // leave only the action name on the button.
        if (info?.canUpdate !== true)
            return t('availableUnsupported', { target });
        const ref = refOf(info);
        // Updating a local-path install replaces link: with upstream tracking; disclose that before the
        // user clicks.
        if (ref !== undefined && current !== undefined)
            return t('availableLocal', { target, current, ref });
        return current === undefined ? t('available', { target }) : t('availableAt', { target, current });
    }
    if (info?.reason === 'rate-limited')
        return t('checkRateLimited');
    if (info?.reason === 'local-source')
        return t('localSource');
    if (info?.reason === 'host-outdated')
        return t('hostOutdated');
    return t('updateUnknown');
}
/**
 * Buttons name actions and select the handler. Already-current, just-updated, and check-failed
 * states retain an enabled Check for Updates... action rather than a disabled conclusion.
 */
function actionOf({ info, phase, target, translate: t, onCheck, onUpdate }) {
    const idle = { label: t('check'), disabled: false, primary: false, run: onCheck };
    if (phase === 'loading')
        return { label: t('checking'), disabled: true, primary: false, run: onCheck };
    if (phase === 'updating')
        return { label: t('updating'), disabled: true, primary: false, run: onCheck };
    if (phase === 'ready' && info?.state === 'update-available' && target !== undefined) {
        const ref = refOf(info);
        const label = ref === undefined ? t('updateTo', { target }) : t('updateToRef', { ref });
        return info?.canUpdate === true
            ? { label, disabled: false, primary: true, run: onUpdate }
            : { label, disabled: true, primary: false, run: onCheck };
    }
    return idle;
}
/**
 * @param {{info?: object, phase: 'loading'|'ready'|'error'|'updating'|'done', notice?: string, noticeTone?: 'default'|'error', translate: (key: string, vars?: object) => string, onCheck: Function, onUpdate: Function}} input
 * @returns {{status: string, tone: 'default'|'error', action: {label: string, disabled: boolean, primary: boolean, run: Function}}}
 */
export function deriveUpdateRow({ info, phase, notice, noticeTone, translate, onCheck, onUpdate }) {
    const target = targetOf(info);
    const current = currentOf(info);
    return {
        status: statusOf({ info, phase, notice, target, current, translate }),
        // Notice tone follows the result: success must not appear as a red error.
        tone: typeof notice === 'string' && notice !== '' && noticeTone === 'error' ? 'error' : 'default',
        action: actionOf({ info, phase, target, translate, onCheck, onUpdate }),
    };
}
/**
 * Map an update result to UI state.
 * @param {{state?: string, application?: string, errorCode?: string, errorDetail?: string}} payload
 * @param {(key: string, vars?: object) => string} translate
 * @returns {{phase: 'done'|'ready', notice: string, tone: 'default'|'error'}}
 */
/** Map plugin-owned error codes to locale keys; host error codes are not exhaustively translated. */
const FAILURE_KEYS = {
    'tracking-not-restored': 'updateFailedTracking',
    'unknown-enabled-state': 'updateFailedEnabled',
    'unsupported-source': 'updateFailedSource',
};
export function outcomeOf(payload, translate) {
    const t = translate;
    switch (payload?.state) {
        case 'restart-required': return { phase: 'done', notice: t('updatedRestart'), tone: 'default' };
        case 'installed': return { phase: 'done', notice: t('updated'), tone: 'default' };
        case 'overridden': return { phase: 'done', notice: t('updatedOverridden'), tone: 'default' };
        case 'unsupported': return { phase: 'ready', notice: t('updateUnsupported'), tone: 'default' };
        case 'up-to-date': return { phase: 'ready', notice: t('latest'), tone: 'default' };
        // An inconclusive check from rate limiting/network is not an update failure; avoid error tone.
        case 'check-failed': return {
            phase: 'ready',
            notice: payload?.errorCode === 'rate-limited' ? t('checkRateLimited') : t('checkFailed'),
            tone: 'default',
        };
        default: {
            const spec = typeof payload?.pinnedSpec === 'string' && payload.pinnedSpec !== '' ? payload.pinnedSpec : undefined;
            if (payload?.errorCode === 'tracking-not-restored' && spec !== undefined) {
                return { phase: 'ready', notice: t('updateFailedTracking', { spec }), tone: 'error' };
            }
            const key = payload?.errorCode === undefined ? undefined : FAILURE_KEYS[payload.errorCode];
            if (key !== undefined)
                return { phase: 'ready', notice: t(key), tone: 'error' };
            // Localize the separator too, avoiding full-width punctuation in English UI.
            const reason = [payload?.errorCode, payload?.errorDetail]
                .filter((part) => typeof part === 'string' && part !== '')
                .join(t('reasonSeparator'));
            return {
                phase: 'ready',
                notice: reason === '' ? t('updateFailed') : t('updateFailedDetail', { reason }),
                tone: 'error',
            };
        }
    }
}
