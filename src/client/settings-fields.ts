// Pure settings-field specifications and derivation: no React, DOM, or host dependency;
// independently testable. CARD_FIELDS is the single source for leaf paths, control kinds, bounds,
// and steps. ConfigFormController.mutate accepts arbitrary-depth path arrays, so nested
// walk.enabled/replies.feed writes need no whole-object merge; set handles only one segment and
// would create a literal dotted key. deriveState produces { available, writable, fields },
// receiving CFG_DEFAULTS from index.mjs rather than duplicating defaults; verify-config-sync checks
// agreement with src/config.mjs DEFAULTS. writeField saves one change immediately without
// drafts/save buttons, lets the host controller own queuing/revision fences, then compares
// host-read scalar/JSON-shaped values because object references differ after transport. Rejection
// throws so the card shows a notice and restores authoritative input. settings-card.mjs caches
// snapshots for useSyncExternalStore: unchanged content must preserve identity to avoid React #185
// infinite rendering. tests/settings-fields.test.mjs covers leaf access, state derivation,
// accepted/rejected immediate writes, and field-table completeness.

export interface SettingsValues { [key: string]: unknown; chat?: { provider?: unknown; model?: unknown } }
export interface ConfigSnapshot { status?: string; value?: SettingsValues; writable?: boolean; revision?: number }
export interface ConfigScope {
  getSnapshot(): ConfigSnapshot;
  mutate(operations: { op: 'set'; path: string[]; value: unknown }[]): Promise<boolean>;
  subscribe(listener: () => void): () => void;
}
export interface SettingsState { available: boolean; writable: boolean; fields: Record<string, unknown> }
interface FieldBase { path: string; labelKey: string }
export type CardField = FieldBase & (
  { kind: 'number'; min: number; max: number; step: number } |
  { kind: 'select'; options: string[] } |
  { kind: 'toggle' | 'lines' | 'text' | 'multiline' | 'model' }
);

/**
 * Field specifications: path is the settings leaf/mutate path segments; labelKey identifies locale
 * copy. min/max/step match src/config.mjs buildSchema clamps as UI boundaries, not defaults;
 * DEFAULTS/CFG_DEFAULTS remain the sole defaults source.
 */
export const CARD_FIELDS: CardField[] = [
  { path: 'enabled', labelKey: 'enabled', kind: 'toggle' },
  { path: 'sessionMemory', labelKey: 'sessionMemory', kind: 'toggle' },
  { path: 'size', labelKey: 'size', kind: 'number', min: 64, max: 160, step: 1 },
  { path: 'opacity', labelKey: 'opacity', kind: 'number', min: 0.2, max: 1, step: 0.05 },
  { path: 'walk.enabled', labelKey: 'walk', kind: 'toggle' },
  { path: 'sleepAfterMs', labelKey: 'sleep', kind: 'number', min: 5000, max: 600000, step: 1000 },
  { path: 'replies.feed', labelKey: 'feed', kind: 'lines' },
  { path: 'replies.play', labelKey: 'play', kind: 'lines' },
  { path: 'replies.idle', labelKey: 'idle', kind: 'lines' },
  // Voice controls: enable first, then configure OpenAI TTS and system voices.
  { path: 'voice.enabled', labelKey: 'voice', kind: 'toggle' },
  { path: 'voice.provider', labelKey: 'voiceProvider', kind: 'select', options: ['browser', 'openai', 'subscription'] },
  { path: 'voice.sttModel', labelKey: 'voiceSttModel', kind: 'text' },
  { path: 'voice.baseUrl', labelKey: 'voiceBaseUrl', kind: 'text' },
  { path: 'voice.model', labelKey: 'voiceModel', kind: 'text' },
  { path: 'voice.voice', labelKey: 'voiceName', kind: 'text' },
  { path: 'voice.apiKeyEnv', labelKey: 'voiceApiKeyEnv', kind: 'text' },
  { path: 'voice.rate', labelKey: 'voiceRate', kind: 'number', min: 0.5, max: 2, step: 0.1 },
  // Conversation mode resumes listening after a reply regardless of TTS/STT provider.
  { path: 'voice.conversation', labelKey: 'voiceConversation', kind: 'toggle' },
  // Chat controls: enable, select a model (virtual chat.route writes provider and model), and
  // optionally override the built-in persona.
  { path: 'chat.enabled', labelKey: 'chat', kind: 'toggle' },
  { path: 'chat.route', labelKey: 'chatModel', kind: 'model' },
  { path: 'chat.systemPrompt', labelKey: 'chatPersona', kind: 'multiline' },
  // News controls: enable, headline count, and custom RSS/Atom feeds.
  { path: 'news.enabled', labelKey: 'news', kind: 'toggle' },
  { path: 'news.maxItems', labelKey: 'newsMaxItems', kind: 'number', min: 1, max: 10, step: 1 },
  { path: 'news.feeds', labelKey: 'newsFeeds', kind: 'lines' },
]

/**
 * Internal provider/model separator for virtual chat.route. Provider/model IDs contain no NUL, so
 * parsing is unambiguous.
 */
const ROUTE_SEP = '\u0000'

/** Convert provider/model to its select value; empty string means host default. */
export function modelKey(provider: unknown, model: unknown) {
  const providerId = typeof provider === 'string' ? provider.trim() : ''
  const modelId = typeof model === 'string' ? model.trim() : ''
  return providerId !== '' && modelId !== '' ? `${providerId}${ROUTE_SEP}${modelId}` : ''
}

/** Parse the selected route into { provider, model }; empty host-default selection becomes null. */
export function splitModelKey(key: unknown) {
  if (typeof key !== 'string' || key === '') return null
  const at = key.indexOf(ROUTE_SEP)
  if (at <= 0 || at === key.length - 1) return null
  return { provider: key.slice(0, at), model: key.slice(at + 1) }
}

/** Read a dotted leaf path; missing segments return undefined. */
export function leafOf(value: unknown, path: string) {
  let cur = value
  for (const seg of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cur
}

/**
 * Leaf equality uses scalar identity or JSON object/array shape because transport changes
 * references.
 */
export function sameLeaf(a: unknown, b: unknown) {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Convert phrase-pool text to/from arrays: split lines, trim, and discard blanks, including
 * trailing blank lines.
 */
export function parseLines(text: unknown) {
  return String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export function serializeLines(lines: unknown) {
  return (Array.isArray(lines) ? lines : []).join('\n')
}

/**
 * Derive card state from a scope snapshot.
 * @param {object} snap ConfigFormController snapshot: { status, value, writable, revision, ... }.
 * @param {object} defaults Leaf fallback defaults; index.mjs supplies CFG_DEFAULTS.
 * @returns {{ available: boolean, writable: boolean, fields: Record<string, unknown> }}
 */
export function deriveState(snap: ConfigSnapshot, defaults: SettingsValues): SettingsState {
  const committed = snap.value ?? {}
  const fields: Record<string, unknown> = {}
  for (const def of CARD_FIELDS) {
    if (def.kind === 'model') {
      // Virtual route value combines adjacent provider/model leaves.
      const route = committed.chat ?? defaults?.chat ?? {}
      const provider = route.provider !== undefined ? route.provider : defaults?.chat?.provider
      const model = route.model !== undefined ? route.model : defaults?.chat?.model
      fields[def.path] = modelKey(provider, model)
      continue
    }
    const fromCommitted = leafOf(committed, def.path)
    fields[def.path] = fromCommitted !== undefined ? fromCommitted : leafOf(defaults, def.path)
  }
  return {
    available: snap.status !== 'unavailable',
    writable: snap.writable === true,
    fields,
  }
}

/**
 * Save one field immediately, without drafts/save buttons/batching. Do not pass expectedRevision:
 * the official controller serializes writes through pendingRevision and fences subsequent changes.
 * Passing snapshot revision bypasses that fence; consecutive same-RTT edits can fail host CAS even
 * after the first persisted, falsely reporting rejection and losing the later edit.
 * @param {object} scope ConfigFormController with getSnapshot/subscribe/mutate.
 * @param {string} path CARD_FIELDS leaf path.
 * @param {unknown} value New value.
 * @returns {Promise<void>} Throws on rejection so the card can notify and restore host values.
 */
export async function writeField(scope: ConfigScope, path: string, value: unknown) {
  let accepted = false
  try {
    accepted = await scope.mutate([{ op: 'set', path: path.split('.'), value }]) === true
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error))
  }
  const committed = scope.getSnapshot().value ?? {}
  if (!accepted || !sameLeaf(leafOf(committed, path), value)) {
    throw new Error(`whale-girl: 设置写入未被接受（${path}）`)
  }
}


/**
 * Write multiple fields atomically; the model selector updates provider and model together. One
 * mutate with multiple set operations cannot partially apply. Verify every leaf after the host
 * response so none can be silently lost.
 * @param {object} scope ConfigFormController.
 * @param {Array<[string, unknown]>} pairs Path/value pairs.
 * @returns {Promise<void>}
 */
export async function writeFields(scope: ConfigScope, pairs: [string, unknown][]) {
  const list = (Array.isArray(pairs) ? pairs : [])
    .filter((pair) => Array.isArray(pair) && pair.length === 2 && typeof pair[0] === 'string' && pair[0] !== '')
  if (list.length === 0) return
  let accepted = false
  try {
    accepted = await scope.mutate(list.map(([path, value]) => ({
      op: 'set',
      path: path.split('.'),
      value,
    }))) === true
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error))
  }
  const committed = scope.getSnapshot().value ?? {}
  for (const [path, value] of list) {
    if (!accepted || !sameLeaf(leafOf(committed, path), value)) {
      throw new Error(`whale-girl: 设置写入未被接受（${path}）`)
    }
  }
}
