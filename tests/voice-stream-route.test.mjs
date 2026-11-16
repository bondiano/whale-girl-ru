import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'whale-voice-stream-'))
const { apply, VOICE_PATH } = await import('../dist/index.js')
const completed = { type: 'response.done', response: { status: 'completed' } }

async function fixture(t, onResponse) {
  const original = globalThis.WebSocket
  let voiceSocket
  class Socket extends EventTarget {
    closed = false
    constructor() {
      super()
      voiceSocket = this
      queueMicrotask(() => this.emit({ type: 'session.created' }))
    }
    send(raw) {
      const event = JSON.parse(raw)
      if (event.type === 'session.update') queueMicrotask(() => this.emit({ type: 'session.updated' }))
      if (event.type === 'response.create') queueMicrotask(() => onResponse(this))
    }
    close() { this.closed = true; this.dispatchEvent(new Event('closed')) }
    emit(value) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(value) })) }
  }
  globalThis.WebSocket = Socket
  const routes = []
  const services = { webServer: { host: '127.0.0.1', register: route => routes.push(route) }, sessions: { list: () => [], get() {} } }
  const ctx = {
    get: name => services[name], effect: fn => fn(), on: () => () => {}, provide() {},
    jobs: { list: () => [], events: { subscribe: () => () => {} } }, agents: { list: () => [] }, sessions: services.sessions,
  }
  apply(ctx, { voice: { enabled: true, provider: 'openai', model: 'gpt-realtime-2.1-mini', apiKey: 'local-test' } })
  const route = routes.find(candidate => candidate.path === VOICE_PATH)
  const server = createServer((req, res) => { void route.handler(req, res) })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(async () => {
    globalThis.WebSocket = original
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  })
  const url = `http://127.0.0.1:${server.address().port}${VOICE_PATH}`
  return { socket: () => voiceSocket, request: (signal = AbortSignal.timeout(2000), accept = 'audio/pcm') => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept }, body: JSON.stringify({ text: 'Привет! Я рядом.' }), signal }) }
}

test('voice route emits PCM headers and the first audio bytes before Realtime completion', async (t) => {
  const f = await fixture(t, socket => socket.emit({ type: 'response.output_audio.delta', delta: Buffer.from([0, 1, 2, 3]).toString('base64') }))
  const response = await f.request()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'audio/pcm;rate=24000;channels=1;encoding=s16le')
  assert.equal(response.headers.get('content-length'), null)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  const reader = response.body.getReader()
  assert.deepEqual((await reader.read()).value, new Uint8Array([0, 1, 2, 3]))
  assert.equal(f.socket().closed, false)
  f.socket().emit(completed)
  assert.equal((await reader.read()).done, true)
  assert.equal(f.socket().closed, true)
})

test('voice route reports failures before headers and terminates a failed partial stream', async (t) => {
  const early = await fixture(t, socket => socket.emit({ type: 'error' }))
  const failure = await early.request()
  assert.equal(failure.status, 502)
  assert.equal((await failure.json()).error, 'tts-failed')
  const partial = await fixture(t, socket => socket.emit({ type: 'response.output_audio.delta', delta: 'AAE=' }))
  const response = await partial.request()
  const reader = response.body.getReader()
  assert.equal((await reader.read()).value.byteLength, 2)
  partial.socket().emit({ type: 'response.done', response: { status: 'failed' } })
  await assert.rejects(reader.read(), /terminated|abort/i)
})

test('client disconnect aborts the upstream voice socket; default requests retain WAV', async (t) => {
  const f = await fixture(t, socket => socket.emit({ type: 'response.output_audio.delta', delta: 'AAE=' }))
  const controller = new AbortController()
  const response = await f.request(controller.signal)
  const reader = response.body.getReader()
  await reader.read()
  const closed = once(f.socket(), 'closed', { signal: AbortSignal.timeout(2000) })
  controller.abort()
  await closed
  assert.equal(f.socket().closed, true)

  const buffered = await fixture(t, socket => {
    socket.emit({ type: 'response.output_audio.delta', delta: 'AAE=' })
    socket.emit(completed)
  })
  const wav = await buffered.request(undefined, 'audio/*')
  assert.equal(wav.headers.get('content-type'), 'audio/wav')
  assert.equal(Buffer.from(await wav.arrayBuffer()).subarray(0, 4).toString(), 'RIFF')
})

test('voice route refuses an excessive pending output chunk and closes its upstream socket', async (t) => {
  const f = await fixture(t, socket => socket.emit({ type: 'response.output_audio.delta', delta: Buffer.alloc(512 * 1024 + 2).toString('base64') }))
  const response = await f.request()
  assert.equal(response.status, 502)
  assert.equal((await response.json()).error, 'tts-stream-failed')
  assert.equal(f.socket().closed, true)
})
