// News regressions cover RSS/Atom parsing, recency selection, networking, and caching.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  NEWS_CACHE_MS, NEWS_TITLE_MAX, decodeEntities, fetchHeadlines, formatHeadlines,
  parseFeed, resetNewsCache, stripMarkup, wantsNews,
} from '../dist/core/news.js'

const RSS = `<?xml version="1.0"?><rss><channel>
<item><title><![CDATA[Первая <b>новость</b>]]></title><link>https://a/1</link><pubDate>Mon, 16 Nov 2026 10:00:00 GMT</pubDate></item>
<item><title>Вторая &amp; важная</title><link>https://a/2</link><pubDate>Mon, 16 Nov 2026 11:00:00 GMT</pubDate></item>
</channel></rss>`

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
<entry><title>Атомная запись</title><link href="https://b/1"/><updated>2026-11-16T12:00:00Z</updated></entry>
</feed>`

test('wantsNews: русские формулировки и news', () => {
  for (const text of ['расскажи новости', 'Что нового?', 'что в мире творится', 'any news?']) {
    assert.equal(wantsNews(text), true, text)
  }
  for (const text of ['привет', 'как дела', '', null, 42]) assert.equal(wantsNews(text), false, String(text))
})

test('decodeEntities/stripMarkup: сущности и теги схлопываются, CDATA разворачивается', () => {
  assert.equal(decodeEntities('a &amp; b &lt;x&gt; &quot;q&quot; &#39;s&#39;'), `a & b <x> "q" 's'`)
  assert.equal(stripMarkup('<![CDATA[Первая <b>новость</b>]]>'), 'Первая новость')
  assert.equal(stripMarkup('  <p>a</p>\n<p>b</p>  '), 'a b')
})

test('parseFeed: RSS и Atom, свежие поля, заголовок не длиннее 200', () => {
  const rss = parseFeed(RSS)
  assert.equal(rss.length, 2)
  assert.equal(rss[0].title, 'Первая новость')
  assert.equal(rss[0].link, 'https://a/1')
  assert.equal(rss[1].title, 'Вторая & важная')
  assert.ok(rss[0].publishedAt > 0)
  const atom = parseFeed(ATOM)
  assert.equal(atom.length, 1)
  assert.equal(atom[0].title, 'Атомная запись')
  assert.equal(atom[0].link, 'https://b/1')
  assert.ok(atom[0].publishedAt > 0)
  assert.equal(parseFeed('').length, 0)
  assert.equal(parseFeed(null).length, 0)
  assert.equal(parseFeed('<rss><item><title>' + 'я'.repeat(500) + '</title></item></rss>')[0].title.length, NEWS_TITLE_MAX)
})

test('formatHeadlines: ограничивает число и приклеивает ссылку', () => {
  const items = [{ title: 'a', link: 'https://a' }, { title: 'b' }, { title: '  ' }, null]
  assert.deepEqual(formatHeadlines(items, 5), ['a — https://a', 'b'])
  assert.deepEqual(formatHeadlines(items, 1), ['a — https://a'])
  assert.deepEqual(formatHeadlines(null, 3), [])
})

test('fetchHeadlines: только http(s), свежие первыми, сбой одной ленты не валит остальные', async () => {
  resetNewsCache()
  const requested = []
  const fetchImpl = async (url) => {
    requested.push(url)
    if (url.includes('bad')) throw new Error('offline')
    const xml = url.includes('old') ? '<rss><item><title>Старая</title><pubDate>Mon, 16 Nov 2026 08:00:00 GMT</pubDate></item></rss>' : RSS
    return { ok: true, headers: { get: () => null }, text: async () => xml }
  }
  const news = await fetchHeadlines({
    feeds: ['ftp://nope', 'https://good/feed', 'https://bad/feed', 'https://old/feed'],
    maxItems: 2,
    fetch: fetchImpl,
    now: () => 1000,
  })
  assert.equal(news.ok, true)
  assert.deepEqual(requested, ['https://good/feed', 'https://bad/feed', 'https://old/feed'], 'не-http отброшен')
  assert.equal(news.items.length, 2)
  assert.equal(news.items[0].title, 'Вторая & важная', 'свежая (11:00) впереди')
})

test('fetchHeadlines: кэш в пределах NEWS_CACHE_MS, повторный запрос не ходит в сеть', async () => {
  resetNewsCache()
  let calls = 0
  let clock = 0
  const fetchImpl = async () => {
    calls += 1
    return { ok: true, headers: { get: () => null }, text: async () => RSS }
  }
  const first = await fetchHeadlines({ feeds: ['https://a/feed'], maxItems: 1, fetch: fetchImpl, now: () => clock })
  assert.equal(first.ok, true)
  clock += NEWS_CACHE_MS - 1
  const cached = await fetchHeadlines({ feeds: ['https://a/feed'], maxItems: 1, fetch: fetchImpl, now: () => clock })
  assert.equal(calls, 1, 'в пределах окна — из кэша')
  assert.deepEqual(cached.items, first.items)
  clock += 2
  await fetchHeadlines({ feeds: ['https://a/feed'], maxItems: 1, fetch: fetchImpl, now: () => clock })
  assert.equal(calls, 2, 'окно истекло — новый запрос')
  resetNewsCache()
})

test('fetchHeadlines: нет сети/пустой список → ok:false без исключения', async () => {
  resetNewsCache()
  const failed = await fetchHeadlines({ feeds: ['https://a/feed'], fetch: async () => { throw new Error('down') } })
  assert.equal(failed.ok, false)
  const empty = await fetchHeadlines({ feeds: [], fetch: async () => { throw new Error('no') } })
  assert.equal(empty.ok, false)
})
