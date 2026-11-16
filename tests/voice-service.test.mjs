import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { synthesizeVoice, pcmToWav, createNodeVoiceSocket } from '../dist/core/voice-service.js'
import { buildRealtimeVoiceRequest, TTS_MAX_BYTES } from '../dist/core/voice.js'

const realtime = { provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-realtime-2.1-mini', voice: 'marin', apiKey: 'sk-test', instructions: 'Тепло и игриво', rate: 1 }

class FakeSocket extends EventTarget {
  sent = []
  closed = false
  constructor(onSend = () => {}) {
    super()
    this.onSend = onSend
  }
  send(raw) {
    const event = JSON.parse(raw)
    this.sent.push(event)
    this.onSend(event, this)
  }
  close() { this.closed = true }
  emit(value) { this.dispatchEvent(new MessageEvent('message', { data: typeof value === 'string' ? value : JSON.stringify(value) })) }
}

function socketHarness(onResponse) {
  let seen
  const socket = new FakeSocket((event, instance) => {
    if (event.type === 'session.update') queueMicrotask(() => instance.emit({ type: 'session.updated' }))
    if (event.type === 'response.create') queueMicrotask(() => onResponse(instance))
  })
  const socketFactory = (url, headers) => {
    seen = { url, headers }
    queueMicrotask(() => socket.emit({ type: 'session.created' }))
    return socket
  }
  return { socket, socketFactory, seen: () => seen }
}

const completed = { type: 'response.done', response: { status: 'completed' } }

test('Realtime speech configures current model and voice, returns mono PCM24k WAV, closes socket', async () => {
  const pcm = Buffer.from([0, 0, 1, 0, 255, 127, 0, 128])
  const h = socketHarness((socket) => {
    socket.emit({ type: 'response.output_audio.delta', delta: pcm.toString('base64') })
    socket.emit(completed)
  })
  const result = await synthesizeVoice({ voice: realtime, text: '  Привет,   мир! ', socketFactory: h.socketFactory, fetchImpl: () => { throw new Error('Realtime must not call speech HTTP') } })
  assert.equal(result.ok, true)
  assert.equal(result.contentType, 'audio/wav')
  assert.equal(result.audio.subarray(0, 4).toString(), 'RIFF')
  assert.equal(result.audio.readUInt32LE(24), 24000)
  assert.equal(result.audio.readUInt16LE(22), 1)
  assert.equal(result.audio.readUInt16LE(34), 16)
  assert.deepEqual(result.audio.subarray(44), pcm)
  assert.equal(h.socket.closed, true)
  assert.equal(h.seen().url, 'wss://api.openai.com/v1/realtime?model=gpt-realtime-2.1-mini')
  assert.equal(h.seen().headers.authorization, 'Bearer sk-test')
  assert.ok(!h.seen().url.includes('sk-test'))
  const [update, item, response] = h.socket.sent
  assert.equal(update.session.audio.output.voice, 'marin')
  assert.equal(update.session.audio.input.turn_detection, null)
  assert.equal(update.session.audio.output.format.rate, 24000)
  assert.match(update.session.instructions, /дословно/)
  assert.equal(item.item.content[0].text, 'Привет, мир!')
  assert.deepEqual(response.response.output_modalities, ['audio'])
})

test('subscription voice never accesses credentials, fetch or sockets', async () => {
  const forbidden = () => { throw new Error('unexpected billing-capable operation') }
  const result = await synthesizeVoice({ voice: { provider: 'subscription', apiKeyEnv: 'OPENAI_API_KEY' }, text: 'Привет', env: new Proxy({}, { get: forbidden }), fetchImpl: forbidden, socketFactory: forbidden })
  assert.deepEqual(result, { ok: false, error: 'voice-subscription-unsupported' })
})

test('Realtime API requires explicitly configured key and never discovers OPENAI_API_KEY', async () => {
  const result = await synthesizeVoice({ voice: { ...realtime, apiKey: '', apiKeyEnv: 'WHALE_GIRL_TTS_API_KEY' }, text: 'Привет', env: { OPENAI_API_KEY: 'must-not-bill' }, socketFactory: () => { throw new Error('must not connect') } })
  assert.deepEqual(result, { ok: false, error: 'voice-api-key-required' })
})

test('Realtime abort closes the socket and never returns partial audio', async () => {
  const controller = new AbortController()
  const h = socketHarness((socket) => {
    socket.emit({ type: 'response.output_audio.delta', delta: Buffer.from([0, 0]).toString('base64') })
    controller.abort()
  })
  const result = await synthesizeVoice({ voice: realtime, text: 'Привет', socketFactory: h.socketFactory, signal: controller.signal })
  assert.deepEqual(result, { ok: false, error: 'tts-aborted' })
  assert.equal(h.socket.closed, true)
})

test('Realtime premature disconnect is an observable failure', async () => {
  const h = socketHarness((socket) => socket.dispatchEvent(new Event('close')))
  const result = await synthesizeVoice({ voice: realtime, text: 'Привет', socketFactory: h.socketFactory })
  assert.deepEqual(result, { ok: false, error: 'tts-incomplete' })
  assert.equal(h.socket.closed, true)
})

test('Realtime reports failed, empty, malformed, odd PCM and oversized responses without falling back', async () => {
  const cases = [
    [(socket) => socket.emit({ type: 'error', error: { message: 'sk-private debug details' } }), 'tts-failed'],
    [(socket) => socket.emit({ type: 'response.done', response: { status: 'failed' } }), 'tts-failed'],
    [(socket) => socket.emit(completed), 'tts-empty'],
    [(socket) => socket.emit('{bad'), 'tts-invalid-event'],
    [(socket) => socket.emit({ type: 'response.output_audio.delta', delta: '%%%=' }), 'tts-invalid-audio'],
    [(socket) => { socket.emit({ type: 'response.output_audio.delta', delta: 'AA==' }); socket.emit(completed) }, 'tts-invalid-audio'],
    [(socket) => socket.emit({ type: 'response.output_audio.delta', delta: Buffer.alloc(TTS_MAX_BYTES).toString('base64') }), 'tts-too-large'],
  ]
  for (const [emit, error] of cases) {
    const h = socketHarness(emit)
    const result = await synthesizeVoice({ voice: realtime, text: 'Привет', socketFactory: h.socketFactory, fetchImpl: () => { throw new Error('no fallback') } })
    assert.deepEqual(result, { ok: false, error })
    assert.equal(h.socket.closed, true)
    assert.ok(!JSON.stringify(result).includes('sk-private'))
  }
})

test('legacy compatible API preserves configured model, bounds streamed audio and reports upstream status', async () => {
  const voice = { ...realtime, model: 'kokoro', voice: 'af_heart' }
  let seen
  const success = await synthesizeVoice({ voice, text: 'Привет', fetchImpl: async (url, init) => {
    seen = { url, init }
    return new Response(Buffer.from('audio'), { headers: { 'content-type': 'audio/mpeg' } })
  } })
  assert.equal(success.ok, true)
  assert.equal(success.audio.toString(), 'audio')
  assert.equal(JSON.parse(seen.init.body).model, 'kokoro')
  assert.equal(seen.url, 'https://api.openai.com/v1/audio/speech')
  const failed = await synthesizeVoice({ voice, text: 'Привет', fetchImpl: async () => new Response('private error', { status: 429 }) })
  assert.deepEqual(failed, { ok: false, error: 'tts-failed', status: 429 })
  const tooLarge = await synthesizeVoice({ voice, text: 'Привет', fetchImpl: async () => new Response(Buffer.alloc(TTS_MAX_BYTES + 1), { headers: { 'content-type': 'audio/mpeg' } }) })
  assert.deepEqual(tooLarge, { ok: false, error: 'tts-too-large' })
  const html = await synthesizeVoice({ voice, text: 'Привет', fetchImpl: async () => new Response('<html>proxy error</html>', { headers: { 'content-type': 'text/html' } }) })
  assert.deepEqual(html, { ok: false, error: 'tts-invalid-content-type' })
})

test('Realtime URL normalization rejects malformed authorities and never puts a key in the URL', () => {
  for (const baseUrl of ['ftp://example.com', 'https://user:password@example.com/v1', 'https://example.com/v1?secret=x', 'https://example.com/#fragment', 'https://']) {
    const result = buildRealtimeVoiceRequest({ voice: { ...realtime, baseUrl }, text: 'Привет' })
    assert.deepEqual(result, { ok: false, error: 'voice-base-url-invalid' })
  }
})

test('native Node WebSocket sends Authorization as an HTTP header on the local handshake', async () => {
  const server = createServer()
  let authorization
  server.on('upgrade', (request, socket) => {
    authorization = request.headers.authorization
    socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n')
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    const address = server.address()
    const socket = createNodeVoiceSocket(`ws://127.0.0.1:${address.port}/realtime`, { authorization: 'Bearer local-test' })
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('local handshake timeout')), 2000)
      socket.addEventListener('error', () => { clearTimeout(timer); resolve() }, { once: true })
    })
    assert.equal(authorization, 'Bearer local-test')
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('WAV header stores byte count exactly', () => {
  const wav = pcmToWav(Buffer.from([0, 0]))
  assert.equal(wav.readUInt32LE(4), 38)
  assert.equal(wav.readUInt32LE(40), 2)
})
