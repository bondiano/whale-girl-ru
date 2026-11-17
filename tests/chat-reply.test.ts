import { test } from 'node:test'
import assert from 'node:assert/strict'
import { presentChatReply, replyWaitingPhase } from '../dist/client/chat-reply.js'

test('waiting indicator moves from thinking to voice preparation and clears on playback or cancellation', () => {
  assert.equal(replyWaitingPhase(true, false, false), 'thinking')
  assert.equal(replyWaitingPhase(true, true, false), 'thinking')
  assert.equal(replyWaitingPhase(false, true, false), 'voice')
  assert.equal(replyWaitingPhase(false, true, true), null)
  assert.equal(replyWaitingPhase(false, false, false), null)
})

test('speech starts immediately while the reply is still being revealed', async () => {
  const calls = []
  let finishReveal
  const pending = presentChatReply({
    current: () => true,
    speak: () => calls.push('speech'),
    reveal: () => { calls.push('reveal'); return new Promise(resolve => { finishReveal = resolve }) },
    finish: () => calls.push('reading-window'),
  })
  assert.deepEqual(calls, ['speech', 'reveal'])
  finishReveal()
  await pending
  assert.deepEqual(calls, ['speech', 'reveal', 'reading-window'])
})

test('closing or replacing a chat during reveal cannot restore a stale bubble', async () => {
  let current = true
  let finishReveal
  let finishes = 0
  const pending = presentChatReply({
    current: () => current,
    speak() {},
    reveal: () => new Promise(resolve => { finishReveal = resolve }),
    finish: () => { finishes += 1 },
  })
  current = false
  finishReveal()
  await pending
  assert.equal(finishes, 0)
  await presentChatReply({ current: () => false, speak: () => assert.fail('stale speech'), reveal: () => assert.fail('stale reveal'), finish: () => assert.fail('stale bubble') })
})
