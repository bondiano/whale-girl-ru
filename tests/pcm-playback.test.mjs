import { test } from 'node:test'
import assert from 'node:assert/strict'
import { playPcmResponse } from '../dist/client/pcm-playback.js'

const mime = 'audio/pcm;rate=24000;channels=1;encoding=s16le'
const flush = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve() }

function fixture({ resume } = {}) {
  let stream
  let cancellations = 0
  const response = new Response(new ReadableStream({ start(controller) { stream = controller }, cancel() { cancellations += 1 } }), { headers: { 'content-type': mime } })
  const nodes = []
  const buffers = []
  let closed = 0
  let playing = 0
  const context = {
    currentTime: 10, state: 'running', destination: {},
    resume: resume ?? (() => Promise.resolve()),
    close() { closed += 1; this.state = 'closed'; return Promise.resolve() },
    createBuffer(channels, length, rate) {
      const data = new Float32Array(length)
      const buffer = { channels, length, sampleRate: rate, duration: length / rate, getChannelData: () => data }
      buffers.push(buffer)
      return buffer
    },
    createBufferSource() {
      const node = { buffer: null, onended: null, stopped: 0, disconnected: 0, starts: [], connect() {}, disconnect() { this.disconnected += 1 }, start(at) { this.starts.push(at) }, stop() { this.stopped += 1 }, end() { this.onended?.() } }
      nodes.push(node)
      return node
    },
  }
  const abort = new AbortController()
  const promise = playPcmResponse(response, { signal: abort.signal, onPlaying: () => { playing += 1 }, contextFactory: () => context })
  return { promise, abort, stream, nodes, buffers, context, closed: () => closed, playing: () => playing, cancellations: () => cancellations }
}

test('first PCM samples play before EOF and completion waits for queued playback', async () => {
  const f = fixture()
  let complete = false
  f.promise.then(() => { complete = true })
  f.stream.enqueue(new Uint8Array([0, 128, 255, 127]))
  await flush()
  assert.equal(f.nodes.length, 1)
  assert.equal(f.playing(), 1)
  assert.equal(complete, false)
  assert.deepEqual([...f.buffers[0].getChannelData(0)], [-1, 32767 / 32768])
  assert.equal(f.nodes[0].starts[0], 10.03)
  f.stream.enqueue(new Uint8Array([0, 0]))
  await flush()
  assert.equal(f.nodes[1].starts[0], f.nodes[0].starts[0] + f.buffers[0].duration)
  assert.equal(f.playing(), 1)
  f.stream.close()
  await flush()
  f.nodes[1].end()
  await flush()
  assert.equal(complete, false)
  f.nodes[0].end()
  await f.promise
  assert.equal(complete, true)
  assert.equal(f.closed(), 1)
})

test('odd HTTP chunk boundaries preserve PCM samples without adding or dropping bytes', async () => {
  const f = fixture()
  f.stream.enqueue(new Uint8Array([0]))
  await flush()
  assert.equal(f.nodes.length, 0)
  f.stream.enqueue(new Uint8Array([128, 0, 64]))
  await flush()
  assert.deepEqual([...f.buffers[0].getChannelData(0)], [-1, 0.5])
  f.stream.close()
  f.nodes[0].end()
  await f.promise
})

test('abort while reading stops queued sources, cancels input and cannot play late data', async () => {
  const f = fixture()
  f.stream.enqueue(new Uint8Array([0, 1]))
  await flush()
  f.abort.abort()
  await assert.rejects(f.promise, { name: 'AbortError' })
  assert.equal(f.nodes[0].stopped, 1)
  assert.equal(f.closed(), 1)
  assert.equal(f.cancellations(), 1)
  f.nodes[0].end()
  assert.equal(f.playing(), 1)
  assert.equal(f.nodes.length, 1)
})

test('abort while AudioContext resume is pending never schedules playback afterwards', async () => {
  let resume
  const f = fixture({ resume: () => new Promise(resolve => { resume = resolve }) })
  f.stream.enqueue(new Uint8Array([0, 0]))
  f.abort.abort()
  await assert.rejects(f.promise, { name: 'AbortError' })
  resume()
  await flush()
  assert.equal(f.nodes.length, 0)
  assert.equal(f.playing(), 0)
  assert.equal(f.closed(), 1)
  assert.equal(f.cancellations(), 1)
})

test('empty, malformed final sample and excessive audio fail and release partial playback', async () => {
  for (const [bytes, error] of [[new Uint8Array(), 'tts-empty'], [new Uint8Array([1]), 'tts-invalid-audio'], [new Uint8Array(8 * 1024 * 1024 + 1), 'tts-too-large']]) {
    const f = fixture()
    f.stream.enqueue(bytes)
    f.stream.close()
    await assert.rejects(f.promise, new RegExp(error))
    assert.equal(f.closed(), 1)
    assert.equal(f.playing(), 0)
  }
  const f = fixture()
  f.stream.enqueue(new Uint8Array([0, 0]))
  await flush()
  f.stream.enqueue(new Uint8Array([1]))
  f.stream.close()
  await assert.rejects(f.promise, /tts-invalid-audio/)
  assert.equal(f.nodes[0].stopped, 1)
})

test('bad format and an already-aborted signal never create an AudioContext', async () => {
  const abort = new AbortController()
  const fail = () => assert.fail('context must not be created')
  await assert.rejects(playPcmResponse(new Response('bad', { headers: { 'content-type': 'audio/wav' } }), { signal: abort.signal, onPlaying: fail, contextFactory: fail }), /tts-invalid-content-type/)
  abort.abort()
  await assert.rejects(playPcmResponse(new Response('', { headers: { 'content-type': mime } }), { signal: abort.signal, onPlaying: fail, contextFactory: fail }), { name: 'AbortError' })
})

test('a blocked or indefinitely suspended context fails without reading or starting audio', async (t) => {
  const rejected = fixture({ resume: () => Promise.reject(new Error('autoplay')) })
  await assert.rejects(rejected.promise, /tts-playback-blocked/)
  assert.equal(rejected.closed(), 1)
  assert.equal(rejected.cancellations(), 1)
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const stalled = fixture({ resume: () => new Promise(() => {}) })
  const rejectedStall = assert.rejects(stalled.promise, /tts-playback-blocked/)
  t.mock.timers.tick(5001)
  await rejectedStall
  assert.equal(stalled.closed(), 1)
  assert.equal(stalled.nodes.length, 0)
})

test('an interrupted response stops partial sound and exposes a stream failure', async () => {
  const f = fixture()
  f.stream.enqueue(new Uint8Array([0, 0]))
  await flush()
  f.stream.error(new Error('connection reset'))
  await assert.rejects(f.promise, /tts-incomplete/)
  assert.equal(f.nodes[0].stopped, 1)
  assert.equal(f.closed(), 1)
})
