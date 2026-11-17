// Session view regressions cover parsing, immutable updates, creation, and title extraction
// for per-session thinking/tool/waiting/done activity.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseSessionEvent,
  createSessionView,
  applySessionView,
  applySessionTiming,
  titleFromLog,
} from '../dist/core/sessions.js'

const ev = (type, data) => ({ type, seq: 1, time: 1, data })

test('turn/start → thinking', () => {
  assert.deepEqual(parseSessionEvent(ev('turn/start', { turn: 1 })), { kind: 'activity', value: 'thinking' })
})

test('tool/call → tool:<name>（bash/pwsh 原样，桌面端映射显示文案）', () => {
  assert.deepEqual(parseSessionEvent(ev('tool/call', { turn: 1, step: 1, callId: 'c', name: 'bash', arguments: '{}' })),
    { kind: 'activity', value: 'tool:bash' })
  assert.deepEqual(parseSessionEvent(ev('tool/call', { turn: 1, step: 1, callId: 'c', name: 'read', arguments: '{}' })),
    { kind: 'activity', value: 'tool:read' })
})

test('tool/call 缺 name 返回 null（不推导）', () => {
  assert.equal(parseSessionEvent(ev('tool/call', { turn: 1 })), null)
})

test('turn/end blocked → waiting，其余结束原因 → done', () => {
  assert.deepEqual(parseSessionEvent(ev('turn/end', { turn: 1, reason: { kind: 'blocked' } })),
    { kind: 'activity', value: 'waiting' })
  for (const kind of ['completed', 'aborted', 'error', 'max-tokens', 'interrupted']) {
    assert.deepEqual(parseSessionEvent(ev('turn/end', { turn: 1, reason: { kind } })),
      { kind: 'activity', value: 'done' }, `reason.kind=${kind}`)
  }
})

test('session/title → 标题（不改活动）', () => {
  assert.deepEqual(parseSessionEvent(ev('session/title', { title: 'whale-girl 二次开发', messageSeqs: [1], source: { kind: 'fallback' } })),
    { kind: 'title', value: 'whale-girl 二次开发' })
})

test('非活动事件返回 null（不抛）', () => {
  assert.equal(parseSessionEvent(null), null)
  assert.equal(parseSessionEvent('nope'), null)
  assert.equal(parseSessionEvent({}), null)
  assert.equal(parseSessionEvent(ev('step/start', { turn: 1, step: 1 })), null)
  assert.equal(parseSessionEvent(ev('user/message', { text: 'hi' })), null)
})

test('createSessionView 默认 done + 空标题', () => {
  assert.deepEqual(createSessionView('s1', 1000), { id: 's1', title: null, activity: 'done', since: 1000 })
})

test('applySessionView 事件驱动更新（不可变；无变化返回原引用）', () => {
  const view = createSessionView('s1', 1000)
  const thinking = applySessionView(view, ev('turn/start', { turn: 1 }))
  assert.deepEqual(thinking, { id: 's1', title: null, activity: 'thinking', since: 1000 })
  assert.notEqual(thinking, view)
  const tool = applySessionView(thinking, ev('tool/call', { turn: 1, step: 1, callId: 'c', name: 'bash', arguments: '{}' }))
  assert.deepEqual(tool, { id: 's1', title: null, activity: 'tool:bash', since: 1000 })
  const done = applySessionView(tool, ev('turn/end', { turn: 1, reason: { kind: 'completed' } }))
  assert.deepEqual(done, { id: 's1', title: null, activity: 'done', since: 1000 })
  const titled = applySessionView(done, ev('session/title', { title: 'T', messageSeqs: [], source: { kind: 'user' } }))
  assert.deepEqual(titled, { id: 's1', title: 'T', activity: 'done', since: 1000 })
  // An unchanged event preserves the original reference.
  assert.equal(applySessionView(view, ev('step/start', { turn: 1, step: 1 })), view)
  assert.equal(applySessionView(titled, ev('session/title', { title: 'T', messageSeqs: [], source: { kind: 'user' } })), titled)
  // Unknown events and malformed shapes must not throw.
  assert.equal(applySessionView(view, null), view)
})

test('titleFromLog 取最后一个非空标题', () => {
  const log = [
    { type: 'session/title', seq: 0, time: 1, data: { title: 'first', messageSeqs: [], source: { kind: 'fallback' } } },
    { type: 'turn/start', seq: 1, time: 2, data: { turn: 1 } },
    { type: 'session/title', seq: 2, time: 3, data: { title: 'second', messageSeqs: [1], source: { kind: 'fallback' } } },
  ]
  assert.equal(titleFromLog(log), 'second')
  assert.equal(titleFromLog([]), null)
  assert.equal(titleFromLog(null), null)
  assert.equal(titleFromLog([{ type: 'turn/start', seq: 0, time: 1, data: { turn: 1 } }]), null)
})

test('applySessionTiming: turn/start сбрасывает счётчики, tool/call копит, turn/end пишет длительность', () => {
  let view = createSessionView('s1', 1000)
  view = applySessionTiming(view, ev('turn/start', { turn: 1 }), 5000)
  assert.equal(view.turnStartedAt, 5000)
  assert.equal(view.toolCalls, 0)
  view = applySessionTiming(view, ev('tool/call', { turn: 1, step: 1, callId: 'c', name: 'bash', arguments: '{}' }), 6000)
  assert.equal(view.toolCalls, 1)
  assert.equal(view.lastTool, 'bash')
  view = applySessionTiming(view, ev('tool/call', { turn: 1, step: 2, callId: 'd', name: 'read', arguments: '{}' }), 7000)
  assert.equal(view.toolCalls, 2)
  assert.equal(view.lastTool, 'read')
  view = applySessionTiming(view, ev('turn/end', { turn: 1, reason: { kind: 'completed' } }), 65000)
  assert.deepEqual(view.recentTurnMs, [60000], 'длительность = конец − старт')
  assert.equal(view.turnStartedAt, 0)
})

test('applySessionTiming: recentTurnMs хранит последние 5, отрицательное время не пишется', () => {
  let view = { ...createSessionView('s1', 1), recentTurnMs: [1, 2, 3, 4, 5] }
  view = applySessionTiming(view, ev('turn/start', { turn: 1 }), 10000)
  view = applySessionTiming(view, ev('turn/end', { turn: 1, reason: { kind: 'completed' } }), 20000)
  assert.deepEqual(view.recentTurnMs, [2, 3, 4, 5, 10000])
  // A turn/end without a start has no duration and preserves the object.
  const bare = createSessionView('s2', 1)
  assert.equal(applySessionTiming(bare, ev('turn/end', { turn: 1 }), 42), bare)
  // Clock rollback clamps a negative duration to zero.
  const backwards = applySessionTiming({ ...createSessionView('s3', 1), turnStartedAt: 100 }, ev('turn/end', { turn: 1 }), 50)
  assert.deepEqual(backwards.recentTurnMs, [0])
  // Events unrelated to timing preserve the object.
  const same = createSessionView('s3', 1)
  assert.equal(applySessionTiming(same, ev('session/title', { title: 'x' }), 1), same)
})
