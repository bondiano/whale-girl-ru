// Turn-edge regressions use the official event.type field.
// Reading event.kind instead must fail these tests.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTurnEvent } from '../dist/core/session-events.js'

const turn = (type, data) => ({ type, seq: 1, time: 1, data })

test('turn/start 判定为 start 边沿（blocked false）', () => {
  assert.deepEqual(parseTurnEvent(turn('turn/start', { turn: 1 })), { kind: 'start', blocked: false })
})

test('turn/end completed 判定为 end 边沿（非阻塞）', () => {
  assert.deepEqual(parseTurnEvent(turn('turn/end', { turn: 1, reason: { kind: 'completed' } })), { kind: 'end', blocked: false })
})

test('turn/end blocked 判定为 end 边沿（等待批准）', () => {
  assert.deepEqual(parseTurnEvent(turn('turn/end', { turn: 1, reason: { kind: 'blocked' } })), { kind: 'end', blocked: true })
})

test('turn/end 其余结束原因均非阻塞', () => {
  for (const kind of ['aborted', 'error', 'max-tokens', 'interrupted']) {
    assert.deepEqual(parseTurnEvent(turn('turn/end', { turn: 1, reason: { kind } })), { kind: 'end', blocked: false }, `reason.kind=${kind}`)
  }
})

test('非 turn 事件返回 null', () => {
  assert.equal(parseTurnEvent(turn('step/start', { turn: 1, step: 1 })), null)
  assert.equal(parseTurnEvent(turn('user/message', { text: 'hi' })), null)
  assert.equal(parseTurnEvent(turn('turn/x', {})), null)
})

test('结构异常返回 null（不抛）', () => {
  assert.equal(parseTurnEvent(null), null)
  assert.equal(parseTurnEvent('nope'), null)
  assert.equal(parseTurnEvent({}), null)
  // Malformed turn/end data still closes the turn; unrecognizable blocking defaults to false.
  assert.deepEqual(parseTurnEvent({ type: 'turn/end' }), { kind: 'end', blocked: false })
  assert.deepEqual(parseTurnEvent({ type: 'turn/end', data: null }), { kind: 'end', blocked: false })
  assert.deepEqual(parseTurnEvent({ type: 'turn/end', data: { reason: null } }), { kind: 'end', blocked: false })
  assert.deepEqual(parseTurnEvent({ type: 'turn/end', data: { reason: 'blocked' } }), { kind: 'end', blocked: false })
})
