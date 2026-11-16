import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMicrophoneCapture, createConversationResume, createSpeechRequest } from '../dist/client/microphone.js'

function fixture() {
  let allowed = true
  let stopped = 0
  let instances = 0
  let recording = false
  let resolveAccess
  const stream = { getTracks: () => [{ stop() { stopped += 1 } }] }
  const uploads = []
  const errors = []
  let recorder
  const capture = createMicrophoneCapture({
    allowed: () => allowed,
    acquire: () => new Promise((resolve) => { resolveAccess = resolve }),
    create() {
      instances += 1
      recorder = {
        state: 'inactive', mimeType: 'audio/webm',
        start() { this.state = 'recording' },
        stop() { this.state = 'inactive'; this.ondataavailable({ data: new Blob(['spoken audio']) }); this.onstop() },
      }
      return recorder
    },
    recording(value) { recording = value },
    audio: (blob) => uploads.push(blob), error: (error) => errors.push(error),
  })
  return { capture, uploads, errors, access: () => resolveAccess(stream), close() { allowed = false; capture.cancel() }, reopen() { allowed = true }, stopped: () => stopped, instances: () => instances, recording: () => recording, recorder: () => recorder }
}

test('explicit microphone stop submits one recording and releases tracks', async () => {
  const f = fixture()
  const start = f.capture.start()
  f.access()
  await start
  assert.equal(f.recording(), true)
  f.capture.stop()
  assert.equal(f.uploads.length, 1)
  assert.equal(await f.uploads[0].text(), 'spoken audio')
  assert.equal(f.stopped(), 1)
  assert.equal(f.recording(), false)
})

test('closing or disabling voice discards captured audio instead of uploading onstop', async () => {
  const f = fixture()
  const start = f.capture.start()
  f.access()
  await start
  f.close()
  assert.equal(f.uploads.length, 0)
  assert.equal(f.recording(), false)
  assert.equal(f.capture.busy(), false)
  assert.ok(f.stopped() >= 1)
})

test('late microphone permission after close/reopen releases tracks without creating a recorder', async () => {
  const f = fixture()
  const start = f.capture.start()
  f.close()
  f.reopen()
  f.access()
  await start
  assert.equal(f.instances(), 0)
  assert.equal(f.uploads.length, 0)
  assert.equal(f.stopped(), 1)
  assert.equal(f.recording(), false)
})

test('conversation timer never reopens closed chat and cancellation survives reopening', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let open = true
  let enabled = true
  let calls = 0
  const resume = createConversationResume(() => open && enabled, () => { calls += 1 })
  resume.schedule()
  open = false
  resume.cancel()
  open = true
  t.mock.timers.tick(251)
  assert.equal(calls, 0)
  resume.schedule()
  enabled = false
  t.mock.timers.tick(251)
  assert.equal(calls, 0)
  enabled = true
  resume.schedule()
  t.mock.timers.tick(251)
  assert.equal(calls, 1)
  open = false
  resume.schedule()
  t.mock.timers.tick(251)
  assert.equal(calls, 1)
})

test('pending speech is aborted on close/disable and cannot play after a newer request', () => {
  const speech = createSpeechRequest()
  const first = speech.start()
  assert.equal(speech.current(first), true)
  speech.cancel()
  assert.equal(first.aborted, true)
  const reopened = speech.start()
  assert.equal(speech.current(first), false)
  assert.equal(speech.current(reopened), true)
  const newer = speech.start()
  assert.equal(reopened.aborted, true)
  assert.equal(speech.current(reopened), false)
  assert.equal(speech.current(newer), true)
})
