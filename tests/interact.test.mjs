// Pure interaction regressions: feeding/playing return replies without changing
// the ledger or introducing negative-feedback state.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyAction, isCrossOrigin } from '../dist/core/interact.js'
import { INITIAL_STATE } from '../dist/core/pet-state.js'
import { DEFAULTS } from '../dist/core/config.js'

const base = { ...INITIAL_STATE, updatedAt: 0 }

test('default interaction replies offer concise work, programming and AI prompts', () => {
  for (const action of ['feed', 'play']) {
    const pool = DEFAULTS.replies[action]
    assert.ok(pool.length >= 8)
    assert.ok(pool.some(reply => /AI/.test(reply)), `${action}: includes an AI prompt`)
    for (const reply of pool) {
      assert.match(reply, /задач|код|баг|AI|тест|функци|diff|результат|рефактор|отлад|правк/i)
      assert.ok(Array.from(reply).length <= 180, `${action}: concise reply`)
      assert.ok((reply.match(/\p{Extended_Pictographic}/gu) ?? []).length <= 1)
    }
  }
})

test('missing and empty interaction pools use the same authoritative work replies', (t) => {
  const random = t.mock.method(Math, 'random', () => 0)
  const snapshot = structuredClone(base)
  for (const action of ['feed', 'play']) {
    const pool = DEFAULTS.replies[action]
    for (let index = 0; index < pool.length; index++) {
      random.mock.mockImplementation(() => (index + 0.5) / pool.length)
      for (const replies of [null, undefined, { feed: [], play: [] }]) {
        const result = applyAction(base, action, replies)
        assert.equal(result.status, 200)
        assert.equal(result.body.pet, base)
        assert.equal(result.body.reply, pool[index])
      }
    }
  }
  assert.deepEqual(base, snapshot)
})

test('applyAction: feed 返回 200 + 回话，状态不变', () => {
  const r = applyAction(base, 'feed')
  assert.equal(r.status, 200)
  assert.equal(r.body.pet, base)
  assert.match(r.body.reply, /«/)
})

test('applyAction: play 返回 200 + 回话，状态不变', () => {
  const r = applyAction(base, 'play')
  assert.equal(r.status, 200)
  assert.equal(r.body.pet, base)
  assert.match(r.body.reply, /«/)
})

test('applyAction: 未知动作返回 400 且不产生新状态', () => {
  const r = applyAction(base, 'dance')
  assert.equal(r.status, 400)
  assert.equal(r.body.pet, undefined)
  assert.match(r.body.error, /unknown action "dance"/)
})

test('isCrossOrigin: Sec-Fetch-Site 优先', () => {
  assert.equal(isCrossOrigin({ 'sec-fetch-site': 'same-origin' }, '127.0.0.1:1'), false)
  assert.equal(isCrossOrigin({ 'sec-fetch-site': 'none' }, '127.0.0.1:1'), false)
  assert.equal(isCrossOrigin({ 'sec-fetch-site': 'cross-site' }, '127.0.0.1:1'), true)
})

test('isCrossOrigin: 无 Sec-Fetch-Site 时用 Origin', () => {
  assert.equal(isCrossOrigin({ origin: 'http://127.0.0.1:60135' }, '127.0.0.1:60135'), false)
  assert.equal(isCrossOrigin({ origin: 'http://evil.example' }, '127.0.0.1:60135'), true)
  assert.equal(isCrossOrigin({ origin: 'not a url' }, '127.0.0.1:60135'), true)
})

test('isCrossOrigin: 无头（非浏览器客户端）视为同源', () => {
  assert.equal(isCrossOrigin({}, '127.0.0.1:60135'), false)
})

test('applyAction: 配置回话池生效（自定义文案被使用）', () => {
  const replies = { feed: ['「自定义投喂」'], play: ['「自定义玩耍」'] }
  const r1 = applyAction(base, 'feed', replies)
  assert.equal(r1.body.reply, '「自定义投喂」')
  const r2 = applyAction(base, 'play', replies)
  assert.equal(r2.body.reply, '「自定义玩耍」')
})

test('applyAction: 空/缺配置回话池回退内置（配置损坏不崩互动）', () => {
  assert.match(applyAction(base, 'feed', null).body.reply, /«/)
  assert.match(applyAction(base, 'play', undefined).body.reply, /«/)
  assert.match(applyAction(base, 'feed', { feed: [], play: [] }).body.reply, /«/)
  assert.match(applyAction(base, 'play', { feed: ['x'], play: [] }).body.reply, /«/)
})
