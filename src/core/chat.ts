// Pure pet-chat helpers: persona, ephemeral history, and requests for the host LLM service; no DOM or network.
// Each request combines GenerateOptions.system, recent history, and the current user message.
// History lives only in backend process memory, outside the persistent pet ledger.
// normalizeChatText is the user-text boundary: collapse whitespace and cap CHAT_TEXT_MAX for the model and TTS.
// normalizeReply produces a single plain-text line because speech bubbles do not render multiline Markdown.
// personaFor combines the chosen persona with level, task, and title facts from the /state snapshot.
import { cleanSpeechText } from './speech-text.js'

export interface ModelSelection { provider: string; model: string }
export interface ChatExtras { sessionContext?: string; headlines?: string[]; newsUnavailable?: boolean }
export interface HistoryTurn { role: 'user' | 'assistant'; text: string }
export interface ChatMessage {
  role: 'user' | 'assistant'; content: { type: 'text'; text: string }[];
  id?: string; source?: { kind: string; provider: string; model: string };
}
interface PetFacts { level?: number; stats?: { tasksDone?: number; sessions?: number }; titles?: unknown[] }

/** Maximum user-message length in characters. */
export const CHAT_TEXT_MAX = 500
/** Maximum pet-reply length in characters; longer replies end with an ellipsis. */
export const CHAT_REPLY_MAX = 700
/** Hard in-memory history limit in messages; historyTurns cannot exceed it. */
export const CHAT_HISTORY_MAX = 32

/** Built-in pet persona, used when chat.systemPrompt is empty. */
export const CHAT_EMOJI_STYLE = 'Добавляй к ответу 1–2 уместных эмодзи, например 🐳, 😊 или ✨. Не ставь эмодзи в каждую фразу и не составляй из них длинные цепочки.'
export const CHAT_PERSONA = [
  'Ты — Кит-девочка, маленький домашний питомец-кит в web-интерфейсе DSH.',
  'Говори по-русски, живо и тепло: 2–4 короткие фразы, без markdown и списков.',
  CHAT_EMOJI_STYLE,
  'Отвечай от первого лица женского рода, с мягким юмором и милыми словечками (хи-хи, ням, ладно).',
  'Когда уместно, задай один короткий встречный вопрос — но не в каждом ответе.',
  'Если уместно по теме беседы, предложи один конкретный совет по программированию или работе с AI: маленький проверяемый шаг вместо лекции. Опирайся на доступный контекст, не выдумывай детали проекта.',
  'Ты умеешь только болтать и поддерживать; не обещай действий от имени системы, не проси инструменты и не выдумывай факты о коде пользователя.',
  'Если чего-то не знаешь — честно скажи и подбодри.',
].join(' ')

/** Collapse whitespace, cap user text, and return null for empty input. */
export function normalizeChatText(raw: unknown) {
  if (typeof raw !== 'string') return null
  const text = raw.replace(/\s+/g, ' ').trim()
  if (text === '') return null
  return text.length > CHAT_TEXT_MAX ? text.slice(0, CHAT_TEXT_MAX) : text
}

/**
 * Build the system persona from built-in or custom text, pet statistics, session facts, and fresh news.
 * @param pet Pet ledger snapshot from /state.
 * @param custom Optional persona from config.chat.systemPrompt.
 * @param extra Optional session and news context.
 */
export function personaFor(pet: PetFacts | null | undefined, custom = '', extra: ChatExtras = {}) {
  const base = typeof custom === 'string' && custom.trim() !== '' ? `${custom.trim()}\n${CHAT_EMOJI_STYLE}` : CHAT_PERSONA
  const blocks = [base]
  if (pet !== null && typeof pet === 'object') {
    const facts = []
    if (Number.isInteger(pet.level)) facts.push(`уровень ${pet.level}`)
    const tasks = pet.stats?.tasksDone
    if (Number.isInteger(tasks)) facts.push(`выполнено задач: ${tasks}`)
    const sessions = pet.stats?.sessions
    if (Number.isInteger(sessions)) facts.push(`сессий: ${sessions}`)
    if (Array.isArray(pet.titles) && pet.titles.length > 0) facts.push(`звания: ${pet.titles.join(', ')}`)
    if (facts.length > 0) blocks.push(`Твой стаж: ${facts.join('; ')}.`)
  }
  const sessionContext = typeof extra?.sessionContext === 'string' ? extra.sessionContext.trim() : ''
  if (sessionContext !== '') {
    blocks.push(
      `Факты об активной сессии:\n${sessionContext}\n`
      + 'Отвечай про сессию только по этим фактам; если факта нет — честно скажи, что не знаешь.',
    )
  }
  const headlines = Array.isArray(extra?.headlines)
    ? extra.headlines.filter((line) => typeof line === 'string' && line.trim() !== '')
    : []
  if (headlines.length > 0) {
    blocks.push(
      `Свежие новости:\n${headlines.map((line) => `- ${line.trim()}`).join('\n')}\n`
      + 'Перескажи 2–3 новости своими словами и ничего не выдумывай.',
    )
  } else if (extra?.newsUnavailable === true) {
    blocks.push('Свежие новости сейчас недоступны: скажи об этом честно и ничего не выдумывай.')
  }
  return blocks.join('\n\n')
}

/**
 * Build GenerateOptions messages from history and the current message.
 * User history is request-only. Assistant history needs durable IDs and source metadata
 * { kind: 'model', provider, model }; the adapter reads source.replayState and rejects a bare assistant object.
 * When provider/model are unknown, omit assistant history rather than breaking the request.
 */
export function buildChatMessages({ history = [], text, assistant, idPrefix = 'whale-girl-chat' }: { history?: HistoryTurn[]; text: string; assistant?: ModelSelection; idPrefix?: string }): ChatMessage[] {
  const messages: ChatMessage[] = []
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
 * Append a message to the bounded history buffer.
 * @param max Maximum number of retained messages.
 */
export function appendHistory(history: HistoryTurn[], role: HistoryTurn['role'], text: string, max = CHAT_HISTORY_MAX): HistoryTurn[] {
  const next = [...(Array.isArray(history) ? history : []), { role, text }]
  const limit = Math.max(0, Math.min(CHAT_HISTORY_MAX, Number.isInteger(max) ? max : CHAT_HISTORY_MAX))
  return limit === 0 ? [] : next.slice(-limit)
}

/** Convert a model reply to one bubble line without Markdown, extra newlines, or trailing spaces; cap CHAT_REPLY_MAX with an ellipsis. */
export function normalizeReply(raw: unknown) {
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

/**
 * Fit bubble text to max characters, preferably at a sentence boundary.
 * If no sentence fits, truncate at the last space and append an ellipsis.
 */
export function bubbleText(reply: unknown, max = 140) {
  if (typeof reply !== 'string') return ''
  const line = reply.replace(/\s+/g, ' ').trim()
  if (line.length <= max) return line
  const slice = line.slice(0, max)
  const sentence = /([.!?…])(\s|$)/g
  let cut = -1
  let match
  while ((match = sentence.exec(slice)) !== null) cut = match.index + (match[1]?.length ?? 0)
  let head = cut > 0 ? slice.slice(0, cut) : slice
  if (cut <= 0) {
    const space = head.lastIndexOf(' ')
    if (space > 0) head = head.slice(0, space)
  }
  head = head.trim().replace(/[\s.,;:—-]+$/, '')
  return head === '' ? '…' : `${head}…`
}

/** Produce speech text from the same reply, removing emoji and guillemets. */
export function speechText(reply: unknown) {
  return cleanSpeechText(reply)
}

/** Fallback replies when the model or service is unavailable, so the pet still responds. */
export function fallbackReply(random = Math.random) {
  const pool = [
    '«Хм… не получилось придумать ответ. Попробуй ещё раз!»',
    '«Я тут, но мысли разбежались. Спроси ещё разок?»',
    '«Ой, у меня что-то с голосом. Но я всё равно рядом!»',
  ]
  return pool[Math.floor(random() * pool.length)] ?? pool[0]
}
