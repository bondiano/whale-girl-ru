// Pure voice tests cover text/URL normalization, explicit credentials, and speech request construction.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  VOICE_TEXT_MAX, buildSttRequest, buildTtsRequest, normalizeSttUrl, normalizeTtsBaseUrl, normalizeVoiceText, resolveApiKey,
} from '../dist/core/voice.js'

test('normalizeVoiceText: схлопывает пробелы, обрезает, пустое → null', () => {
  assert.equal(normalizeVoiceText('  привет \n мир '), 'привет мир')
  assert.equal(normalizeVoiceText(''), null)
  assert.equal(normalizeVoiceText(null), null)
  const long = 'я'.repeat(VOICE_TEXT_MAX + 10)
  assert.equal(normalizeVoiceText(long).length, VOICE_TEXT_MAX)
})

test('normalizeTtsBaseUrl: корень API и полный путь, только http(s)', () => {
  assert.equal(normalizeTtsBaseUrl('https://api.openai.com/v1/'), 'https://api.openai.com/v1/audio/speech')
  assert.equal(normalizeTtsBaseUrl('http://localhost:8880'), 'http://localhost:8880/audio/speech')
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

test('normalizeSttUrl: /audio/speech заменяется на /audio/transcriptions, только http(s)', () => {
  assert.equal(normalizeSttUrl('https://api.openai.com/v1'), 'https://api.openai.com/v1/audio/transcriptions')
  assert.equal(normalizeSttUrl('http://localhost:8880/'), 'http://localhost:8880/audio/transcriptions')
  assert.equal(normalizeSttUrl('https://api.openai.com/v1/audio/speech'), 'https://api.openai.com/v1/audio/transcriptions')
  assert.equal(normalizeSttUrl('ftp://x'), null)
  assert.equal(normalizeSttUrl(''), null)
})

test('buildSttRequest: FormData с file/model/language, без утечки ключа в поля', () => {
  const audio = Buffer.from('fake')
  const request = buildSttRequest({
    voice: { provider: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-secret' },
    audio,
    mime: 'audio/webm',
  })
  assert.equal(request.ok, true)
  assert.equal(request.url, 'https://api.openai.com/v1/audio/transcriptions')
  assert.equal(request.headers.authorization, 'Bearer sk-secret')
  assert.ok(request.body instanceof FormData)
  assert.equal(request.body.get('model'), 'gpt-transcribe')
  assert.equal(request.body.get('languages[]'), 'ru')
  assert.ok(request.body.get('file') instanceof Blob)
})

test('buildSttRequest: browser/пустое аудио/битый URL → ошибки', () => {
  assert.equal(buildSttRequest({ voice: { provider: 'browser' }, audio: Buffer.from('x') }).error, 'voice-provider-browser')
  assert.equal(buildSttRequest({ voice: { provider: 'openai', baseUrl: 'https://a/v1' }, audio: Buffer.alloc(0) }).error, 'voice-audio-empty')
  assert.equal(buildSttRequest({ voice: { provider: 'openai', baseUrl: 'ftp://a' }, audio: Buffer.from('x') }).error, 'voice-base-url-invalid')
})

test('buildTtsRequest: instructions только для gpt-4o*-tts', () => {
  const plain = buildTtsRequest({ voice: { provider: 'openai', baseUrl: 'https://a/v1', model: 'tts-1', instructions: 'мило' }, text: 'привет' })
  assert.equal(JSON.parse(plain.body).instructions, undefined)
  const expressive = buildTtsRequest({ voice: { provider: 'openai', baseUrl: 'https://a/v1', model: 'gpt-4o-mini-tts', instructions: 'мило' }, text: 'привет' })
  assert.equal(JSON.parse(expressive.body).instructions, 'мило')
})

test('subscription mode fails before credential lookup for STT and TTS', () => {
  const env = new Proxy({}, { get() { throw new Error('must not access credentials') } })
  for (const build of [buildTtsRequest, buildSttRequest]) {
    assert.deepEqual(build({ voice: { provider: 'subscription', apiKeyEnv: 'OPENAI_API_KEY' }, text: 'Привет', audio: Buffer.from('x'), env }), {
      ok: false, error: 'voice-subscription-unsupported',
    })
  }
})

test('gpt-transcribe uses languages[], legacy models preserve singular language', () => {
  for (const sttModel of ['gpt-transcribe', 'gpt-transcribe-2026-10-01', 'whisper-1', 'gpt-4o-mini-transcribe']) {
    const request = buildSttRequest({ voice: { provider: 'openai', baseUrl: 'https://api.openai.com/v1', sttModel, apiKey: 'test-api-key' }, audio: Buffer.from('x') })
    const modern = sttModel.startsWith('gpt-transcribe')
    assert.equal(request.body.get(modern ? 'languages[]' : 'language'), 'ru')
    assert.equal(request.body.get(modern ? 'language' : 'languages[]'), null)
  }
})

test('Realtime models cannot be accidentally sent to the legacy speech endpoint', () => {
  const result = buildTtsRequest({ voice: { provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-realtime-2.1-mini' }, text: 'Привет' })
  assert.deepEqual(result, { ok: false, error: 'voice-realtime-required' })
})


test('official OpenAI audio fails before the network when an API key is missing', () => {
  const voice = { provider: 'openai', baseUrl: 'https://api.openai.com/v1', apiKeyEnv: 'WHALE_GIRL_TTS_API_KEY' }
  assert.deepEqual(buildSttRequest({ voice, audio: new Uint8Array([1]), env: {} }), { ok: false, error: 'voice-api-key-required' })
  assert.deepEqual(buildTtsRequest({ voice: { ...voice, model: 'gpt-4o-mini-tts' }, text: 'Привет', env: {} }), { ok: false, error: 'voice-api-key-required' })
  assert.equal(buildSttRequest({ voice: { ...voice, baseUrl: 'http://localhost:8880/v1' }, audio: new Uint8Array([1]), env: {} }).ok, true)
})
