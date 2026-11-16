// Свежие новости для беседы: разбор RSS/Atom и загрузка лент — чистые функции и
// один сетевой помощник с инъекцией fetch/now (юнит-тестируем без сети).
// Контракт:
// - wantsNews(text) — единственная эвристика «пользователь просит новости»
//   (русские формулировки + английское news).
// - parseFeed(xml) — принимает RSS <item> и Atom <entry>, понимает CDATA,
//   декодирует сущности, снимает теги, ограничивает заголовок NEWS_TITLE_MAX.
// - formatHeadlines(items, max) — строки для системного промпта.
// - fetchHeadlines — только http(s), таймаут 8 с, предел ответа 1 МБ, кэш 10 минут,
//   Promise.allSettled (упавшая лента не роняет остальные), свежие — первыми.

/** Таймаут запроса ленты. */
export const NEWS_TIMEOUT_MS = 8000
/** Предел размера ответа одной ленты (защита памяти). */
export const NEWS_MAX_BYTES = 1024 * 1024
/** Время жизни кэша заголовков. */
export const NEWS_CACHE_MS = 10 * 60 * 1000
/** Предел длины заголовка (символы). */
export const NEWS_TITLE_MAX = 200

/** Ленты по умолчанию (только http/https; см. config.news.feeds). */
export const DEFAULT_FEEDS = Object.freeze([
  'https://lenta.ru/rss/news',
  'https://habr.com/ru/rss/news/?fl=ru',
  'https://hnrss.org/frontpage',
])

const NEWS_RE = /новост|что нового|что в мире|news/i

/** Просит ли пользователь свежие новости. */
export function wantsNews(text) {
  return typeof text === 'string' && NEWS_RE.test(text)
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

/** Декодировать HTML-сущности (именованные и числовые). */
export function decodeEntities(text) {
  if (typeof text !== 'string') return ''
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole
    }
    return Object.prototype.hasOwnProperty.call(ENTITIES, name.toLowerCase()) ? ENTITIES[name.toLowerCase()] : whole
  })
}

/** Снять CDATA-обёртку, теги и схлопнуть пробелы; сущности декодируются. */
export function stripMarkup(raw) {
  if (typeof raw !== 'string') return ''
  const noCdata = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  const noTags = noCdata.replace(/<[^>]*>/g, ' ')
  return decodeEntities(noTags).replace(/\s+/g, ' ').trim()
}

function firstTag(block, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
  const match = re.exec(block)
  return match === null ? '' : match[1]
}

function atomLink(block) {
  const re = /<link\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*\/?>/i
  const match = re.exec(block)
  return match === null ? '' : decodeEntities(match[1]).trim()
}

function parseDate(block) {
  const raw = firstTag(block, 'pubDate') || firstTag(block, 'published') || firstTag(block, 'updated') || ''
  const time = Date.parse(stripMarkup(raw))
  return Number.isFinite(time) ? time : null
}

function parseBlock(block) {
  const title = stripMarkup(firstTag(block, 'title')).slice(0, NEWS_TITLE_MAX)
  if (title === '') return null
  const link = stripMarkup(firstTag(block, 'link')) || atomLink(block)
  return { title, link, publishedAt: parseDate(block) }
}

/**
 * Разобрать RSS/Atom-ленту в список заголовков.
 * @param {string} xml
 * @returns {Array<{ title: string, link: string, publishedAt: number | null }>}
 */
export function parseFeed(xml) {
  if (typeof xml !== 'string' || xml.trim() === '') return []
  const items = []
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) ?? []
  for (const block of blocks) {
    const parsed = parseBlock(block)
    if (parsed !== null) items.push(parsed)
  }
  return items
}

/**
 * Строки заголовков для промпта: «Заголовок — ссылка».
 * @param {ReadonlyArray<{ title?: string, link?: string }>} items
 * @param {number} [max]
 * @returns {string[]}
 */
export function formatHeadlines(items, max = 5) {
  const limit = Number.isInteger(max) && max > 0 ? max : 5
  return (Array.isArray(items) ? items : [])
    .filter((item) => item !== null && typeof item === 'object' && typeof item.title === 'string' && item.title.trim() !== '')
    .slice(0, limit)
    .map((item) => {
      const title = item.title.trim()
      const link = typeof item.link === 'string' ? item.link.trim() : ''
      return link === '' ? title : `${title} — ${link}`
    })
}

let feedCache = { key: '', at: 0, items: [] }

/** Сбросить кэш заголовков (тесты/принудительное обновление). */
export function resetNewsCache() {
  feedCache = { key: '', at: 0, items: [] }
}

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim())
}

async function fetchOne(url, fetchImpl, now) {
  if (!isHttpUrl(url)) return []
  const response = await fetchImpl(url.trim(), {
    method: 'GET',
    headers: { accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
    redirect: 'error',
    signal: AbortSignal.timeout(NEWS_TIMEOUT_MS),
  })
  if (response === null || typeof response !== 'object' || response.ok !== true) return []
  const declared = Number(response.headers?.get?.('content-length') ?? NaN)
  if (Number.isFinite(declared) && declared > NEWS_MAX_BYTES) return []
  const text = await response.text()
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > NEWS_MAX_BYTES) return []
  return parseFeed(text)
}

/**
 * Загрузить заголовки из лент (кэш 10 минут, свежие первыми).
 * @param {object} [options]
 * @param {string[]} [options.feeds]
 * @param {number} [options.maxItems]
 * @param {typeof fetch} [options.fetch]
 * @param {() => number} [options.now]
 * @returns {Promise<{ ok: boolean, items: Array<object>, fetchedAt: number }>}
 */
export async function fetchHeadlines({
  feeds = DEFAULT_FEEDS,
  maxItems = 5,
  fetch: fetchImpl = globalThis.fetch,
  now = Date.now,
} = {}) {
  const list = (Array.isArray(feeds) ? feeds : []).filter(isHttpUrl).slice(0, 20)
  const key = list.join('|')
  const at = now()
  if (feedCache.key === key && at - feedCache.at < NEWS_CACHE_MS && feedCache.items.length > 0) {
    return { ok: true, items: feedCache.items, fetchedAt: feedCache.at }
  }
  if (typeof fetchImpl !== 'function' || list.length === 0) {
    return { ok: false, items: [], fetchedAt: at }
  }
  const settled = await Promise.allSettled(list.map((url) => fetchOne(url, fetchImpl, at)))
  const items = settled
    .filter((entry) => entry.status === 'fulfilled')
    .flatMap((entry) => entry.value)
    .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
  if (items.length === 0) return { ok: false, items: [], fetchedAt: at }
  const limited = items.slice(0, Number.isInteger(maxItems) && maxItems > 0 ? maxItems : 5)
  feedCache = { key, at, items: limited }
  return { ok: true, items: limited, fetchedAt: at }
}
