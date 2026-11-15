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
  const ctx = {
    effect: (fn) => { fn(); return () => {} },
    on: () => () => {},
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
  return { call, module }
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
