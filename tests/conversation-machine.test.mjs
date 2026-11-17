import test from 'node:test'
import assert from 'node:assert/strict'
import { createActor } from 'xstate'
import { canAutoListen, conversationFlags, conversationMachine } from '../dist/client/conversation-machine.js'

const start = (input = {}) => {
  const actor = createActor(conversationMachine, {
    input: { conversationMode: false, voiceEnabled: true, userTyping: false, ...input },
  }).start()
  return { actor, flags: () => conversationFlags(actor.getSnapshot()) }
}

test('chat lifecycle: open, send, reveal, settle, close', () => {
  const { actor, flags } = start()
  assert.deepEqual(flags(), {
    chatOpen: false, chatPending: false, textPending: false, speechPending: false,
    listening: false, recording: false, transcribing: false, autoListening: false,
  })
  actor.send({ type: 'OPEN' })
  assert.equal(flags().chatOpen, true)
  actor.send({ type: 'SEND' })
  assert.equal(flags().chatPending, true)
  assert.equal(flags().textPending, true)
  actor.send({ type: 'REPLY' })
  assert.equal(flags().chatPending, false)
  assert.equal(flags().textPending, true)
  actor.send({ type: 'REVEALED' })
  assert.equal(flags().textPending, false)
  assert.equal(flags().chatOpen, true)
  actor.send({ type: 'CLOSE' })
  assert.equal(flags().chatOpen, false)
  assert.equal(flags().textPending, false)
})

test('a failed request settles the chat without leaving it pending', () => {
  const { actor, flags } = start()
  actor.send({ type: 'OPEN' })
  actor.send({ type: 'SEND' })
  actor.send({ type: 'FAIL' })
  assert.equal(flags().chatOpen, true)
  assert.equal(flags().chatPending, false)
  assert.equal(flags().textPending, false)
})

test('hands-free listen is refused while typing or when conversation mode is off', () => {
  const typing = start({ conversationMode: true, userTyping: true })
  typing.actor.send({ type: 'LISTEN_AUTO', mode: 'browser' })
  assert.equal(typing.flags().listening, false)

  const off = start({ conversationMode: false })
  off.actor.send({ type: 'LISTEN_AUTO', mode: 'browser' })
  assert.equal(off.flags().listening, false)

  const ok = start({ conversationMode: true })
  ok.actor.send({ type: 'LISTEN_AUTO', mode: 'browser' })
  assert.equal(ok.flags().listening, true)
  assert.equal(ok.flags().autoListening, true)
  assert.equal(canAutoListen(ok.actor.getSnapshot()), true)
})

test('manual listen still works with conversation mode off', () => {
  const { actor, flags } = start({ conversationMode: false })
  actor.send({ type: 'LISTEN_MANUAL', mode: 'browser' })
  assert.equal(flags().listening, true)
  actor.send({ type: 'LISTEN_END' })
  assert.equal(flags().listening, false)
})

test('server transcription is a distinct voice phase', () => {
  const { actor, flags } = start()
  actor.send({ type: 'LISTEN_MANUAL', mode: 'server' })
  assert.equal(flags().recording, true)
  assert.equal(flags().listening, false)
  actor.send({ type: 'TRANSCRIBE_START' })
  assert.equal(flags().transcribing, true)
  actor.send({ type: 'TRANSCRIBE_END' })
  assert.equal(flags().transcribing, false)
  assert.equal(flags().autoListening, false)
})

test('a recorder stop before upload still allows the transcription phase', () => {
  const { actor, flags } = start()
  actor.send({ type: 'LISTEN_MANUAL', mode: 'server' })
  assert.equal(flags().recording, true)
  // MediaRecorder reports recording=false before handing the blob to uploadAudio.
  actor.send({ type: 'LISTEN_END' })
  assert.equal(flags().recording, false)
  actor.send({ type: 'TRANSCRIBE_START' })
  assert.equal(flags().transcribing, true)
})

test('speech phase starts and stops independently of chat', () => {
  const { actor, flags } = start()
  actor.send({ type: 'SPEAK_START' })
  assert.equal(flags().speechPending, true)
  actor.send({ type: 'SPEAK_END' })
  assert.equal(flags().speechPending, false)
})

test('disabling voice moves the machine to off and cancels listening', () => {
  const { actor, flags } = start({ conversationMode: true })
  actor.send({ type: 'LISTEN_AUTO', mode: 'browser' })
  assert.equal(flags().listening, true)
  actor.send({ type: 'CONFIG', conversationMode: false, voiceEnabled: false, userTyping: false })
  assert.equal(flags().listening, false)
  assert.equal(flags().autoListening, false)
  // A deliberate browser mic click still works without TTS; hands-free does not.
  actor.send({ type: 'LISTEN_AUTO', mode: 'browser' })
  assert.equal(flags().listening, false)
  actor.send({ type: 'LISTEN_MANUAL', mode: 'browser' })
  assert.equal(flags().listening, true)
  actor.send({ type: 'LISTEN_END' })
  assert.equal(flags().listening, false)
})
