// Configuration defaults, schema, and readback regressions.
// Run with the package's installed Schemastery dependency.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULTS, buildSchema, readConfig, NAMESPACE } from '../dist/core/config.js'

test('NAMESPACE 与 DEFAULTS 完整性', () => {
  assert.equal(NAMESPACE, 'whale-girl')
  assert.equal(typeof DEFAULTS.size, 'number')
  assert.equal(DEFAULTS.size, 110)
  assert.equal(DEFAULTS.enabled, true)
  assert.equal(DEFAULTS.sessionMemory, false, '会话记忆默认关（opt-in）')
  assert.equal(DEFAULTS.walk.enabled, true)
  assert.equal(DEFAULTS.walk.maxWaitMs, 40000)
  // Voice remains opt-in, including conversation mode and automatic chat speech.
  assert.equal(DEFAULTS.voice.sttModel, 'gpt-transcribe')
  assert.equal(typeof DEFAULTS.voice.instructions, 'string')
  assert.equal(DEFAULTS.voice.conversation, false)
  assert.equal(DEFAULTS.voice.autoSpeakChat, false, '自动朗读默认关（opt-in）')
  assert.equal(DEFAULTS.voice.minSpeakChars, 200)
  // Session context and news are enabled by default.
  assert.equal(DEFAULTS.chat.sessionContext, true)
  assert.equal(DEFAULTS.news.enabled, true)
  assert.equal(DEFAULTS.news.maxItems, 5)
  assert.equal(DEFAULTS.news.feeds.length, 3)
  for (const feed of DEFAULTS.news.feeds) assert.match(feed, /^https?:\/\//)
})

test('buildSchema：条目 Config 用，解析出 volatile 实时引用', () => {
  const schema = buildSchema()
  assert.equal(typeof schema, 'function') // z.object returns a callable schema constructor.
  const result = schema['~standard'].validate({})
  assert.equal(result.issues, undefined)
  // Live fields are host-injected { get() } references, including nested and array leaves.
  assert.equal(result.value.size.get(), 110)
  assert.equal(result.value.sessionMemory.get(), false, 'sessionMemory 是 volatile 叶')
  assert.equal(result.value.walk.enabled.get(), true)
  assert.deepEqual(result.value.replies.feed.get(), DEFAULTS.replies.feed)
  assert.equal(result.value.voice.sttModel.get(), 'gpt-transcribe')
  assert.equal(result.value.voice.conversation.get(), false)
  assert.equal(result.value.voice.autoSpeakChat.get(), false)
  assert.equal(result.value.voice.minSpeakChars.get(), 200)
  assert.equal(result.value.chat.sessionContext.get(), true)
  assert.equal(result.value.news.maxItems.get(), 5)
  assert.deepEqual(result.value.news.feeds.get(), DEFAULTS.news.feeds)
  // Containers remain plain objects; only leaves are volatile.
  assert.equal(typeof result.value.walk.enabled, 'object')
})

test('readConfig：解引用 volatile 叶、与 DEFAULTS 合并补缺', () => {
  const config = {
    size: { get: () => 130 },
    walk: { enabled: { get: () => false } },
    replies: { feed: { get: () => ['a'] } },
  }
  const next = readConfig(config)
  assert.equal(next.size, 130)
  assert.equal(next.walk.enabled, false)
  assert.deepEqual(next.replies.feed, ['a'])
  // Missing keys fall back to DEFAULTS before schema defaults are injected.
  assert.equal(next.opacity, DEFAULTS.opacity)
  assert.equal(next.walk.speedPxPerSec, DEFAULTS.walk.speedPxPerSec)
  assert.deepEqual(next.replies.play, DEFAULTS.replies.play)
})

test('readConfig：成对区间 min > max 时交换（写面只剩 schema 校验）', () => {
  const next = readConfig({ walk: { minWaitMs: { get: () => 9000 }, maxWaitMs: { get: () => 5000 }, minMs: 4000, maxMs: 1000 } })
  assert.equal(next.walk.minWaitMs, 5000)
  assert.equal(next.walk.maxWaitMs, 9000)
  assert.equal(next.walk.minMs, 1000)
  assert.equal(next.walk.maxMs, 4000)
})

test('readConfig：缺配置/坏形状安全回退 DEFAULTS', () => {
  for (const input of [undefined, null, {}, 'nope', 42]) {
    const next = readConfig(input)
    assert.equal(next.size, DEFAULTS.size)
    assert.equal(next.walk.minWaitMs, DEFAULTS.walk.minWaitMs)
  }
  assert.equal(readConfig({ walk: null }).walk.maxMs, DEFAULTS.walk.maxMs)
})

test('DEFAULTS.replies：内置回话池非空且为数组（含氛围/事件台词）', () => {
  for (const key of ['feed', 'play', 'idle', 'think', 'wait', 'celebrate', 'error', 'welcome', 'levelUp']) {
    assert.ok(Array.isArray(DEFAULTS.replies[key]) && DEFAULTS.replies[key].length > 0, `${key}: непустой пул`)
  }
  assert.ok(DEFAULTS.replies.idle.length >= 8, 'болтовня — не две фразы')
})

test('DEFAULTS.voice/chat：модельный голос выключен по умолчанию, беседа включена', () => {
  assert.equal(DEFAULTS.voice.enabled, false, 'голос — opt-in')
  assert.equal(DEFAULTS.voice.provider, 'browser')
  assert.equal(DEFAULTS.voice.rate, 1)
  assert.equal(DEFAULTS.chat.enabled, true)
  assert.equal(DEFAULTS.chat.historyTurns, 8)
})

test('readConfig：voice/chat 深合并（缺键补默认，嵌套不丢）', () => {
  const next = readConfig({ voice: { enabled: { get: () => true }, baseUrl: { get: () => 'http://localhost:8880/v1' } }, chat: { systemPrompt: { get: () => 'будь милой' } } })
  assert.equal(next.voice.enabled, true)
  assert.equal(next.voice.baseUrl, 'http://localhost:8880/v1')
  assert.equal(next.voice.provider, DEFAULTS.voice.provider, 'остальные листья — из DEFAULTS')
  assert.equal(next.chat.systemPrompt, 'будь милой')
  assert.equal(next.chat.maxTokens, DEFAULTS.chat.maxTokens)
})

test('API voice defaults use current models without enabling API billing', () => {
  assert.equal(DEFAULTS.voice.enabled, false)
  assert.equal(DEFAULTS.voice.provider, 'browser')
  assert.equal(DEFAULTS.voice.model, 'gpt-realtime-2.1-mini')
  assert.equal(DEFAULTS.voice.sttModel, 'gpt-transcribe')
  assert.equal(DEFAULTS.voice.voice, 'marin')
  assert.equal(DEFAULTS.voice.apiKeyEnv, 'WHALE_GIRL_TTS_API_KEY')
  assert.equal(readConfig({ voice: { provider: 'subscription' } }).voice.provider, 'subscription')
})
