import type { MemoryRecall, SessionCatalog } from './types.js'
// Pure client animation-state/expression selection with no DOM dependency, independently testable.
// pickState accepts { activity, pet, dragging, transient, sleeping, joyUntil, now, sessionThink,
// sessionWait, workingActive, celebrateUntil } and returns an animation state. Pet attributes do
// not drive state: there is no hunger/mood negative feedback. STATE_TABLE order is the single
// source of priority; Node supplies factual burst windows { name, until }, while the client selects
// local interactions. drag/burst/transient are temporary overrides: rederive the underlying state
// afterward rather than hardcoding idle. The host times transients, including TRANSIENT_MS safety;
// activity.until bounds bursts. Host sessionThink/sessionWait signals keep companionship awake
// across any active session, overriding sleep/walk but yielding to interactions/events. working is
// an occasional client-scheduled interlude (workingActive), not a task indicator; think is normal.
// Client celebrateUntil marks turn completion and has lower priority than Node task-completion
// bursts.

export const TRANSIENT_MS = 1500
// Wake has a distinct duration from short eat/play actions: non-looping wake sheets hold their
// final frame until WAKE_MS expires.
export const WAKE_MS = 3000
export const JOY_MS = 1600
// Client celebration duration after a session running->completed transition.
export { TURN_COMPLETED_MS as ROUND_CELEBRATE_MS } from '../core/snapshot.js'

// Authoritative state names: all characters require sheets for all 15 states, without emoji
// fallback. docs/sprites-spec.md is the source table; verify-spec-states checks that table, this
// set, and STATE_TABLE including dynamic burst values agree.
export const STATE_NAMES = Object.freeze([
  'idle', 'working', 'celebrate', 'error', 'disappointed', 'joy', 'eat', 'play',
  'drag', 'walk', 'sleep', 'wake', 'welcome', 'think', 'wait',
])

// Frame playback modes are required per manifest state; the player follows them instead of
// special-casing state names. loop: 0->1->...->N-1->0, with frame 0 the default pose. pingpong:
// 0->1->...->N-1->...->0 with symmetric endpoint poses. once: hold the final completed pose after
// frame-0 start; motion may continue. blink: hold default frame 0, occasionally play frames 1..N-1,
// then return to 0.
export const PLAYBACK_MODES = Object.freeze(['loop', 'pingpong', 'once', 'blink'])
// Minimum frame counts per mode, cross-checked by verify-assets.
export const PLAYBACK_MIN_FRAMES = Object.freeze({
  loop: 1, pingpong: 2, once: 1, blink: 2,
})

/**
 * State-priority grammar: the first matching row wins. when evaluates the input context; resolve
 * returns the selected state, usually the row's state but activity.name for burst. All results must
 * belong to STATE_NAMES; verify-spec-states checks the specification table, names, and row order.
 */
interface StateInput { activity?: { name: string; until: number }; dragging?: boolean; walking?: boolean; transient?: string | null; sleeping?: boolean; joyUntil?: number; now?: number; sessionThink?: boolean; sessionWait?: boolean; dragReleaseUntil?: number; workingActive?: boolean; celebrateUntil?: number }
type StateContext = Required<StateInput> & { activity: { name: string; until: number } }
interface StateRule { state: string; when: (c: StateContext) => boolean | undefined; resolve?: (c: StateContext) => string }
export const STATE_TABLE: StateRule[] = [
  { state: 'drag', when: (c) => c.dragging },
  // After drag release, hold idle for 1.5 s before deriving think/working. A pet dragged from sleep
  // yields directly to wake rather than first entering the idle buffer. Wake still ranks below
  // bursts/eat/play so event feedback takes precedence.
  { state: 'idle', when: (c) => c.dragReleaseUntil > c.now && c.transient !== 'wake' },
  // Node event bursts (welcome/celebrate/error/disappointed) take precedence while their until
  // deadline is valid.
  { state: 'burst', when: (c) => c.activity.name !== 'idle' && c.activity.name !== 'working' && c.activity.until > c.now, resolve: (c) => c.activity.name },
  { state: 'eat', when: (c) => c.transient === 'eat' },
  { state: 'play', when: (c) => c.transient === 'play' },
  { state: 'wake', when: (c) => c.transient === 'wake' },
  { state: 'wait', when: (c) => c.sessionWait },
  // Client turn-completion celebration uses running->completed edges. It ranks below Node bursts
  // (including task completion), user interactions, and wait approval prompts, but above ordinary
  // companionship. This brief interlude must not interrupt interaction feedback.
  { state: 'celebrate', when: (c) => c.celebrateUntil > c.now },
  // working is an occasional client-scheduled interlude (workingActive) during thinking
  // companionship, not a task-status indicator. think is the default; working adds a brief working
  // pose.
  { state: 'working', when: (c) => c.workingActive },
  { state: 'think', when: (c) => c.sessionThink },
  { state: 'joy', when: (c) => c.now < c.joyUntil },
  { state: 'sleep', when: (c) => c.sleeping },
  { state: 'walk', when: (c) => c.walking },
  { state: 'idle', when: () => true },
]

/**
 * Choose the current animation from the first matching STATE_TABLE row; explicit now makes tests
 * deterministic.
 */
export function pickState(input: StateInput) {
  const ctx: StateContext = {
    activity: { name: 'idle', until: 0 }, dragging: false, walking: false, transient: null, sleeping: false,
    ...input,
    now: input.now ?? Date.now(),
    joyUntil: input.joyUntil ?? 0,
    sessionThink: input.sessionThink ?? false,
    sessionWait: input.sessionWait ?? false,
    dragReleaseUntil: input.dragReleaseUntil ?? 0,
    workingActive: input.workingActive ?? false,
    celebrateUntil: input.celebrateUntil ?? 0,
  }
  for (const row of STATE_TABLE) {
    if (row.when(ctx)) return row.resolve ? row.resolve(ctx) : row.state
  }
  return 'idle'
}

/**
 * Aggregate companionship from the host sessions snapshot across all active sessions, not just the
 * current one. The host current field identifies selection if consumers need it. Input is { byId: {
 * [id]: { displayTitle, running, pendingInteraction, completed } }, current }; reads only, without
 * side effects.
 * @returns {{ thinking: boolean, waiting: boolean, titles: string[] }} thinking means any session running; waiting means any approval/plan-review/question; titles lists running-session labels.
 */
export function deriveSessionMood(snapshot: SessionCatalog | null | undefined) {
  const byId = snapshot?.byId ?? {}
  let thinking = false
  let waiting = false
  const titles = []
  for (const id of Object.keys(byId)) {
    const s = byId[id]
    if (s === undefined || s === null) continue
    if (s.running === true) {
      thinking = true
      titles.push(s.displayTitle ?? id)
    }
    if (s.pendingInteraction !== undefined) waiting = true
  }
  return { thinking, waiting, titles }
}

// Scheduling decisions (v3 pure functions) extract timer windows, random interludes, and edges from
// index.mjs closures. Explicit now/random inputs make deterministic time-advance tests possible.
// These functions decide without DOM/timer side effects; index.mjs executes decisions.

// Working-interlude constants belong to the code-level L2 semantic layer, not user configuration in
// src/config.mjs.
export const WORKING_MIN_WAIT_MS = 12000 // Minimum interlude delay while think is the default.
export const WORKING_MAX_WAIT_MS = 30000 // Maximum interlude delay.
export const WORKING_MIN_DUR_MS = 2500   // Minimum interlude duration.
export const WORKING_MAX_DUR_MS = 6000   // Maximum interlude duration.

// Ambient chatter waits 45-110 s between phrases. This code-level interval keeps it unobtrusive
// rather than defining personality; phrase pools remain configurable.
export const CHATTER_MIN_MS = 45000
export const CHATTER_MAX_MS = 110000

/**
 * Choose a phrase from a pool; return null for empty/invalid pools. avoid is the previous phrase:
 * prevent consecutive repeats when alternatives exist.
 */
export function pickPhrase(pool: unknown, { random = Math.random, avoid = null }: { random?: () => number; avoid?: string | null } = {}) {
  if (!Array.isArray(pool)) return null
  const lines = pool.filter((line): line is string => typeof line === 'string' && line.trim() !== '')
  if (lines.length === 0) return null
  let index = Math.floor(random() * lines.length)
  if (index < 0 || index >= lines.length) index = 0
  if (lines.length > 1 && lines[index] === avoid) index = (index + 1) % lines.length
  return lines[index] ?? null
}

/** Next ambient chatter deadline: now plus 45-110 s. */
export function nextChatterAt({ now, random = Math.random }: { now: number; random?: () => number }) {
  return now + CHATTER_MIN_MS + random() * (CHATTER_MAX_MS - CHATTER_MIN_MS)
}

// Code-level L2 idle-blink timing: hold open-eyed frame 0, then blink at random intervals.
export const BLINK_MIN_INTERVAL_MS = 3000 // Minimum blink interval.
export const BLINK_MAX_INTERVAL_MS = 9000 // Maximum blink interval.

// Code-level L2 turning: occasionally reverse facing while idle/think/wait.
export const FACING_MIN_INTERVAL_MS = 10000 // Minimum turning interval.
export const FACING_MAX_INTERVAL_MS = 25000 // Maximum turning interval.

/**
 * Choose an idle blink deadline: hold frame 0, then occasionally play 0->1->2->0.
 * @param {object} input
 * @param {number} input.now Current time.
 * @param {() => number} [input.random] Injectable randomness; defaults to Math.random.
 * @returns {number} Next blink time: now plus a random interval.
 */
export function nextBlinkAt({ now, random = Math.random }: { now: number; random?: () => number }) {
  const wait = BLINK_MIN_INTERVAL_MS + random() * (BLINK_MAX_INTERVAL_MS - BLINK_MIN_INTERVAL_MS)
  return now + wait
}

/**
 * Choose a random turn while idle/think/wait. Preserve facing across actions: static states retain
 * the flip assigned by walk/drag until their next scheduled turn.
 * @param {object} input
 * @param {number} input.now Current time.
 * @param {() => number} [input.random] Injectable randomness; defaults to Math.random.
 * @returns {number} Next turn time: now plus a random interval.
 */
export function nextFacingAt({ now, random = Math.random }: { now: number; random?: () => number }) {
  const wait = FACING_MIN_INTERVAL_MS + random() * (FACING_MAX_INTERVAL_MS - FACING_MIN_INTERVAL_MS)
  return now + wait
}

/**
 * Horizontal drag displacement determines facing for left-facing source assets; vertical-only
 * movement preserves it.
 */
export function facingFromDrag(deltaX: number, currentFlip: number) {
  return deltaX === 0 ? currentFlip : deltaX < 0 ? 1 : -1
}

/**
 * Schedule occasional working poses during session thinking; think remains the default otherwise.
 * @param {object} input
 * @param {number} input.now Current time.
 * @param {boolean} input.sessionThink Thinking window; interludes arm only here.
 * @param {object} input.working Host-owned { active, until } state.
 * @param {() => number} [input.random] Injectable randomness; defaults to Math.random.
 * @returns {{ active: boolean, until: number }} Target state and deadline used by host setTimeout/tick.
 */
export function nextWorkingRhythm({ now, sessionThink, working, random = Math.random }: { now: number; sessionThink: boolean; working: { active: boolean; until: number }; random?: () => number }) {
  // Inactive session: disarm interludes until thinking resumes.
  if (!sessionThink) return { active: false, until: 0 }
  if (working.active) {
    // Currently working: return to think after a random duration.
    const dur = WORKING_MIN_DUR_MS + random() * (WORKING_MAX_DUR_MS - WORKING_MIN_DUR_MS)
    return { active: false, until: now + dur }
  }
  // Currently thinking: occasionally insert working after a random delay.
  const wait = WORKING_MIN_WAIT_MS + random() * (WORKING_MAX_WAIT_MS - WORKING_MIN_WAIT_MS)
  return { active: true, until: now + wait }
}

/**
 * Wake on the visual edge from sleep to another state, unless interrupted by dragging or an
 * existing transient.
 * @param {string} prevState Previous displayed animState.
 * @param {string} nextState Target from pickState.
 * @param {object} ctx { dragging, transient }.
 * @returns {boolean} Whether to play wake.
 */
export function shouldWake(prevState: string | null, nextState: string, ctx: { dragging?: boolean; transient?: string | null } = {}) {
  return prevState === 'sleep' && nextState !== 'sleep' && !ctx.dragging && (ctx.transient ?? null) === null
}

/**
 * Interaction waking (v6): dragging/feeding/playing/menu opening signals presence and restarts idle
 * timing, preventing immediate sleep after release. Add wake only when the pet visibly showed sleep
 * at interaction start (animState === 'sleep'). Do not use derived sleeping: think/working can
 * visually override sleep while that flag remains true because activity is idle; the pet does not
 * need waking then.
 * @param {object} input
 * @param {boolean} input.visuallySleeping Whether the pet visibly showed sleep when interaction began.
 * @returns {{ sleeping: boolean, wake: boolean }} sleeping is always false after interaction; wake requests a visual wake transition.
 */
export function wakeFromInteraction({ visuallySleeping }: { visuallySleeping: boolean }) {
  return { sleeping: false, wake: visuallySleeping === true }
}

/**
 * Detect turn-completion edges (v7) through running true->false in the official sessions snapshot,
 * including current/subagent sessions. completed means a done notification for non-selected
 * sessions and is unsuitable.
 * @param {object} snapshot { byId: { [id]: { running, displayTitle } } }.
 * @param {Map<string, boolean>} prevRunning Previous host-owned running flags.
 * @returns {{ flips: Array<{ id: string, title: string }>, prevRunning: Map<string, boolean> }} Newly completed sessions and the updated flags to retain.
 */
export function detectTurnCompleted(snapshot: SessionCatalog | null | undefined, prevRunning: Map<string, boolean>) {
  const byId = snapshot?.byId ?? {}
  const nextPrev = new Map(prevRunning)
  const flips = []
  for (const id of Object.keys(byId)) {
    const s = byId[id]
    if (s === null || typeof s !== 'object') continue
    const running = s.running === true
    if (nextPrev.get(id) === true && !running) {
      flips.push({ id, title: s.displayTitle ?? id })
    }
    nextPrev.set(id, running)
  }
  // Remove flags for missing/deleted/unlisted sessions so reopening cannot produce a false
  // completion edge.
  for (const id of nextPrev.keys()) {
    if (!(id in byId)) nextPrev.delete(id)
  }
  return { flips, prevRunning: nextPrev }
}

/**
 * Pure memory-bubble wording from /state memory. Greet with only the latest two completed tasks;
 * failures are excluded rather than revisiting old mistakes. Clip labels to 14 characters to
 * prevent horizontal overflow (stored labels permit 160; src/session-memory.mjs). distance>0
 * identifies parent-session recall after forking and explicitly says the work predates the branch.
 * Return null when nothing can be shown.
 * @param {{ distance?: number, tasks?: Array<{ label?: string, ok?: boolean }> } | null | undefined} memory
 * @returns {string | null}
 */
export function memoryLine(memory: MemoryRecall | null | undefined) {
  const tasks = Array.isArray(memory?.tasks) ? memory.tasks : []
  const labels = tasks
    .filter((t) => t !== null && typeof t === 'object' && t.ok !== false && typeof t.label === 'string' && t.label !== '')
    .flatMap((t) => typeof t.label === 'string' ? [t.label] : [])
  if (labels.length === 0) return null
  const clip = (s: string) => (s.length > 16 ? `${s.slice(0, 16)}…` : s)
  const shown = labels.slice(-2).map((l) => `«${clip(l)}»`).join(', ')
  const more = labels.length > 2 ? ` — всего ${labels.length}` : ''
  const branch = (memory?.distance ?? 0) > 0 ? 'В прошлой ветке вы выполнили' : 'В прошлый раз вы выполнили'
  return `${branch} ${shown}${more}`
}


/**
 * Pure visibility decision: dim only for another visible dialog. The pet's own chat belongs to it
 * and must not dim the whale.
 * @param {Array<{ ownedByPet: boolean, visible: boolean }>} list
 * @returns {boolean}
 */
export function shouldDimForDialogs(list: Array<{ ownedByPet: boolean; visible: boolean }>) {
  return (Array.isArray(list) ? list : []).some((dialog) => dialog !== null
    && typeof dialog === 'object'
    && dialog.ownedByPet !== true
    && dialog.visible === true)
}

/** Reading time starts after text reveal and grows with reply length, up to two minutes. */
export function chatBubbleDuration(text: string, configuredMs: number) {
  return Math.min(120000, Math.max(30000, configuredMs, 25000 + 140 * Array.from(text).length))
}

/**
 * Pure actionable Russian speech-error messages. Codes come from Node /transcribe responses and
 * browser SpeechRecognition.onerror. Each message identifies whether to fix settings, credentials,
 * network, or permission instead of showing a generic failure.
 * @param {string | null | undefined} code
 * @returns {string}
 */
export function voiceErrorMessage(code: string | null | undefined) {
  switch (code) {
    case 'voice-subscription-unsupported':
    case 'voice-subscription-unavailable':
      return 'Подписка ChatGPT не предоставляет голосовой API для плагинов. Выбери системный голос или отдельно оплачиваемый OpenAI API в настройках.'
    case 'voice-disabled':
      return 'Голос выключен в настройках. Включи «Голос» и выбери движок openai.'
    case 'voice-provider-browser':
      return 'Микрофон через сервер требует движок openai: в настройках голоса выбери openai и укажи адрес TTS.'
    case 'voice-config-missing':
      return 'Голос не настроен: в настройках выбери движок openai и адрес TTS.'
    case 'voice-base-url-invalid':
      return 'Адрес TTS некорректный: нужен http(s)-адрес вида https://api.openai.com/v1.'
    case 'voice-audio-empty':
      return 'Запись пустая — попробуй сказать ещё раз.'
    case 'voice-api-key-required':
      return 'Для OpenAI API нужен API-ключ и отдельный биллинг. Задай переменную ключа из настроек голоса в окружении DSH. Подписка ChatGPT не заменяет ключ.'
    case 'tts-timeout':
      return 'Сервис голоса не ответил вовремя. Попробуй озвучить ответ ещё раз.'
    case 'tts-aborted':
      return 'Озвучка отменена.'
    case 'tts-connection-failed':
      return 'Не удалось подключиться к сервису голоса. Проверь интернет и адрес API в настройках.'
    case 'tts-invalid-audio':
    case 'tts-invalid-content-type':
      return 'Сервис голоса вернул некорректное аудио. Проверь адрес и модель в настройках.'
    case 'stt-failed':
      return 'Сервер не распознал речь. Проверь ключ, адрес и модель распознавания в настройках.'
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Браузер не дал доступ к микрофону. Разреши микрофон для этой страницы и попробуй снова.'
    case 'no-speech':
      return 'Не расслышала. Скажи ещё раз, ближе к микрофону.'
    case 'audio-capture':
      return 'Микрофон не найден или занят другим приложением.'
    case 'network':
      return 'Нет связи с сервисом распознавания. Проверь интернет и попробуй снова.'
    case 'aborted':
      return 'Запись прервалась — попробуй ещё раз.'
    default:
      return 'Не получилось распознать речь. Попробуй ещё раз или напиши текстом.'
  }
}
