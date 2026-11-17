// whale-girl backend: accumulating ledger, asset serving, activity/events, and persistence.
// This is the Cordis backend of the official bundle declared by package.json dsh.bundle/dsh.client; interactions use webServer routes.
// core/routes.ts owns route paths, enforced by verify-routes-sync. Activity is derived and never persisted in the ledger.
// Task completion adds XP, titles, memory, and celebration; failure only increments counts and triggers an error/disappointment window.
// Request errors share the same negative window. New sessions trigger welcome; working time accumulates as activity.
// /interact rejects cross-origin requests and limits bodies to 1 KB; asset sanitization rejects Windows traversal separators.
// State lives in <dshHome>/data/whale-girl/state.json, using same-directory temporary files and atomic rename.
// Event writes debounce for one second; disabling the plugin performs a final flush.
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { synthesizeVoice } from './core/voice-service.js';
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
import { INITIAL_STATE, recordTaskCompleted, recordFailure, recordSession, recordSessionResume, recordActive, } from './core/pet-state.js';
import { emptySessionMemory, normalizeSessionMemory, serializeSessionMemory, observeSession, recordTask, memoryFor, memorySnapshot, recallable, } from './core/session-memory.js';
import { authenticatedWebServer } from './web-route-auth.js';
import { deriveActivity, mergeCelebrate } from './core/activity.js';
import { sanitizeAssetPath, contentTypeFor, ASSETS_PATH } from './core/assets.js';
import { applyAction, isCrossOrigin } from './core/interact.js';
import { parseTurnEvent } from './core/session-events.js';
import { createSessionView, applySessionView, applySessionTiming, titleFromLog } from './core/sessions.js';
import { describeConversation, describeSessions } from './core/session-context.js';
import { fetchHeadlines, formatHeadlines, wantsNews } from './core/news.js';
import { normalizeState, serializeState } from './core/persistence.js';
import { createSignals } from './core/signals.js';
import { buildSchema, readConfig } from './core/config.js';
import { SNAPSHOT_API_VERSION, TURN_COMPLETED_MS, MEMORY_WINDOW_MS, turnCompletionSnapshot } from './core/snapshot.js';
import { pokePresence, companionOnline } from './core/presence.js';
import { parseRepository } from './core/update.js';
import { UPDATE_TIMEOUT_MS, createUpdateHost } from './core/update-host.js';
import { CHAT_TEXT_MAX, appendHistory, bubbleText, buildChatMessages, fallbackReply, normalizeChatText, normalizeReply, personaFor, speechText } from './core/chat.js';
import { STT_MAX_BYTES, STT_TIMEOUT_MS, SUBSCRIPTION_VOICE_ERROR, buildSttRequest, normalizeVoiceText } from './core/voice.js';
export const name = 'whale-girl';
export const inject = ['jobs', 'agents', 'sessions', 'webServer'];
/** Entry Config schema: the host validates config and injects live volatile references before apply. */
export const Config = buildSchema();
// Re-export the established route API from its authoritative core/routes.ts module.
import { STATE_PATH, INTERACT_PATH, CONFIG_PATH, ROUTE_PREFIX, EVENTS_PATH, PRESENCE_PATH, SESSIONS_PATH, UPDATE_PATH, CHAT_PATH, VOICE_PATH, MODELS_PATH, TRANSCRIBE_PATH } from './core/routes.js';
export { STATE_PATH, INTERACT_PATH, CONFIG_PATH, ROUTE_PREFIX, EVENTS_PATH, PRESENCE_PATH, SESSIONS_PATH, UPDATE_PATH, CHAT_PATH, VOICE_PATH, MODELS_PATH, TRANSCRIBE_PATH };
/** Maximum /interact request size; action payloads need only a few bytes. */
export const BODY_LIMIT = 1024;
/** Separate JSON body limit for /chat and /voice text requests. */
export const CHAT_BODY_LIMIT = 4096;
/** Maximum model-response time in milliseconds; stalled providers must not hold a chat request indefinitely. */
export const CHAT_TIMEOUT_MS = 30000;
/** Timeout for listing one provider's models through GET /models. */
export const MODELS_TIMEOUT_MS = 5000;
/** Model-list cache lifetime in milliseconds. */
export const MODELS_CACHE_MS = 60000;
/** Maximum number of model options returned by /models. */
export const MODELS_MAX = 200;
// Transient durations come from DEFAULTS and configRef: errorMs, disappointedMs, welcomeMs, and celebrateMs.
// Do not duplicate module-level timing constants. Defaults are error 4s, disappointment 6s, welcome 6s, celebration 6s.
// Event-driven and polled celebration deadlines merge by max rather than adding durations.
/** State file: <dshHome>/data/whale-girl/state.json, outside the plugin directory so uninstall does not delete it. */
const DSH_HOME = process.env.DSH_HOME ?? resolve(import.meta.dirname, '../../..');
const STATE_FILE = join(DSH_HOME, 'data', 'whale-girl', 'state.json');
/** Session memory file: <dshHome>/data/whale-girl/sessions.json; its toggle does not affect the pet ledger. */
const MEMORY_FILE = join(DSH_HOME, 'data', 'whale-girl', 'sessions.json');
/** Read and normalize saved state; missing or corrupt state returns null. */
function loadState() {
    try {
        return normalizeState(JSON.parse(readFileSync(STATE_FILE, 'utf8')));
    }
    catch {
        return null;
    }
}
/** Write atomically with a same-directory temporary file and rename; persistence errors do not block the plugin. */
function saveState(next) {
    try {
        mkdirSync(dirname(STATE_FILE), { recursive: true });
        const tmp = `${STATE_FILE}.tmp`;
        writeFileSync(tmp, serializeState(next));
        renameSync(tmp, STATE_FILE);
    }
    catch {
        // If persistence fails, state remains usable for the current process only.
    }
}
/** Read and normalize session memory; missing or corrupt data becomes an empty ledger and affects only recall bubbles. */
function loadSessionMemory() {
    try {
        return normalizeSessionMemory(JSON.parse(readFileSync(MEMORY_FILE, 'utf8')));
    }
    catch {
        return emptySessionMemory();
    }
}
/** Persist session memory atomically like pet state; failures do not block the plugin. */
function saveSessionMemory(next) {
    try {
        mkdirSync(dirname(MEMORY_FILE), { recursive: true });
        const tmp = `${MEMORY_FILE}.tmp`;
        writeFileSync(tmp, serializeSessionMemory(next));
        renameSync(tmp, MEMORY_FILE);
    }
    catch {
        // Failed memory persistence is retried on the next event without blocking the plugin.
    }
}
/** Collect all host jobs: per-agent owned jobs plus unowned jobs, deduplicated by ID. */
function collectTasks(ctx) {
    const jobs = ctx.jobs;
    const seen = new Set();
    const out = [];
    for (const agent of ctx.agents.list()) {
        for (const snapshot of jobs.list(agent.id)) {
            if (seen.has(snapshot.id))
                continue;
            seen.add(snapshot.id);
            out.push({ id: snapshot.id, status: snapshot.status, label: snapshot.label });
        }
    }
    for (const snapshot of jobs.list()) {
        if (seen.has(snapshot.id))
            continue;
        seen.add(snapshot.id);
        out.push({ id: snapshot.id, status: snapshot.status, label: snapshot.label });
    }
    return out;
}
/** Read the package manifest as the fallback for name and version; displayed versions do not gain a v prefix. */
function readSelfManifest() {
    try {
        const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
        if (!isRecord(manifest))
            throw new Error('invalid package manifest');
        return {
            name: typeof manifest.name === 'string' && manifest.name !== '' ? manifest.name : 'whale-girl',
            version: typeof manifest.version === 'string' ? manifest.version : undefined,
            // The manifest repository is used only for local-path installs without a tracked profile upstream.
            // Git/registry installs always follow their profile-recorded spec.
            repository: parseRepository(isRecord(manifest.repository) ? manifest.repository.url : undefined),
        };
    }
    catch {
        return { name: 'whale-girl', version: undefined, repository: undefined };
    }
}
/** Fetch update-check JSON with a timeout using the host's Node fetch. */
async function fetchJson(url, accept, self) {
    if (typeof fetch !== 'function')
        throw new Error('fetch unavailable');
    const controller = new AbortController();
    const timer = setTimeout(() => { controller.abort(); }, UPDATE_TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            headers: { accept, 'user-agent': `${self.name}${self.version === undefined ? '' : `/${self.version}`}` },
            signal: controller.signal,
        });
        if (!response.ok) {
            const failure = Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
            throw failure;
        }
        return await response.json();
    }
    finally {
        clearTimeout(timer);
    }
}
function json(res, status, body, extra = {}) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...extra });
    res.end(JSON.stringify(body));
}
/** Read a text request body; return null above the configured limit so the handler can respond 413. */
async function readBody(req, limit = BODY_LIMIT) {
    let data = '';
    for await (const chunk of req) {
        data += chunk;
        if (data.length > limit)
            return null;
    }
    return data;
}
/** Read raw audio with a hard byte limit; return null when the body exceeds it. */
async function readBinaryBody(req, limit) {
    const chunks = [];
    let size = 0;
    try {
        for await (const chunk of req) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            size += buffer.length;
            if (size > limit)
                return null;
            chunks.push(buffer);
        }
    }
    catch {
        return null;
    }
    return Buffer.concat(chunks);
}
export function apply(ctx, config) {
    let state = loadState() ?? { ...INITIAL_STATE, updatedAt: Date.now() };
    // Experience settings use the entry ID as their namespace and the exported Config schema.
    // The host supplies validated settings with live volatile { get() } leaves; updates do not remount the plugin.
    // Read only through readConfig to unwrap values, fill defaults, and normalize bound pairs.
    // /state includes configRevision so the client reapplies configuration only when it changes.
    let configRef = readConfig(config);
    let configRevision = 0;
    ctx.effect(() => ctx.on('loader/volatile-update', () => {
        configRef = readConfig(config);
        configRevision += 1;
        syncMemoryConfig();
        broadcastEvent();
    }), 'whale-girl: 配置热更新');
    // Debounce persistence after task, failure, session, or active-time bookkeeping events.
    let saveTimer;
    const scheduleSave = () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => saveState(state), 1000);
    };
    // Session-memory toggle: disabled means no reads, writes, or memory-event effects; existing files remain for later reuse.
    // Enabled memory loads lazily, records events, and debounces writes for one second.
    // memoryRecall holds the latest agent/created recall and rides /state within MEMORY_WINDOW_MS.
    // Clients deduplicate that bubble by its at timestamp.
    let memory = null;
    let memoryRecall = null;
    let memorySaveTimer;
    const memoryEnabled = () => configRef.sessionMemory === true;
    const ensureMemory = () => {
        if (memory === null && memoryEnabled())
            memory = loadSessionMemory();
        return memory;
    };
    const scheduleMemorySave = () => {
        if (memory === null)
            return;
        clearTimeout(memorySaveTimer);
        memorySaveTimer = setTimeout(() => { if (memory !== null)
            saveSessionMemory(memory); }, 1000);
    };
    // On enable, memory loads lazily. On disable, flush pending records, discard memory, and remove pending recall.
    // This final flush preserves records from the debounce window; it is not a write after the disabled state.
    // The disk file remains, but subsequent disabled events perform no memory reads or writes.
    const syncMemoryConfig = () => {
        if (memoryEnabled()) {
            ensureMemory();
        }
        else {
            if (memory !== null) {
                clearTimeout(memorySaveTimer);
                saveSessionMemory(memory);
            }
            memory = null;
            memoryRecall = null;
        }
    };
    // SSE broadcasts turn edges, session creation, settled jobs, and request errors so clients immediately refresh /state.
    // Polling remains the fail-safe when SSE is unavailable; EventSource reconnects automatically.
    // Failed writes remove disconnected clients. A close event also clears their heartbeat.
    const sseClients = new Set();
    const broadcastEvent = () => {
        const line = 'data: {"type":"event"}\n\n';
        for (const res of sseClients) {
            try {
                res.write(line);
            }
            catch {
                sseClients.delete(res);
            }
        }
    };
    // Activity tracking survives between polls and remains separate from the accumulating pet ledger.
    const known = new Map();
    let wasWorking = false;
    let lastActiveCheck = Date.now();
    // Transient windows prioritize welcome, error, and disappointment; celebration merges event and polling sources.
    let errorUntil = 0;
    let disappointedUntil = 0;
    let welcomeUntil = 0;
    let celebrateUntil = 0;
    // Desktop-presence heartbeat window; an online companion hides the web pet.
    let companionUntil = 0;
    // Ephemeral history is isolated by selected session and model route; requests serialize updates.
    const chatHistories = new Map();
    let chatTail = Promise.resolve();
    // Aggregate host session state into /state because the self-rendered client does not receive ctx.sessions.
    // sessionThink indicates an open turn; sessionWait follows turn/end with reason.kind === blocked.
    // turnCompleted is a shared deadline window observable by all readers.
    const sessionsSvc = typeof ctx.get === 'function' ? ctx.get('sessions') : undefined;
    // The sessionTitle service fills titles when historical session/title events are unavailable after restart.
    // The event log remains the first source; the title service supplies the fallback.
    const sessionTitleSvc = typeof ctx.get === 'function' ? ctx.get('sessionTitle') : undefined;
    let sessionThink = false;
    let sessionWait = false;
    let turnCompletedUntil = 0;
    const activeTurns = new Map(); // sessionId maps to the count of turn/start events without matching turn/end events.
    // /sessions views map IDs to title, activity, and since, updated by session/event.
    // Without the sessions service, only observed event views are available.
    const sessionViews = new Map();
    // Ownerless job memory uses the latest user session observed in the event stream.
    // Subagents never replace it because their memory is not announced; null means no user session has been observed.
    let lastSessionId = null;
    // Resolve titles from titleFromLog first, then the sessionTitle service for post-restart history.
    const resolveSessionTitle = (s) => {
        const fromLog = titleFromLog(Array.isArray(s?.events) ? s.events : []);
        if (fromLog !== null)
            return fromLog;
        try {
            const snapshot = sessionTitleSvc?.get?.(s);
            return typeof snapshot?.title === 'string' && snapshot.title !== '' ? snapshot.title : null;
        }
        catch {
            return null;
        }
    };
    const sessionUpdate = () => {
        // Aggregate current sessions and turn edges; when the service is unavailable, preserve the previous view.
        if (sessionsSvc === undefined || typeof sessionsSvc.list !== 'function')
            return;
        try {
            const sessions = sessionsSvc.list();
            let thinking = false;
            for (const s of sessions) {
                if (s === null || typeof s !== 'object')
                    continue;
                const id = typeof s.id === 'string' ? s.id : null;
                if (id !== null && (activeTurns.get(id) ?? 0) > 0)
                    thinking = true;
            }
            sessionThink = thinking;
        }
        catch {
            // Preserve the previous state when session listing fails.
        }
    };
    // /sessions primarily uses event views. The sessions list supplies missing titles and header.createdAt for older sessions.
    // Without the service, keep observed event views. When the list is available, remove views for sessions no longer listed.
    const sessionsSnapshot = () => {
        if (sessionsSvc !== undefined && typeof sessionsSvc.list === 'function') {
            try {
                const live = new Set();
                for (const s of sessionsSvc.list()) {
                    if (s === null || typeof s !== 'object')
                        continue;
                    const id = typeof s.id === 'string' ? s.id : null;
                    if (id === null)
                        continue;
                    live.add(id);
                    const since = typeof s.header?.createdAt === 'number' ? s.header.createdAt : Date.now();
                    const title = resolveSessionTitle(s);
                    const known = sessionViews.get(id);
                    if (known === undefined) {
                        sessionViews.set(id, { id, title, activity: 'done', since });
                    }
                    else if (known.title === null && title !== null) {
                        // Fill missing titles on existing views when only the post-restart title service knows them.
                        sessionViews.set(id, { ...known, title });
                    }
                }
                for (const id of sessionViews.keys()) {
                    if (!live.has(id))
                        sessionViews.delete(id);
                }
            }
            catch {
                // Preserve observed event views when session listing fails.
            }
        }
        return [...sessionViews.values()];
    };
    // Pet-service signals for other plugins: celebrate, levelUp, failure, and session (new/resume).
    // Subscribers receive (signal, payload); individual subscriber exceptions are isolated.
    const signals = createSignals();
    const emitSignal = signals.emit;
    // Derive display activity and accumulate working time; completed tasks and failures are recorded by events.
    const activity = () => {
        const now = Date.now();
        const tasks = collectTasks(ctx);
        const derived = deriveActivity({ tasks, nowMs: now, known, wasWorking, errorMs: configRef.errorMs });
        wasWorking = derived.wasWorking;
        // Settled-job subscriptions own completion XP, failure counts, and memory even while the GUI is closed.
        // Polling here only derives working/burst display and accumulates active time.
        if (derived.working) {
            state = recordActive(state, now - lastActiveCheck, now).state;
            scheduleSave();
        }
        lastActiveCheck = now;
        // Job failures and request errors share error followed by disappointment windows.
        // Repeated events only extend deadlines by max; concurrent failures do not erase one another.
        if (derived.burst?.name === 'error') {
            errorUntil = Math.max(errorUntil, derived.burst.until);
            disappointedUntil = Math.max(disappointedUntil, derived.burst.until + configRef.disappointedMs);
        }
        // Burst priority is welcome > error > disappointed > celebrate > working > idle.
        // Welcome cannot interrupt an active error/disappointment tail.
        // Merge event and polling celebrations by the later deadline, without adding durations, so reopening the GUI still shows recent success.
        // Concurrent celebrations never cover an error burst.
        let name = derived.working ? 'working' : 'idle';
        let until = 0;
        const burst = mergeCelebrate(derived.burst, celebrateUntil, now);
        if (burst !== null && burst.until > now) {
            name = burst.name;
            until = burst.until;
        }
        if (disappointedUntil > now) {
            name = 'disappointed';
            until = disappointedUntil;
        }
        if (errorUntil > now) {
            name = 'error';
            until = errorUntil;
        }
        if (welcomeUntil > now && errorUntil <= now && disappointedUntil <= now) {
            name = 'welcome';
            until = welcomeUntil;
        }
        // Absolute deadlines make /state non-consuming: the web and desktop companion can observe the same turn completion.
        return {
            name,
            until,
            sessionThink,
            sessionWait,
            ...turnCompletionSnapshot(turnCompletedUntil, now),
        };
    };
    // webServer is optional in headless mode; when present it serves state/interact/config/assets/events.
    // The client mounts through official client-modules and __ModuleLoader__, rather than backend page injection.
    const webServer = authenticatedWebServer(ctx, typeof ctx.get === 'function' ? ctx.get('webServer') : undefined);
    // Chat and voice are optional host capabilities. Chat uses llm/agentDefaultModel when available;
    // otherwise it returns a fallback reply while the pet remains usable. Browser speech stays client-side.
    const llmSvc = typeof ctx.get === 'function' ? ctx.get('llm') : undefined;
    const defaultModelSvc = typeof ctx.get === 'function' ? ctx.get('agentDefaultModel') : undefined;
    // Updates are optional host package-manager operations. The host owns profile locks, pnpm execution, and rollback.
    // This plugin never edits profile files. Without update support, the UI still shows the current version.
    // Git commit identity comes from the profile lockfile because package.json versions do not identify installed commits.
    const SELF = readSelfManifest();
    // Resolve the manager on each use because the plugin can load before that service.
    const managerOf = () => (typeof ctx.get === 'function' ? ctx.get('pluginManager') : undefined);
    const profileDir = (() => {
        const context = typeof ctx.get === 'function' ? ctx.get('profileContext') : undefined;
        if (context !== undefined && typeof context.dir === 'string' && context.dir !== '')
            return context.dir;
        const fromEnvironment = process.env.DSH_PROFILE_DIR;
        if (typeof fromEnvironment === 'string' && fromEnvironment !== '')
            return fromEnvironment;
        // Fallback profile path: <dshHome>/profiles/<profile>, using the host-provided environment and existing DSH_HOME.
        const name = process.env.DSH_PROFILE;
        return typeof name === 'string' && name !== '' ? join(DSH_HOME, 'profiles', name) : undefined;
    })();
    // core/update-host.ts owns source/lockfile inspection, upstream checks, package-manager operations, and Git layout handling.
    // This entry only connects Cordis services and network I/O; tests/update-host.test.mjs covers orchestration.
    const updateHost = createUpdateHost({
        self: SELF,
        profileDir,
        managerOf,
        fetchJson: (url, accept) => fetchJson(url, accept, SELF),
    });
    // Chat and voice use optional host capabilities.
    // An explicit provider/model pair selects the chat route; otherwise use agentDefaultModel.
    // Without an LLM service, reply with a fallback while keeping the pet available.
    const chatSelection = () => {
        const cfgChat = configRef.chat;
        // Only a complete provider/model pair is explicit; a partial pair selects the host default rather than streaming an empty model ID.
        if (typeof cfgChat.provider === 'string' && cfgChat.provider !== ''
            && typeof cfgChat.model === 'string' && cfgChat.model !== '') {
            return { provider: cfgChat.provider, model: cfgChat.model };
        }
        const selection = typeof defaultModelSvc?.currentSelection === 'function' ? defaultModelSvc.currentSelection() : null;
        if (selection === null || typeof selection !== 'object')
            return null;
        if (typeof selection.provider !== 'string' || typeof selection.model !== 'string')
            return null;
        return { provider: selection.provider, model: selection.model };
    };
    // Some providers, such as opencode-go, require session IDs as transport headers.
    // Use a live agent session or the first known session when no selected ID is supplied.
    // This is transport metadata only; it is not appended to the session log or prompt context.
    const chatSessionId = () => {
        try {
            for (const agent of ctx.agents.list()) {
                const id = agent?.session?.id;
                if (typeof id === 'string' && id !== '')
                    return id;
            }
        }
        catch { /* Agent listing is unavailable. */ }
        try {
            for (const session of sessionsSvc?.list?.() ?? []) {
                if (typeof session?.id === 'string' && session.id !== '')
                    return session.id;
            }
        }
        catch { /* Session listing is unavailable. */ }
        return undefined;
    };
    // A provider may finish with neither text nor an error; runChat retries an empty response once.
    const streamOnce = async (selection, text, extras, history, sessionId) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
        let reply = '';
        let failure = null;
        try {
            for await (const chunk of llmSvc.stream({
                provider: selection.provider,
                model: selection.model,
                system: personaFor(state, configRef.chat.systemPrompt, extras),
                messages: buildChatMessages({ history, text, assistant: selection }),
                maxTokens: configRef.chat.maxTokens,
                temperature: 0.8,
                sessionId: sessionId ?? chatSessionId(),
                signal: controller.signal,
            })) {
                if (chunk?.type === 'text-delta' && typeof chunk.text === 'string')
                    reply += chunk.text;
                else if (chunk?.type === 'finish' && chunk.reason?.kind === 'error')
                    failure = chunk.reason.failure ?? { code: "error" };
                else if (chunk?.type === 'finish' && chunk.reason?.kind === 'aborted')
                    failure = { code: 'aborted' };
            }
        }
        catch (error) {
            failure = {
                code: isRecord(error) && typeof error.code === 'string' ? error.code : 'error',
                message: String(error instanceof Error ? error.message : error).slice(0, 300),
            };
        }
        finally {
            clearTimeout(timer);
        }
        return { reply, failure };
    };
    // Session facts are opt-in and scoped to the exact selected session.
    const chatExtras = async (text, sessionId) => {
        const extras = {};
        if (configRef.chat.sessionContext === true) {
            if (sessionId !== undefined) {
                try {
                    const session = sessionsSvc?.get?.(sessionId)
                        ?? sessionsSvc?.list?.().find((item) => item.id === sessionId);
                    const view = sessionViews.get(sessionId) ?? (session !== undefined
                        ? { ...createSessionView(sessionId, session.header?.createdAt ?? Date.now()), title: resolveSessionTitle(session) } : undefined);
                    extras.sessionContext = view === undefined ? 'Выбранная сессия недоступна.'
                        : describeSessions([view], { now: Date.now() });
                    if (typeof session?.deriveMessages === 'function') {
                        const conversation = describeConversation(session.deriveMessages());
                        if (conversation !== '')
                            extras.sessionContext += `\n${conversation}`;
                    }
                }
                catch {
                    extras.sessionContext = 'Контекст выбранной сессии временно недоступен.';
                }
            }
            else {
                const active = [...sessionViews.values()].filter((view) => view.activity !== 'done');
                extras.sessionContext = active.length <= 1 ? describeSessions(active, { now: Date.now() })
                    : 'Текущая сессия не выбрана. Открой сессию, чтобы обсудить её ход.';
            }
        }
        if (configRef.news.enabled === true && wantsNews(text)) {
            const news = await fetchHeadlines({ feeds: configRef.news.feeds, maxItems: configRef.news.maxItems });
            if (news.ok)
                extras.headlines = formatHeadlines(news.items, configRef.news.maxItems);
            else
                extras.newsUnavailable = true;
        }
        return extras;
    };
    const runChat = async (text, sessionId) => {
        const selection = chatSelection();
        if (llmSvc === undefined || selection === null)
            return { ok: false, code: 'chat-unavailable' };
        const route = JSON.stringify([selection.provider, selection.model, sessionId ?? null]);
        const history = chatHistories.get(route) ?? [];
        const extras = await chatExtras(text, sessionId);
        let attempt = await streamOnce(selection, text, extras, history, sessionId);
        if (normalizeReply(attempt.reply) === '' && attempt.failure === null)
            attempt = await streamOnce(selection, text, extras, history, sessionId);
        const clean = normalizeReply(attempt.reply);
        if (clean === '')
            return { ok: false, code: attempt.failure === null ? 'chat-empty' : 'chat-failed', failure: attempt.failure };
        const maxTurns = Math.max(0, Math.min(32, configRef.chat.historyTurns)) * 2;
        const nextHistory = appendHistory(appendHistory(history, 'user', text, maxTurns), 'assistant', clean, maxTurns);
        chatHistories.delete(route);
        chatHistories.set(route, nextHistory);
        if (chatHistories.size > 32)
            chatHistories.delete(chatHistories.keys().next().value);
        return { ok: true, reply: clean, bubble: bubbleText(clean), speech: speechText(clean) };
    };
    // GET /models is optional settings assistance, not the chat execution path.
    // Skip failed or timed-out provider catalogues; return an empty list when listing services are absent.
    let modelsCache = null;
    const withTimeout = (promise, ms) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('model-list-timeout')), ms);
        Promise.resolve(promise).then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
    });
    const listModelOptions = async () => {
        const now = Date.now();
        if (modelsCache !== null && now - modelsCache.at < MODELS_CACHE_MS)
            return modelsCache.options;
        const options = [];
        if (llmSvc !== undefined
            && typeof llmSvc.listProviders === 'function'
            && typeof llmSvc.listModels === 'function') {
            const listModels = llmSvc.listModels.bind(llmSvc);
            let providers = [];
            try {
                providers = llmSvc.listProviders();
            }
            catch {
                providers = [];
            }
            const list = Array.isArray(providers) ? providers.slice(0, 20) : [];
            const settled = await Promise.allSettled(list.map(async (provider) => {
                const providerId = isRecord(provider) && typeof provider.id === 'string' && provider.id !== ''
                    ? provider.id
                    : typeof provider === 'string' && provider !== '' ? provider : null;
                if (providerId === null)
                    return [];
                const models = await withTimeout(listModels(providerId), MODELS_TIMEOUT_MS);
                const providerName = isRecord(provider) && typeof provider.name === 'string' && provider.name !== '' ? provider.name : providerId;
                return (Array.isArray(models) ? models : []).map((model) => {
                    const id = isRecord(model) && typeof model.id === 'string' ? model.id : '';
                    if (id === '')
                        return null;
                    const name = isRecord(model) && typeof model.name === 'string' && model.name !== '' ? model.name : id;
                    return { provider: providerId, model: id, label: `${providerName} / ${name}` };
                }).filter((option) => option !== null);
            }));
            for (const entry of settled) {
                if (entry.status === 'fulfilled')
                    options.push(...entry.value);
            }
        }
        const capped = options.slice(0, MODELS_MAX);
        modelsCache = { at: now, options: capped };
        return capped;
    };
    // Serialize concurrent chat requests so updates to each conversation history cannot race.
    const enqueueChat = (text, sessionId) => {
        const run = chatTail.then(() => runChat(text, sessionId), () => runChat(text, sessionId));
        chatTail = run.then(() => { }, () => { });
        return run;
    };
    ctx.effect(() => {
        const disposers = [
            // The whale-girl.pet service exposes only read-only snapshots and signal subscriptions to other plugins.
            // Consumers must tolerate its absence, as this plugin does for optional host capabilities.
            // Its namespaced service ID avoids Cordis duplicate-service errors in a shared scope.
            // See 2026-08-15-pet-service-namespace. Only this plugin owns ledger writes.
            ctx.provide('whale-girl.pet', {
                snapshot: () => ({ pet: state, activity: activity() }),
                onSignal: (fn) => signals.subscribe(fn),
            }),
            // Record each settled job once, independently of browser polling, including while the GUI is closed.
            // Killed jobs are neutral: no XP, failure count, or memory entry.
            // Subscribe with owners: all because the pet ledger is global across host-agent scopes.
            ctx.jobs.events.subscribe({ owners: 'all' }, (event) => {
                if (event.type !== 'settled')
                    return; // Created, progress, stopping, and removed events do not alter the ledger.
                const snapshot = event.job;
                const now = Date.now();
                if (snapshot.status === 'completed') {
                    const result = recordTaskCompleted(state, snapshot.label ?? 'Задача без названия', now);
                    state = result.state;
                    // Recording completion starts the celebration window even when polling missed the task.
                    // Merge its deadline with the polled celebration using max rather than adding durations.
                    celebrateUntil = Math.max(celebrateUntil, now + configRef.celebrateMs);
                    scheduleSave();
                    emitSignal('celebrate', { label: snapshot.label ?? 'Задача без названия', level: state.level });
                    if (result.leveledUp)
                        emitSignal('levelUp', { level: state.level });
                }
                else if (snapshot.status === 'failed') {
                    state = recordFailure(state, now).state;
                    scheduleSave();
                    emitSignal('failure', { level: state.level });
                }
                // When enabled, settled-task memory uses its exact owner session.
                // Ownerless plugin jobs use the latest user session; without either identity, skip rather than guessing.
                if ((snapshot.status === 'completed' || snapshot.status === 'failed') && memoryEnabled()) {
                    const owner = typeof snapshot.owner === 'string' && snapshot.owner !== '' ? snapshot.owner : lastSessionId;
                    // Without an attributable session, do not even load memory or leave an empty file for final persistence.
                    if (owner !== null) {
                        const mem = ensureMemory();
                        if (mem !== null) {
                            memory = recordTask(mem, owner, {
                                label: snapshot.label ?? 'Задача без названия',
                                ok: snapshot.status === 'completed',
                                at: now,
                            });
                            scheduleMemorySave();
                        }
                    }
                }
                broadcastEvent(); // Notify clients immediately when a task settles so transient celebration/failure windows are visible.
            }),
            ctx.on('agent/request-error', () => {
                // Request errors affect error/disappointment display only; retries must not inflate task-failure statistics or memory.
                // Actual settled task failure owns those counts, preventing repeated provider errors from awarding failure-based titles.
                // Request and task errors use the same error-to-disappointment cascade.
                const now = Date.now();
                errorUntil = Math.max(errorUntil, now + configRef.errorMs);
                disappointedUntil = Math.max(disappointedUntil, now + configRef.errorMs + configRef.disappointedMs);
                broadcastEvent(); // Broadcast request errors immediately so the startle window is observable.
            }),
            // agent/created publishes payload.agent on startup, resume, clear, or compact.
            ctx.on('agent/created', (payload) => {
                const now = Date.now();
                // Startup adds a counted session, SESSION_XP, and welcome.
                // Resume/compact/clear add only RESUME_XP, without a new-session count or repeated welcome.
                if (payload.source === 'startup') {
                    state = recordSession(state, now).state;
                    welcomeUntil = now + configRef.welcomeMs;
                    emitSignal('session', { kind: 'new', level: state.level });
                }
                else {
                    state = recordSessionResume(state, now).state;
                    emitSignal('session', { kind: 'resume', level: state.level });
                }
                // When memory is enabled, agent/created first records resume/fork/startup lineage, then finds the nearest remembered tasks.
                // A match produces memoryRecall on /state; the client deduplicates by at. Missing lineage or tasks produces no bubble.
                // Subagent sessions retain their lineage and tasks but never announce recall, avoiding repeated greetings during delegation.
                // Their subagent flag uses an independent eviction budget so they cannot crowd out user sessions.
                if (memoryEnabled()) {
                    const live = typeof payload.agent?.session === 'object' && payload.agent.session !== null
                        ? payload.agent.session
                        : null;
                    const sid = typeof live?.id === 'string' ? live.id : null;
                    if (sid !== null) {
                        const parent = typeof live?.header?.parentSession === 'string' ? live.header.parentSession : null;
                        const announce = recallable(live?.header);
                        const mem = ensureMemory();
                        if (mem !== null) {
                            memory = observeSession(mem, { id: sid, parent, title: null, subagent: !announce, at: now });
                            if (announce) {
                                const found = memoryFor(memory, sid);
                                memoryRecall = memorySnapshot(found, now);
                            }
                            scheduleMemorySave();
                        }
                    }
                }
                scheduleSave();
                broadcastEvent(); // Broadcast session creation/resume immediately so welcome and ledger updates reach clients.
            }),
            // Observe turn/start and turn/end for thinking and turn-completion celebration.
            // Always subscribe even without sessionsSvc: completion windows need only the event itself.
            // When aggregate session listing is unavailable, retain the previous thinking view.
            ctx.on('session/event', (session, event) => {
                const id = typeof session?.id === 'string' ? session.id : null;
                if (id === null)
                    return;
                // Update /sessions from turn/start, tool/call, turn/end, and session/title events.
                // Blocked turn endings mean waiting; other endings mean done.
                // The sessions list supplies titles and header.createdAt for sessions not yet observed in the event stream.
                const known = sessionViews.get(id);
                const since = known?.since ?? (typeof session?.header?.createdAt === 'number' ? session.header.createdAt : Date.now());
                const base = known ?? { ...createSessionView(id, since), title: resolveSessionTitle(session) };
                // Additive turn timing tracks duration, tool count, and last tool for remaining-time estimates in core/session-context.ts.
                const view = applySessionTiming(applySessionView(base, event), event, Date.now());
                if (known === undefined || view !== known)
                    sessionViews.set(id, view);
                // Only user sessions become ownerless-task fallbacks; subagent recall is never announced.
                const announce = recallable(session?.header);
                if (announce)
                    lastSessionId = id;
                // When enabled, first observation records parentSession lineage and title; title changes update that metadata.
                // Forked sessions can recall ancestor tasks. Subagent metadata is retained under its independent eviction budget.
                if (memoryEnabled()) {
                    const parent = typeof session?.header?.parentSession === 'string' ? session.header.parentSession : null;
                    if (known === undefined || (view.title !== null && view.title !== known.title)) {
                        const mem = ensureMemory();
                        if (mem !== null) {
                            memory = observeSession(mem, { id, parent, title: view.title, subagent: !announce, at: Date.now() });
                            scheduleMemorySave();
                        }
                    }
                }
                const parsed = parseTurnEvent(event);
                if (parsed === null)
                    return;
                if (parsed.kind === 'start') {
                    activeTurns.set(id, (activeTurns.get(id) ?? 0) + 1);
                    sessionWait = false; // A new turn clears the approval-waiting state.
                    sessionUpdate();
                }
                else {
                    const n = (activeTurns.get(id) ?? 0) - 1;
                    if (n <= 0)
                        activeTurns.delete(id);
                    else
                        activeTurns.set(id, n);
                    turnCompletedUntil = Math.max(turnCompletedUntil, Date.now() + TURN_COMPLETED_MS);
                    sessionWait = parsed.blocked; // Blocked turn/end means the session is waiting for user approval or permission.
                    sessionUpdate();
                }
                broadcastEvent(); // Broadcast turn edges immediately so thinking and completion do not wait for polling.
            }),
            // Register plugin routes when webServer is available in web mode.
            ...(webServer !== undefined ? [
                webServer.register({
                    kind: 'exact',
                    path: STATE_PATH,
                    handler: async (req, res) => {
                        try {
                            if (req.method !== 'GET') {
                                json(res, 405, { error: 'method not allowed; use GET' }, { allow: 'GET' });
                                return;
                            }
                            // Disable heuristic caching for polled state snapshots.
                            // Compute activity first because it accumulates working time; the returned pet must include that update.
                            const act = activity();
                            json(res, 200, {
                                apiVersion: SNAPSHOT_API_VERSION,
                                pet: state,
                                activity: act,
                                configRevision,
                                companionOnline: companionOnline(companionUntil, Date.now()),
                                // Include enabled recalled memory only within MEMORY_WINDOW_MS.
                                // The client deduplicates by at; disabling memory immediately clears this field through syncMemoryConfig.
                                ...(configRef.sessionMemory && memoryRecall !== null && Date.now() - memoryRecall.at <= MEMORY_WINDOW_MS
                                    ? { memory: memoryRecall }
                                    : {}),
                            }, { 'cache-control': 'no-store' });
                        }
                        catch (error) {
                            json(res, 500, { error: error instanceof Error ? error.message : String(error) });
                        }
                    },
                }),
                webServer.register({
                    kind: 'exact',
                    path: CONFIG_PATH,
                    handler: async (req, res) => {
                        try {
                            if (req.method !== 'GET') {
                                json(res, 405, { error: 'method not allowed; use GET' }, { allow: 'GET' });
                                return;
                            }
                            // Read-only configuration mirror, fetched by clients when configRevision changes.
                            // Only host settings services/files own writes; this plugin provides no separate settings write endpoint.
                            json(res, 200, { config: { ...configRef, voice: { ...configRef.voice, apiKey: '' } }, revision: configRevision }, { 'cache-control': 'no-store' });
                        }
                        catch (error) {
                            json(res, 500, { error: error instanceof Error ? error.message : String(error) });
                        }
                    },
                }),
                // GET checks upstream versions; POST installs through the host manager.
                // Both reject cross-origin requests like /interact to protect writes and upstream request quotas.
                webServer.register({
                    kind: 'exact',
                    path: UPDATE_PATH,
                    handler: async (req, res) => {
                        try {
                            if (req.method === 'GET' || req.method === 'POST') {
                                if (isCrossOrigin(req.headers, req.headers.host)) {
                                    json(res, 403, { error: 'cross-origin request rejected' });
                                    return;
                                }
                                json(res, 200, req.method === 'GET' ? await updateHost.status() : await updateHost.apply(), { 'cache-control': 'no-store' });
                                return;
                            }
                            json(res, 405, { error: 'method not allowed; use GET or POST' }, { allow: 'GET, POST' });
                        }
                        catch (error) {
                            json(res, 500, { error: error instanceof Error ? error.message : String(error) });
                        }
                    },
                }),
                webServer.register({
                    kind: 'exact',
                    path: INTERACT_PATH,
                    handler: async (req, res) => {
                        try {
                            if (req.method !== 'POST') {
                                json(res, 405, { error: 'method not allowed; use POST' }, { allow: 'POST' });
                                return;
                            }
                            // Reject cross-origin requests for CSRF protection; other sites must not trigger pet interactions.
                            if (isCrossOrigin(req.headers, req.headers.host)) {
                                json(res, 403, { error: 'cross-origin request rejected' });
                                return;
                            }
                            const raw = await readBody(req);
                            if (raw === null) {
                                json(res, 413, { error: 'request body too large' });
                                return;
                            }
                            let body;
                            try {
                                body = JSON.parse(raw || '{}');
                            }
                            catch {
                                json(res, 400, { error: 'invalid JSON body' });
                                return;
                            }
                            if (!isRecord(body)) {
                                json(res, 400, { error: 'body must be a JSON object' });
                                return;
                            }
                            const result = applyAction(state, body.action, configRef.replies);
                            json(res, result.status, result.body, { 'cache-control': 'no-store' });
                        }
                        catch (error) {
                            json(res, 500, { error: error instanceof Error ? error.message : String(error) });
                        }
                    },
                }),
                // Chat: user text goes through the selected host model and returns a pet reply.
                webServer.register({
                    kind: 'exact',
                    path: CHAT_PATH,
                    handler: async (req, res) => {
                        try {
                            if (req.method !== 'POST') {
                                json(res, 405, { error: 'method not allowed; use POST' }, { allow: 'POST' });
                                return;
                            }
                            if (isCrossOrigin(req.headers, req.headers.host)) {
                                json(res, 403, { error: 'cross-origin request rejected' });
                                return;
                            }
                            if (configRef.chat.enabled !== true) {
                                json(res, 403, { error: 'chat-disabled' });
                                return;
                            }
                            const raw = await readBody(req, CHAT_BODY_LIMIT);
                            if (raw === null) {
                                json(res, 413, { error: 'request body too large' });
                                return;
                            }
                            let body;
                            try {
                                body = JSON.parse(raw || '{}');
                            }
                            catch {
                                json(res, 400, { error: 'invalid JSON body' });
                                return;
                            }
                            if (!isRecord(body)) {
                                json(res, 400, { error: 'body must be a JSON object' });
                                return;
                            }
                            const text = normalizeChatText(body.text);
                            if (text === null) {
                                json(res, 400, { error: `text required (1..${CHAT_TEXT_MAX} chars)` });
                                return;
                            }
                            if (body.sessionId !== undefined && (typeof body.sessionId !== 'string' || body.sessionId.trim() === '' || body.sessionId.length > 256)) {
                                json(res, 400, { error: 'invalid sessionId' });
                                return;
                            }
                            const result = await enqueueChat(text, body.sessionId);
                            if (!result.ok) {
                                // Report provider failure codes in HTTP diagnostics and host logs without exposing reply text.
                                console.warn('[whale-girl] chat failed:', result.code, result.failure?.code ?? '', result.failure?.message ?? '');
                                json(res, result.code === 'chat-unavailable' ? 503 : 502, {
                                    error: result.code,
                                    failureCode: (result.failure?.code ?? result.failure?.finishKind ?? null),
                                    reply: fallbackReply(),
                                }, { 'cache-control': 'no-store' });
                                return;
                            }
                            json(res, 200, {
                                reply: result.reply,
                                bubble: result.bubble,
                                speech: result.speech,
                            }, { 'cache-control': 'no-store' });
                        }
                        catch (error) {
                            json(res, 500, { error: error instanceof Error ? error.message : String(error) });
                        }
                    },
                }),
                // List host providers and models for chat selection.
                webServer.register({
                    kind: 'exact',
                    path: MODELS_PATH,
                    handler: async (req, res) => {
                        try {
                            if (req.method !== 'GET') {
                                json(res, 405, { error: 'method not allowed; use GET' }, { allow: 'GET' });
                                return;
                            }
                            if (isCrossOrigin(req.headers, req.headers.host)) {
                                json(res, 403, { error: 'cross-origin request rejected' });
                                return;
                            }
                            const options = await listModelOptions();
                            json(res, 200, {
                                current: chatSelection(),
                                hostDefault: typeof defaultModelSvc?.currentSelection === 'function' ? defaultModelSvc.currentSelection() : null,
                                options,
                            }, { 'cache-control': 'no-store' });
                        }
                        catch (error) {
                            json(res, 500, { error: error instanceof Error ? error.message : String(error) });
                        }
                    },
                }),
                // Model speech uses the configured server-side transport and credentials.
                // Browser speech stays entirely in the client through SpeechSynthesis.
                webServer.register({
                    kind: 'exact',
                    path: VOICE_PATH,
                    handler: async (req, res) => {
                        const abort = new AbortController();
                        let completed = false;
                        const disconnected = () => { if (!completed)
                            abort.abort(); };
                        req.once?.('aborted', disconnected);
                        res.once?.('close', disconnected);
                        try {
                            if (req.method !== 'POST') {
                                json(res, 405, { error: 'method not allowed; use POST' }, { allow: 'POST' });
                                return;
                            }
                            if (isCrossOrigin(req.headers, req.headers.host)) {
                                json(res, 403, { error: 'cross-origin request rejected' });
                                return;
                            }
                            if (configRef.voice.enabled !== true) {
                                json(res, 403, { error: 'voice-disabled' });
                                return;
                            }
                            const raw = await readBody(req, CHAT_BODY_LIMIT);
                            if (raw === null) {
                                json(res, 413, { error: 'request body too large' });
                                return;
                            }
                            let body;
                            try {
                                body = JSON.parse(raw || '{}');
                            }
                            catch {
                                json(res, 400, { error: 'invalid JSON body' });
                                return;
                            }
                            if (!isRecord(body)) {
                                json(res, 400, { error: 'body must be a JSON object' });
                                return;
                            }
                            const text = normalizeVoiceText(body.text);
                            if (text === null) {
                                json(res, 400, { error: 'text required' });
                                return;
                            }
                            const stream = req.headers.accept?.split(',').some(value => value.trim().split(';')[0] === 'audio/pcm') === true;
                            const onPcm = stream ? (chunk) => {
                                if (abort.signal.aborted || res.destroyed || res.writableLength + chunk.length > 512 * 1024)
                                    throw new Error('voice stream unavailable');
                                if (!res.headersSent)
                                    res.writeHead(200, {
                                        'content-type': 'audio/pcm;rate=24000;channels=1;encoding=s16le',
                                        'cache-control': 'no-store',
                                        'x-content-type-options': 'nosniff',
                                    });
                                res.write(chunk);
                            } : undefined;
                            const result = await synthesizeVoice({ voice: configRef.voice, text, tone: body.tone, env: process.env, signal: abort.signal, onPcm });
                            if (res.destroyed || abort.signal.aborted)
                                return;
                            if (!result.ok) {
                                if (res.headersSent) {
                                    res.destroy();
                                    return;
                                }
                                const status = result.error === SUBSCRIPTION_VOICE_ERROR ? 409
                                    : result.error.startsWith('voice-') ? 400 : 502;
                                json(res, status, { error: result.error, ...(result.status === undefined ? {} : { status: result.status }) });
                                return;
                            }
                            if (res.headersSent) {
                                res.end();
                                return;
                            }
                            res.writeHead(200, {
                                'content-type': result.contentType,
                                'content-length': result.audio.length,
                                'cache-control': 'no-store',
                            });
                            res.end(result.audio);
                        }
                        catch {
                            if (res.destroyed)
                                return;
                            if (res.headersSent)
                                res.destroy();
                            else
                                json(res, 502, { error: 'tts-failed' });
                        }
                        finally {
                            completed = true;
                            req.off?.('aborted', disconnected);
                            res.off?.('close', disconnected);
                        }
                    },
                }),
                // Transcription accepts raw audio, not JSON, and forwards it to an OpenAI-compatible audio/transcriptions endpoint.
                // STT_MAX_BYTES is independent of the smaller chat/voice JSON-body limits.
                webServer.register({
                    kind: 'exact',
                    path: TRANSCRIBE_PATH,
                    handler: async (req, res) => {
                        try {
                            if (req.method !== 'POST') {
                                json(res, 405, { error: 'method not allowed; use POST' }, { allow: 'POST' });
                                return;
                            }
                            if (isCrossOrigin(req.headers, req.headers.host)) {
                                json(res, 403, { error: 'cross-origin request rejected' });
                                return;
                            }
                            if (configRef.voice.enabled !== true) {
                                json(res, 403, { error: 'voice-disabled' });
                                return;
                            }
                            const contentType = typeof req.headers['content-type'] === 'string' ? req.headers['content-type'] : '';
                            if (!contentType.toLowerCase().startsWith('audio/')) {
                                json(res, 415, { error: 'content-type must be audio/*' });
                                return;
                            }
                            const audio = await readBinaryBody(req, STT_MAX_BYTES);
                            if (audio === null) {
                                json(res, 413, { error: 'request body too large' });
                                return;
                            }
                            const request = buildSttRequest({
                                voice: configRef.voice,
                                audio,
                                mime: contentType.split(';')[0].trim(),
                                env: process.env,
                            });
                            if (!request.ok) {
                                json(res, request.error === SUBSCRIPTION_VOICE_ERROR ? 409 : 400, { error: request.error });
                                return;
                            }
                            const response = await fetch(request.url, {
                                method: 'POST',
                                headers: request.headers,
                                body: request.body,
                                redirect: 'error',
                                signal: AbortSignal.timeout(STT_TIMEOUT_MS),
                            });
                            if (!response.ok) {
                                json(res, 502, { error: 'stt-failed', status: response.status });
                                return;
                            }
                            let parsed = null;
                            try {
                                parsed = await response.json();
                            }
                            catch {
                                parsed = null;
                            }
                            const text = isRecord(parsed) && typeof parsed.text === 'string' ? parsed.text.trim() : '';
                            json(res, 200, { text }, { 'cache-control': 'no-store' });
                        }
                        catch (error) {
                            json(res, 502, { error: error instanceof Error ? error.message : String(error) });
                        }
                    },
                }),
                // Desktop companion heartbeats extend a presence TTL that expires after exit or crash.
                // While present, the web pet hides to avoid duplication; this changes presentation only, not ledger semantics.
                // The route uses the same cross-origin and body-limit protection as /interact; see core/presence.ts.
                webServer.register({
                    kind: 'exact',
                    path: PRESENCE_PATH,
                    handler: async (req, res) => {
                        try {
                            if (req.method !== 'POST') {
                                json(res, 405, { error: 'method not allowed; use POST' }, { allow: 'POST' });
                                return;
                            }
                            if (isCrossOrigin(req.headers, req.headers.host)) {
                                json(res, 403, { error: 'cross-origin request rejected' });
                                return;
                            }
                            const raw = await readBody(req);
                            if (raw === null) {
                                json(res, 413, { error: 'request body too large' });
                                return;
                            }
                            let body;
                            try {
                                body = JSON.parse(raw || '{}');
                            }
                            catch {
                                json(res, 400, { error: 'invalid JSON body' });
                                return;
                            }
                            if (!isRecord(body)) {
                                json(res, 400, { error: 'body must be a JSON object' });
                                return;
                            }
                            // An omitted online flag renews presence; explicit false immediately restores the web pet after companion exit.
                            const online = body.online !== false;
                            companionUntil = pokePresence(companionUntil, Date.now(), online);
                            json(res, 200, { online: companionOnline(companionUntil, Date.now()) }, { 'cache-control': 'no-store' });
                        }
                        catch (error) {
                            json(res, 500, { error: error instanceof Error ? error.message : String(error) });
                        }
                    },
                }),
                // /sessions exposes per-session thinking, tool:<name>, waiting, or done activity to desktop and other consumers.
                // Observed session/event views are primary; the sessions list fills missing titles and start times.
                // Disable caching because activity changes in real time.
                webServer.register({
                    kind: 'exact',
                    path: SESSIONS_PATH,
                    handler: async (req, res) => {
                        try {
                            if (req.method !== 'GET') {
                                json(res, 405, { error: 'method not allowed; use GET' }, { allow: 'GET' });
                                return;
                            }
                            json(res, 200, sessionsSnapshot(), { 'cache-control': 'no-store' });
                        }
                        catch (error) {
                            json(res, 500, { error: error instanceof Error ? error.message : String(error) });
                        }
                    },
                }),
                webServer.register({
                    kind: 'prefix',
                    path: ASSETS_PATH,
                    handler: async (req, res) => {
                        if (req.method !== 'GET' && req.method !== 'HEAD') {
                            res.writeHead(405);
                            res.end();
                            return;
                        }
                        let pathname;
                        try {
                            pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://dsh.internal').pathname);
                        }
                        catch {
                            res.writeHead(400);
                            res.end();
                            return;
                        }
                        const rel = sanitizeAssetPath(pathname);
                        if (rel === null) {
                            res.writeHead(403);
                            res.end();
                            return;
                        }
                        try {
                            const data = readFileSync(join(import.meta.dirname, '../lib/assets', rel));
                            // Assets use immutable long-lived caching and include a character ID in their paths.
                            // Publishing changed images requires a new filename or character ID; replacing bytes under the same path leaves old cached content.
                            res.writeHead(200, { 'content-type': contentTypeFor(rel), 'cache-control': 'public, max-age=31536000, immutable' });
                            res.end(data);
                        }
                        catch {
                            res.writeHead(404);
                            res.end();
                        }
                    },
                }),
                // SSE subscribers refresh /state after each event instead of waiting for the next poll.
                // A 25-second comment heartbeat prevents proxy idle timeouts. Closing clears the connection and heartbeat.
                // Broadcast write failures remove disconnected clients without blocking event handling.
                webServer.register({
                    kind: 'exact',
                    path: EVENTS_PATH,
                    handler: async (req, res) => {
                        if (req.method !== 'GET') {
                            res.writeHead(405);
                            res.end();
                            return;
                        }
                        res.writeHead(200, {
                            'content-type': 'text/event-stream',
                            'cache-control': 'no-cache',
                            connection: 'keep-alive',
                            'x-accel-buffering': 'no',
                        });
                        if (typeof res.flushHeaders === 'function')
                            res.flushHeaders();
                        res.write('retry: 3000\n\n');
                        sseClients.add(res);
                        let heartbeat;
                        if (typeof res.on === 'function') {
                            res.on('close', () => {
                                clearInterval(heartbeat);
                                sseClients.delete(res);
                            });
                        }
                        heartbeat = setInterval(() => {
                            try {
                                res.write(': ping\n\n');
                            }
                            catch { /* Disconnected clients are cleaned up by close. */ }
                        }, 25000);
                    },
                }),
            ] : []),
        ];
        return () => {
            clearTimeout(saveTimer);
            saveState(state); // Flush final pet state before disable/unload.
            // Flush session memory only when loaded/enabled; disabled memory remains null and performs no write.
            clearTimeout(memorySaveTimer);
            if (memory !== null)
                saveSessionMemory(memory);
            for (const dispose of disposers)
                dispose();
        };
    }, 'whale-girl: state/interact/config/assets/ui routes + events');
}
