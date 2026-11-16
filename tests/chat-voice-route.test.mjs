// Роут-уровень: /chat и /voice на мок-хосте (llm-сервис и fetch подменяются).
// Проверяем HTTP-контракт: CSRF, лимиты тела, включённость функций, ответ модели,
// сериализацию беседы, деградацию без llm и бинарный ответ TTS.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// DSH_HOME читается на импорте модуля — ставим до первого динамического import.
const home = mkdtempSync(join(tmpdir(), 'whale-chat-'))
process.env.DSH_HOME = home
mkdirSync(join(home, 'data', 'whale-girl'), { recursive: true })
writeFileSync(join(home, 'data', 'whale-girl', 'state.json'), JSON.stringify({}))

/**
 * Запустить Node half с мок-контекстом.
 * @param {{ llm?: object, defaultModel?: object|null, config?: object, fetchImpl?: Function }} opts
 */
async function boot({ llm = undefined, defaultModel = { currentSelection: () => ({ provider: 'mock-provider', model: 'mock-model' }) }, config = {}, fetchImpl = undefined } = {}) {
  const routes = []
  const services = {
    webServer: { register: (route) => { routes.push(route) } },
    llm,
    agentDefaultModel: defaultModel,
  }
  const handlers = new Map()
  const ctx = {
    effect: (fn) => { fn(); return () => {} },
    on: (name, fn) => {
      const list = handlers.get(name) ?? []
      list.push(fn)
      handlers.set(name, list)
      return () => {}
    },
    provide: () => {},
    get: (name) => services[name],
    agents: { list: () => [] },
    jobs: { list: () => [], events: { subscribe: () => () => {} } },
    sessions: { list: () => [] },
    logger: { warn: () => {}, info: () => {}, error: () => {} },
  }
  const module = await import(`../lib/index.mjs?chat-test=${Date.now()}${Math.random()}`)
  module.apply(ctx, config)
  const realFetch = globalThis.fetch
  if (fetchImpl !== undefined) globalThis.fetch = fetchImpl
  const call = async (path, method, body, headers = {}) => {
    const route = routes.find((candidate) => candidate.path === path)
    assert.ok(route !== undefined, `route ${path} registered`)
    const chunks = body === undefined ? [] : [Buffer.from(body)]
    const req = {
      method,
      url: path,
      headers: { host: '127.0.0.1:1234', ...headers },
      async *[Symbol.asyncIterator]() { for (const chunk of chunks) yield chunk },
    }
    return await new Promise((resolve) => {
      const res = {
        status: 0,
        headers: {},
        body: undefined,
        writeHead(status, responseHeaders) { this.status = status; this.headers = responseHeaders ?? {} },
        end(payload) { this.body = payload; globalThis.fetch = realFetch; resolve(this) },
      }
      route.handler(req, res).catch((error) => {
        globalThis.fetch = realFetch
        resolve({ status: 500, headers: {}, body: String(error) })
      })
    })
  }
  const emit = (name, ...args) => {
    for (const fn of handlers.get(name) ?? []) fn(...args)
  }
  return { call, module, emit }
}

const json = (res) => JSON.parse(typeof res.body === 'string' ? res.body : String(res.body))

/** Фейковый llm-сервис: отдаёт текст чанками, опционально завершает ошибкой. */
function fakeLlm({ text = 'Привет! Я тут.', failure = null, onRequest = () => {} } = {}) {
  return {
    stream(options) {
      onRequest(options)
      return (async function* gen() {
        yield { type: 'block-start', index: 0, blockType: 'text' }
        for (const part of text.match(/.{1,5}/gs) ?? []) yield { type: 'text-delta', index: 0, text: part }
        yield { type: 'finish', reason: failure === null ? { kind: 'stop' } : { kind: 'error', failure } }
      })()
    },
  }
}

test('POST /chat: без llm → 503 и резервная фраза', async () => {
  const { call, module } = await boot({ llm: undefined })
  const res = await call(module.CHAT_PATH, 'POST', JSON.stringify({ text: 'привет' }), { 'sec-fetch-site': 'same-origin' })
  assert.equal(res.status, 503)
  const body = json(res)
  assert.equal(body.error, 'chat-unavailable')
  assert.ok(body.reply.startsWith('«'))
})

test('POST /chat: ответ модели и параметры запроса (модель по умолчанию)', async () => {
  let seen = null
  const { call, module } = await boot({ llm: fakeLlm({ onRequest: (options) => { seen = options } }) })
  const res = await call(module.CHAT_PATH, 'POST', JSON.stringify({ text: '  как   дела?  ' }), { 'sec-fetch-site': 'same-origin' })
  assert.equal(res.status, 200)
  assert.equal(json(res).reply, 'Привет! Я тут.')
  assert.equal(seen.provider, 'mock-provider')
  assert.equal(seen.model, 'mock-model')
  assert.ok(typeof seen.system === 'string' && seen.system.includes('Кит-девочка'), 'system — характер питомца')
  assert.deepEqual(seen.messages.at(-1), { role: 'user', content: [{ type: 'text', text: 'как дела?' }] }, 'пробелы схлопнуты')
  assert.equal(seen.maxTokens, 300)
})

test('POST /chat: история сохраняется между запросами (последняя реплика в контексте)', async () => {
  const seen = []
  const { call, module } = await boot({ llm: fakeLlm({ onRequest: (options) => { seen.push(options) } }) })
  await call(module.CHAT_PATH, 'POST', JSON.stringify({ text: 'первый' }), { 'sec-fetch-site': 'same-origin' })
  await call(module.CHAT_PATH, 'POST', JSON.stringify({ text: 'второй' }), { 'sec-fetch-site': 'same-origin' })
  assert.equal(seen.length, 2)
  assert.equal(seen[1].messages.length, 3, 'история: user/assistant + новая реплика')
  assert.equal(seen[1].messages[0].content[0].text, 'первый')
  assert.equal(seen[1].messages[1].role, 'assistant')
})

test('POST /chat: ошибка стрима модели → 502 с резервной фразой', async () => {
  const { call, module } = await boot({ llm: fakeLlm({ text: '', failure: { code: 'RATE_LIMIT' } }) })
  const res = await call(module.CHAT_PATH, 'POST', JSON.stringify({ text: 'эй' }), { 'sec-fetch-site': 'same-origin' })
  assert.equal(res.status, 502)
  assert.equal(json(res).error, 'chat-failed')
  assert.ok(json(res).reply.length > 0)
})

test('POST /chat: пустой поток модели повторяется один раз', async () => {
  let calls = 0
  const llm = {
    stream() {
      calls += 1
      const text = calls === 1 ? '' : 'Со второго раза!'
      return (async function* gen() {
        for (const part of text.match(/.{1,5}/gs) ?? []) yield { type: 'text-delta', index: 0, text: part }
        yield { type: 'finish', reason: { kind: 'stop' } }
      })()
    },
  }
  const { call, module } = await boot({ llm })
  const res = await call(module.CHAT_PATH, 'POST', JSON.stringify({ text: 'привет' }), { 'sec-fetch-site': 'same-origin' })
  assert.equal(res.status, 200)
  assert.equal(json(res).reply, 'Со второго раза!')
  assert.equal(calls, 2)
})

test('POST /chat: два пустых потока → 502 chat-empty без повтора', async () => {
  let calls = 0
  const llm = {
    stream() {
      calls += 1
      return (async function* gen() {
        yield { type: 'finish', reason: { kind: 'stop' } }
      })()
    },
  }
  const { call, module } = await boot({ llm })
  const res = await call(module.CHAT_PATH, 'POST', JSON.stringify({ text: 'привет' }), { 'sec-fetch-site': 'same-origin' })
  assert.equal(res.status, 502)
  assert.equal(json(res).error, 'chat-empty')
  assert.equal(json(res).failureCode, null)
  assert.equal(calls, 2)
})

test('POST /chat: cross-origin / выключенный чат / пустой текст / большое тело', async () => {
  const { call, module } = await boot({ llm: fakeLlm() })
  assert.equal((await call(module.CHAT_PATH, 'POST', JSON.stringify({ text: 'x' }), { 'sec-fetch-site': 'cross-site' })).status, 403)
  assert.equal((await call(module.CHAT_PATH, 'POST', JSON.stringify({ text: 'x' }), { origin: 'http://evil.example' })).status, 403)
  assert.equal((await call(module.CHAT_PATH, 'POST', JSON.stringify({ text: '   ' }), { 'sec-fetch-site': 'same-origin' })).status, 400)
  assert.equal((await call(module.CHAT_PATH, 'GET', undefined, { 'sec-fetch-site': 'same-origin' })).status, 405)
  const huge = JSON.stringify({ text: 'x'.repeat(6000) })
  assert.equal((await call(module.CHAT_PATH, 'POST', huge, { 'sec-fetch-site': 'same-origin' })).status, 413)

  const disabled = await boot({ llm: fakeLlm(), config: { chat: { enabled: false } } })
  assert.equal((await disabled.call(disabled.module.CHAT_PATH, 'POST', JSON.stringify({ text: 'x' }), { 'sec-fetch-site': 'same-origin' })).status, 403)
})

test('POST /chat: явная пара provider/model из настроек важнее модели хоста', async () => {
  let seen = null
  const { call, module } = await boot({
    llm: fakeLlm({ onRequest: (options) => { seen = options } }),
    config: { chat: { provider: 'my-provider', model: 'my-model' } },
  })
  const res = await call(module.CHAT_PATH, 'POST', JSON.stringify({ text: 'x' }), { 'sec-fetch-site': 'same-origin' })
  assert.equal(res.status, 200)
  assert.equal(seen.provider, 'my-provider')
  assert.equal(seen.model, 'my-model')
})

test('POST /voice: выключенный голос / browser-провайдер / пустой текст', async () => {
  const { call, module } = await boot({ llm: fakeLlm() })
  assert.equal((await call(module.VOICE_PATH, 'POST', JSON.stringify({ text: 'x' }), { 'sec-fetch-site': 'same-origin' })).status, 403)

  const browser = await boot({ llm: fakeLlm(), config: { voice: { enabled: true, provider: 'browser' } } })
  const res = await browser.call(browser.module.VOICE_PATH, 'POST', JSON.stringify({ text: 'x' }), { 'sec-fetch-site': 'same-origin' })
  assert.equal(res.status, 400)
  assert.equal(json(res).error, 'voice-provider-browser')

  const badUrl = await boot({ llm: fakeLlm(), config: { voice: { enabled: true, provider: 'openai', baseUrl: 'ftp://nope' } } })
  assert.equal((await badUrl.call(badUrl.module.VOICE_PATH, 'POST', JSON.stringify({ text: 'x' }), { 'sec-fetch-site': 'same-origin' })).status, 400)
})

test('POST /voice: openai-провайдер → бинарный аудиоответ и заголовок ключа', async () => {
  const audio = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00])
  let seen = null
  const fetchImpl = async (url, init) => {
    seen = { url, init }
    return new Response(audio, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
  }
  const { call, module } = await boot({
    llm: fakeLlm(),
    config: { voice: { enabled: true, provider: 'openai', baseUrl: 'http://localhost:8880/v1', model: 'kokoro', voice: 'af_heart', apiKey: 'sk-test' } },
    fetchImpl,
  })
  const res = await call(module.VOICE_PATH, 'POST', JSON.stringify({ text: 'Привет, мир' }), { 'sec-fetch-site': 'same-origin' })
  assert.equal(res.status, 200)
  assert.equal(res.headers['content-type'], 'audio/mpeg')
  assert.deepEqual(res.body, audio)
  assert.equal(seen.url, 'http://localhost:8880/v1/audio/speech')
  assert.equal(seen.init.headers.authorization, 'Bearer sk-test')
  assert.equal(JSON.parse(seen.init.body).input, 'Привет, мир')
  assert.equal(JSON.parse(seen.init.body).model, 'kokoro')
})

test('POST /voice: ошибка TTS-сервера → 502 без бинарного мусора', async () => {
  const fetchImpl = async () => new Response('nope', { status: 500, headers: { 'content-type': 'text/plain' } })
  const { call, module } = await boot({
    llm: fakeLlm(),
    config: { voice: { enabled: true, provider: 'openai', baseUrl: 'http://localhost:8880/v1' } },
    fetchImpl,
  })
  const res = await call(module.VOICE_PATH, 'POST', JSON.stringify({ text: 'x' }), { 'sec-fetch-site': 'same-origin' })
  assert.equal(res.status, 502)
  assert.equal(json(res).error, 'tts-failed')
})

// ---- выбор модели (GET /models) ----

test('GET /models: провайдеры/модели llm, сбой одного провайдера пропускается и кэшируется', async () => {
  let calls = 0
  const llm = {
    listProviders: () => [{ id: 'p1', name: 'Первый' }, { id: 'p2', name: 'Второй' }],
    listModels: async (provider) => {
      calls += 1
      if (provider === 'p2') throw new Error('offline')
      return [{ id: 'm1', name: 'Модель 1' }]
    },
  }
  const { call, module } = await boot({ llm })
  const res = await call(module.MODELS_PATH, 'GET')
  assert.equal(res.status, 200)
  const body = json(res)
  assert.deepEqual(body.current, { provider: 'mock-provider', model: 'mock-model' })
  assert.deepEqual(body.hostDefault, { provider: 'mock-provider', model: 'mock-model' })
  assert.deepEqual(body.options, [{ provider: 'p1', model: 'm1', label: 'Первый / Модель 1' }])
  const again = await call(module.MODELS_PATH, 'GET')
  assert.equal(json(again).options.length, 1)
  assert.equal(calls, 2, 'второй GET — из кэша (по одному вызову на провайдера)')
})

test('GET /models: нет llm-каталога → 200 с пустым options (не 500)', async () => {
  const { call, module } = await boot({ llm: fakeLlm() })
  const res = await call(module.MODELS_PATH, 'GET')
  assert.equal(res.status, 200)
  assert.deepEqual(json(res).options, [])
  const wrongMethod = await call(module.MODELS_PATH, 'POST', '{}')
  assert.equal(wrongMethod.status, 405)
})

// ---- распознавание речи (POST /transcribe) ----

const sttConfig = {
  voice: {
    enabled: true, provider: 'openai', baseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-secret', sttModel: 'whisper-1',
  },
}

test('POST /transcribe: сырое аудио → multipart на /audio/transcriptions, ключ не утекает в ответ', async () => {
  let seen = null
  const fetchImpl = async (url, options) => {
    seen = { url, options }
    return { ok: true, json: async () => ({ text: '  привет, кит  ' }) }
  }
  const { call, module } = await boot({ config: sttConfig, fetchImpl })
  const res = await call(module.TRANSCRIBE_PATH, 'POST', Buffer.from('audio-bytes'), { 'content-type': 'audio/webm;codecs=opus' })
  assert.equal(res.status, 200)
  assert.deepEqual(json(res), { text: 'привет, кит' })
  assert.equal(seen.url, 'https://api.openai.com/v1/audio/transcriptions')
  assert.equal(seen.options.headers.authorization, 'Bearer sk-secret')
  assert.ok(seen.options.body instanceof FormData)
  assert.equal(seen.options.body.get('model'), 'whisper-1')
  assert.equal(seen.options.body.get('language'), 'ru')
  assert.ok(!JSON.stringify(json(res)).includes('sk-secret'), 'ключ не возвращается')
})

test('POST /transcribe: 415 не-audio, 413 больше 5 МБ, 403 cross-origin', async () => {
  const { call, module } = await boot({ config: sttConfig, fetchImpl: async () => ({ ok: true, json: async () => ({ text: 'x' }) }) })
  const wrongType = await call(module.TRANSCRIBE_PATH, 'POST', Buffer.from('{}'), { 'content-type': 'application/json' })
  assert.equal(wrongType.status, 415)
  const huge = await call(module.TRANSCRIBE_PATH, 'POST', Buffer.alloc(5 * 1024 * 1024 + 1), { 'content-type': 'audio/webm' })
  assert.equal(huge.status, 413)
  const cross = await call(module.TRANSCRIBE_PATH, 'POST', Buffer.from('x'), { 'content-type': 'audio/webm', 'sec-fetch-site': 'cross-site' })
  assert.equal(cross.status, 403)
})

test('POST /transcribe: голос выключен → 403; провайдер browser → 400', async () => {
  const off = await boot({ config: { voice: { enabled: false } } })
  const disabled = await off.call(off.module.TRANSCRIBE_PATH, 'POST', Buffer.from('x'), { 'content-type': 'audio/webm' })
  assert.equal(disabled.status, 403)
  const browser = await boot({ config: { voice: { enabled: true, provider: 'browser' } } })
  const res = await browser.call(browser.module.TRANSCRIBE_PATH, 'POST', Buffer.from('x'), { 'content-type': 'audio/webm' })
  assert.equal(res.status, 400)
  assert.equal(json(res).error, 'voice-provider-browser')
})

// ---- контекст сессии и новости в /chat ----

test('POST /chat: после turn/start в system попадает блок активной сессии', async () => {
  let seen = null
  const { call, module, emit } = await boot({ llm: fakeLlm({ onRequest: (options) => { seen = options } }) })
  emit('session/event', { id: 's1', header: { createdAt: Date.now() - 120000 } }, { type: 'turn/start', data: { turn: 1 } })
  emit('session/event', { id: 's1' }, { type: 'tool/call', data: { turn: 1, step: 1, callId: 'c', name: 'bash', arguments: '{}' } })
  const res = await call(module.CHAT_PATH, 'POST', JSON.stringify({ text: 'как дела?' }), { 'sec-fetch-site': 'same-origin' })
  assert.equal(res.status, 200)
  assert.match(seen.system, /Активные сессии:/)
  assert.match(seen.system, /инструментов: 1 \(последний: bash\)/)
  assert.match(seen.system, /только по этим фактам/)
})

test('POST /chat: sessionContext=false — блок сессии не добавляется', async () => {
  let seen = null
  const { call, module, emit } = await boot({ llm: fakeLlm({ onRequest: (options) => { seen = options } }), config: { chat: { enabled: true, sessionContext: false } } })
  emit('session/event', { id: 's1', header: { createdAt: Date.now() } }, { type: 'turn/start', data: { turn: 1 } })
  await call(module.CHAT_PATH, 'POST', JSON.stringify({ text: 'привет' }), { 'sec-fetch-site': 'same-origin' })
  assert.doesNotMatch(seen.system, /Активные сессии:/)
})

test('POST /chat: новостной запрос кладёт заголовки в system; ответ несёт bubble/speech', async () => {
  let seen = null
  const rss = '<rss><item><title>Свежая новость</title><link>https://n/1</link><pubDate>Mon, 16 Nov 2026 10:00:00 GMT</pubDate></item></rss>'
  const fetchImpl = async () => ({ ok: true, headers: { get: () => null }, text: async () => rss })
  const { call, module } = await boot({ llm: fakeLlm({ onRequest: (options) => { seen = options } }), fetchImpl })
  const res = await call(module.CHAT_PATH, 'POST', JSON.stringify({ text: 'расскажи свежие новости' }), { 'sec-fetch-site': 'same-origin' })
  assert.equal(res.status, 200)
  assert.match(seen.system, /Свежие новости:/)
  assert.match(seen.system, /Свежая новость — https:\/\/n\/1/)
  assert.match(seen.system, /ничего не выдумывай/)
  const body = json(res)
  assert.equal(typeof body.bubble, 'string')
  assert.equal(typeof body.speech, 'string')
  assert.ok(!body.speech.includes('🐳'))
})

test('POST /chat: новости недоступны — в system честная пометка, ответ не падает', async () => {
  let seen = null
  const { call, module } = await boot({
    llm: fakeLlm({ onRequest: (options) => { seen = options } }),
    fetchImpl: async () => { throw new Error('offline') },
    // Уникальные ленты: иначе кэш предыдущего теста отдаст заголовки и «недоступности» не будет.
    config: { news: { enabled: true, feeds: ['https://offline.example/feed'], maxItems: 2 } },
  })
  const res = await call(module.CHAT_PATH, 'POST', JSON.stringify({ text: 'что нового?' }), { 'sec-fetch-site': 'same-origin' })
  assert.equal(res.status, 200)
  assert.match(seen.system, /недоступны/)
})
