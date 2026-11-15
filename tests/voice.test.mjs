// Голос (src/voice.mjs) — чистые функции: нормализация текста/URL, ключ, сборка TTS-запроса.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  VOICE_TEXT_MAX, buildTtsRequest, normalizeTtsBaseUrl, normalizeVoiceText, resolveApiKey,
} from '../lib/src/voice.mjs'

test('normalizeVoiceText: схлопывает пробелы, обрезает, пустое → null', () => {
  assert.equal(normalizeVoiceText('  привет \n мир '), 'привет мир')
  assert.equal(normalizeVoiceText(''), null)
  assert.equal(normalizeVoiceText(null), null)
  const long = 'я'.repeat(VOICE_TEXT_MAX + 10)
  assert.equal(normalizeVoiceText(long).length, VOICE_TEXT_MAX)
})

test('normalizeTtsBaseUrl: корень API и полный путь, только http(s)', () => {
  assert.equal(normalizeTtsBaseUrl('https://api.openai.com/v1/'), 'https://api.openai.com/v1/audio/speech')
  assert.equal(normalizeTtsBaseUrl('http://localhost:8880/v1'), 'http://localhost:8880/v1/audio/speech')
  assert.equal(normalizeTtsBaseUrl('http://localhost:8880/v1/audio/speech'), 'http://localhost:8880/v1/audio/speech')
  assert.equal(normalizeTtsBaseUrl('  ftp://nope  '), null)
  assert.equal(normalizeTtsBaseUrl(''), null)
  assert.equal(normalizeTtsBaseUrl(undefined), null)
})

test('resolveApiKey: inline важнее env, имя переменной из настроек', () => {
  assert.equal(resolveApiKey({ apiKey: 'sk-inline', apiKeyEnv: 'TTS_KEY' }, { TTS_KEY: 'sk-env' }), 'sk-inline')
  assert.equal(resolveApiKey({ apiKey: '', apiKeyEnv: 'TTS_KEY' }, { TTS_KEY: 'sk-env' }), 'sk-env')
  assert.equal(resolveApiKey({ apiKey: '', apiKeyEnv: 'TTS_KEY' }, {}), '')
  assert.equal(resolveApiKey({ apiKey: '', apiKeyEnv: '' }, { TTS_KEY: 'x' }), '')
  assert.equal(resolveApiKey(null), '')
})

test('buildTtsRequest: корректный OpenAI-совместимый запрос с дефолтами', () => {
  const result = buildTtsRequest({
    voice: { provider: 'openai', baseUrl: 'http://localhost:8880/v1', model: '', voice: '', format: '', apiKey: 'sk-1' },
    text: 'Привет!',
    env: {},
  })
  assert.equal(result.ok, true)
  assert.equal(result.url, 'http://localhost:8880/v1/audio/speech')
  assert.equal(result.headers.authorization, 'Bearer sk-1')
  const body = JSON.parse(result.body)
  assert.deepEqual(body, { model: 'tts-1', input: 'Привет!', voice: 'alloy', response_format: 'mp3' })
})

test('buildTtsRequest: browser-провайдер и битые настройки → ошибка', () => {
  assert.deepEqual(
    buildTtsRequest({ voice: { provider: 'browser' }, text: 'x' }),
    { ok: false, error: 'voice-provider-browser' },
  )
  assert.deepEqual(
    buildTtsRequest({ voice: { provider: 'openai', baseUrl: '' }, text: 'x' }),
    { ok: false, error: 'voice-base-url-invalid' },
  )
  assert.deepEqual(
    buildTtsRequest({ voice: { provider: 'openai', baseUrl: 'http://localhost:1/v1' }, text: '   ' }),
    { ok: false, error: 'voice-text-empty' },
  )
  assert.deepEqual(buildTtsRequest({ voice: null, text: 'x' }), { ok: false, error: 'voice-config-missing' })
})

test('buildTtsRequest: ключ из env, кастомные модель/голос/формат', () => {
  const result = buildTtsRequest({
    voice: {
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini-tts',
      voice: 'nova',
      format: 'wav',
      apiKey: '',
      apiKeyEnv: 'MY_TTS',
    },
    text: 'Раз и два',
    env: { MY_TTS: 'sk-env' },
  })
  assert.equal(result.ok, true)
  assert.equal(result.headers.authorization, 'Bearer sk-env')
  const body = JSON.parse(result.body)
  assert.equal(body.model, 'gpt-4o-mini-tts')
  assert.equal(body.voice, 'nova')
  assert.equal(body.response_format, 'wav')
})
