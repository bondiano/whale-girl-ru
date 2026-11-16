// 设置卡字段规格与派生（纯计算：零 React、零 DOM、零宿主依赖，可单测）。
//
// 契约：
// - `CARD_FIELDS` 是卡片字段的单一来源：叶路径 → 控件类型（toggle/number/lines）、范围与步长。
//   路径即写入路径：官方 `ConfigFormController.mutate` 接受任意深度的 `path` 数组，嵌套字段
//   （`walk.enabled` / `replies.feed`）不必再整组合并写——`set` 只达单段（`'walk.enabled'`
//   会字面落键），故写路径一律走 `mutate`。
// - `deriveState` 把 scope 快照派生成卡片渲染所需的 `{ available, writable, fields }`。
//   默认值不在此写第二份——由 index.mjs 传 `CFG_DEFAULTS`（verify-config-sync 门禁保证
//   其与 `src/config.mjs` 的 DEFAULTS 一致）。
// - `writeField` 是即时写入语义的实现（无暂存、无保存按钮）：提交一次单字段变更（交给官方
//   控制器的排队/栅栏，不自己传 revision），再按宿主回读值确认（数组/对象按形状比，引用必然不同）；
//   未获接受时抛错，由卡片显示一条提示并把输入回读成宿主值。
// - 快照引用稳定性由调用方缓存（settings-card.mjs 的注册函数）：hooks 走 `useSyncExternalStore`，
//   内容未变时必须返回同一对象，否则无限重渲（React #185）。
//
// 归属测试：tests/settings-fields.test.mjs（叶取值、快照派生、即时写入单字段提交与失败确认、
// 字段表完整性）。

/** 卡片字段表（path = 设置叶路径，即 mutate 的 path 段数组；labelKey = locale 文案键）。
 * min/max/step 与 `src/config.mjs` 的 buildSchema clamp 对齐（界面边界，不是默认值——
 * 默认值的单一来源仍是 DEFAULTS/CFG_DEFAULTS）。 */
export const CARD_FIELDS = [
  { path: 'enabled', labelKey: 'enabled', kind: 'toggle' },
  { path: 'sessionMemory', labelKey: 'sessionMemory', kind: 'toggle' },
  { path: 'size', labelKey: 'size', kind: 'number', min: 64, max: 160, step: 1 },
  { path: 'opacity', labelKey: 'opacity', kind: 'number', min: 0.2, max: 1, step: 0.05 },
  { path: 'walk.enabled', labelKey: 'walk', kind: 'toggle' },
  { path: 'sleepAfterMs', labelKey: 'sleep', kind: 'number', min: 5000, max: 600000, step: 1000 },
  { path: 'replies.feed', labelKey: 'feed', kind: 'lines' },
  { path: 'replies.play', labelKey: 'play', kind: 'lines' },
  { path: 'replies.idle', labelKey: 'idle', kind: 'lines' },
  // Голос: сверху — включение, ниже — параметры TTS-модели (openai) и системного голоса.
  { path: 'voice.enabled', labelKey: 'voice', kind: 'toggle' },
  { path: 'voice.provider', labelKey: 'voiceProvider', kind: 'select', options: ['browser', 'openai'] },
  { path: 'voice.sttModel', labelKey: 'voiceSttModel', kind: 'text' },
  { path: 'voice.baseUrl', labelKey: 'voiceBaseUrl', kind: 'text' },
  { path: 'voice.model', labelKey: 'voiceModel', kind: 'text' },
  { path: 'voice.voice', labelKey: 'voiceName', kind: 'text' },
  { path: 'voice.apiKeyEnv', labelKey: 'voiceApiKeyEnv', kind: 'text' },
  { path: 'voice.rate', labelKey: 'voiceRate', kind: 'number', min: 0.5, max: 2, step: 0.1 },
  // Режим разговора: после ответа снова слушать (TTS/STT-провайдер не важен).
  { path: 'voice.conversation', labelKey: 'voiceConversation', kind: 'toggle' },
  // Беседа: включение, модель (виртуальный путь chat.route пишет и provider, и model)
  // и (опционально) свой характер вместо встроенного.
  { path: 'chat.enabled', labelKey: 'chat', kind: 'toggle' },
  { path: 'chat.route', labelKey: 'chatModel', kind: 'model' },
  { path: 'chat.systemPrompt', labelKey: 'chatPersona', kind: 'multiline' },
  // Новости: включение, число заголовков и свои RSS/Atom-ленты.
  { path: 'news.enabled', labelKey: 'news', kind: 'toggle' },
  { path: 'news.maxItems', labelKey: 'newsMaxItems', kind: 'number', min: 1, max: 10, step: 1 },
  { path: 'news.feeds', labelKey: 'newsFeeds', kind: 'lines' },
]

/** Служебный разделитель провайдера и модели в виртуальном пути `chat.route`.
 * NUL не встречается в id провайдеров/моделей, поэтому ключ однозначно разбирается. */
const ROUTE_SEP = '\u0000'

/** provider+model → значение селекта модели ('' — «по умолчанию хоста»). */
export function modelKey(provider, model) {
  const providerId = typeof provider === 'string' ? provider.trim() : ''
  const modelId = typeof model === 'string' ? model.trim() : ''
  return providerId !== '' && modelId !== '' ? `${providerId}${ROUTE_SEP}${modelId}` : ''
}

/** Значение селекта модели → { provider, model }; '' (по умолчанию) → null. */
export function splitModelKey(key) {
  if (typeof key !== 'string' || key === '') return null
  const at = key.indexOf(ROUTE_SEP)
  if (at <= 0 || at === key.length - 1) return null
  return { provider: key.slice(0, at), model: key.slice(at + 1) }
}

/** 按点分路径读叶值；路径段缺失返回 undefined。 */
export function leafOf(value, path) {
  let cur = value
  for (const seg of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = cur[seg]
  }
  return cur
}

/** 叶值等价（标量同值；数组/对象按 JSON 形状比——宿主往返后引用必然不同）。 */
export function sameLeaf(a, b) {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

/** 文案池文本 ↔ 数组：按行拆分/trim/去空；行尾空行不产生空串。 */
export function parseLines(text) {
  return String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export function serializeLines(lines) {
  return (Array.isArray(lines) ? lines : []).join('\n')
}

/**
 * 由 scope 快照派生卡片状态。
 * @param {object} snap ConfigFormController 快照（{ status, value, writable, revision, … }）
 * @param {object} defaults 叶默认值兜底（index.mjs 传 CFG_DEFAULTS）
 * @returns {{ available: boolean, writable: boolean, fields: Record<string, unknown> }}
 */
export function deriveState(snap, defaults) {
  const committed = snap.value ?? {}
  const fields = {}
  for (const def of CARD_FIELDS) {
    if (def.kind === 'model') {
      // Виртуальный путь: значение — пара provider/model из соседних листьев.
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
 * 立刻写入一个字段（即时保存语义：不暂存、无保存按钮、无批量提交）。
 * 不传 `expectedRevision`：官方控制器自己按 `pendingRevision` 串行排队并给后继写定栅栏；
 * 自己传快照 revision 会绕过那道栅栏——同一 RTT 内的连续改动会被宿主按 CAS 拒绝（第一次其实
 * 已落库），结果是误报「未被接受」并丢掉后一次编辑。
 * @param {object} scope ConfigFormController（getSnapshot/subscribe/mutate/…）
 * @param {string} path 字段叶路径（CARD_FIELDS 的 path）
 * @param {unknown} value 新值
 * @returns {Promise<void>} 未获接受时抛错（卡片据此显示提示并回读宿主值）
 */
export async function writeField(scope, path, value) {
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
 * Записать несколько полей одной транзакцией (селект модели пишет provider и model сразу).
 * Один `mutate` с несколькими `set` — частичного применения не бывает; после ответа
 * каждый лист сверяется с хостом, поэтому молчаливая потеря хотя бы одного не пройдёт.
 * @param {object} scope ConfigFormController
 * @param {Array<[string, unknown]>} pairs пары «путь, значение»
 * @returns {Promise<void>}
 */
export async function writeFields(scope, pairs) {
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
