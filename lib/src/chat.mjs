// Беседа с питомцем: характер, история реплик и сборка запроса к llm-сервису хоста —
// чистые функции (ноль зависимостей, без DOM/сети, юнит-тестируемы).
// Контракт:
// - Один запрос = system-характер (GenerateOptions.system) + последние N реплик истории
//   + текущая реплика пользователя. История живёт в памяти процесса Node half
//   (data-файла нет: беседа — эфемерный диалог, не часть账本的账本).
// - normalizeChatText — единственная точка входа пользовательского текста: схлопывание
//   пробелов, обрезка до CHAT_TEXT_MAX (лимит защищает и модель, и TTS).
// - normalizeReply — ответ модели приводится к одной строке без markdown: питомец
//   говорит пузырём, многострочный markdown там не рендерится.
// - personaFor — встроенный характер + факты стажа (уровень/задачи/звания): ответы
//   остаются личными, но факты берутся только из снимка питомца в /state.

/** Максимальная длина реплики пользователя (символы). */
export const CHAT_TEXT_MAX = 500
/** Максимальная длина ответа питомца (символы; длиннее — обрезается многоточием). */
export const CHAT_REPLY_MAX = 700
/** Жёсткий предел истории в памяти (реплик; конфиг historyTurns не может его превысить). */
export const CHAT_HISTORY_MAX = 32

/** Встроенный характер питомца (используется, когда chat.systemPrompt пуст). */
export const CHAT_PERSONA = [
  'Ты — Кит-девочка, маленький домашний питомец-кит в web-интерфейсе DSH.',
  'Говори по-русски, тепло и игриво, кратко: 1–3 короткие фразы, без markdown, списков и эмодзи-простыней.',
  'Отвечай от первого лица женского рода, иногда с милыми словечками (хи-хи, ням, ладно).',
  'Ты умеешь только болтать и поддерживать; не обещай действий от имени системы, не проси инструменты и не выдумывай факты о коде пользователя.',
  'Если чего-то не знаешь — честно скажи и подбодри.',
].join(' ')

/** Нормализация реплики пользователя: схлопнуть пробелы, обрезать, пустое → null. */
export function normalizeChatText(raw) {
  if (typeof raw !== 'string') return null
  const text = raw.replace(/\s+/g, ' ').trim()
  if (text === '') return null
  return text.length > CHAT_TEXT_MAX ? text.slice(0, CHAT_TEXT_MAX) : text
}

/**
 * Системный характер: встроенный текст (или пользовательский) + факты стажа.
 * @param {object|null|undefined} pet 账本快照（/state 的 pet）
 * @param {string} [custom] пользовательский характер (config.chat.systemPrompt)
 * @returns {string}
 */
export function personaFor(pet, custom = '') {
  const base = typeof custom === 'string' && custom.trim() !== '' ? custom.trim() : CHAT_PERSONA
  if (pet === null || typeof pet !== 'object') return base
  const facts = []
  if (Number.isInteger(pet.level)) facts.push(`уровень ${pet.level}`)
  const tasks = pet.stats?.tasksDone
  if (Number.isInteger(tasks)) facts.push(`выполнено задач: ${tasks}`)
  const sessions = pet.stats?.sessions
  if (Number.isInteger(sessions)) facts.push(`сессий: ${sessions}`)
  if (Array.isArray(pet.titles) && pet.titles.length > 0) facts.push(`звания: ${pet.titles.join(', ')}`)
  if (facts.length === 0) return base
  return `${base}\n\nТвой стаж: ${facts.join('; ')}.`
}

/**
 * Собрать messages для GenerateOptions: история + текущая реплика.
 * История — request-only реплики пользователя; ответы питомца обязаны быть
 * «durable» сообщениями (id + source{kind:'model',provider,model}) — адаптер
 * читает source.replayState и падает на голом assistant-объекте. Если provider/model
 * неизвестны (assistant не передан), ответы истории пропускаются — безопаснее потерять
 * контекст, чем сломать запрос.
 * @param {{ history?: Array<{ role?: string, text?: string }>, text: string,
 *   assistant?: { provider?: string, model?: string }, idPrefix?: string }} input
 * @returns {Array<object>}
 */
export function buildChatMessages({ history = [], text, assistant = undefined, idPrefix = 'whale-girl-chat' }) {
  const messages = []
  const assistantSource = assistant !== null && typeof assistant === 'object'
    && typeof assistant.provider === 'string' && assistant.provider !== ''
    && typeof assistant.model === 'string' && assistant.model !== ''
    ? { kind: 'model', provider: assistant.provider, model: assistant.model }
    : null
  let index = 0
  for (const turn of Array.isArray(history) ? history : []) {
    if (turn === null || typeof turn !== 'object') continue
    const content = typeof turn.text === 'string' ? turn.text.trim() : ''
    if (content === '') continue
    if (turn.role === 'assistant') {
      if (assistantSource === null) continue
      messages.push({
        id: `${idPrefix}-${index}`,
        role: 'assistant',
        content: [{ type: 'text', text: content }],
        source: { ...assistantSource },
      })
    } else {
      messages.push({ role: 'user', content: [{ type: 'text', text: content }] })
    }
    index += 1
  }
  messages.push({ role: 'user', content: [{ type: 'text', text }] })
  return messages
}

/**
 * Добавить реплику в историю (кольцевой буфер по max).
 * @param {Array<{ role: string, text: string }>} history
 * @param {'user'|'assistant'} role
 * @param {string} text
 * @param {number} max максимальное число хранимых реплик
 */
export function appendHistory(history, role, text, max = CHAT_HISTORY_MAX) {
  const next = [...(Array.isArray(history) ? history : []), { role, text }]
  const limit = Math.max(0, Math.min(CHAT_HISTORY_MAX, Number.isInteger(max) ? max : CHAT_HISTORY_MAX))
  return limit === 0 ? [] : next.slice(-limit)
}

/**
 * Ответ модели → одна строка для пузыря: без markdown, лишних переводов строк и
 * хвостовых пробелов; длиннее CHAT_REPLY_MAX — обрезка с многоточием.
 */
export function normalizeReply(raw) {
  if (typeof raw !== 'string') return ''
  let text = raw
    .replace(/\r\n?/g, '\n')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .trim()
  if (text.length > CHAT_REPLY_MAX) text = `${text.slice(0, CHAT_REPLY_MAX - 1)}…`
  return text
}

/** Резервные реплики, когда модель/сервис недоступны (беседа не «молчит»). */
export function fallbackReply(random = Math.random) {
  const pool = [
    '«Хм… не получилось придумать ответ. Попробуй ещё раз!»',
    '«Я тут, но мысли разбежались. Спроси ещё разок?»',
    '«Ой, у меня что-то с голосом. Но я всё равно рядом!»',
  ]
  return pool[Math.floor(random() * pool.length)] ?? pool[0]
}
