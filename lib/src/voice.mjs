// Голос питомца через модели: сборка OpenAI-совместимого запроса TTS — чистые функции
// (ноль зависимостей, без сети; fetch делает Node half, см. lib/index.mjs /voice).
// Контракт:
// - «openai» = POST {baseUrl}/audio/speech с телом { model, input, voice, response_format };
//   подходит и облачным OpenAI-совместимым API, и локальным TTS-серверам (Kokoro, Fish,
//   xTTS-обёртки) — они повторяют этот контракт.
// - «browser» рисует системный SpeechSynthesis в client half (без сети и ключей);
//   Node half в этом режиме голос не генерирует.
// - Ключ берётся из config.voice.apiKey или из переменной окружения с именем
//   config.voice.apiKeyEnv (env предпочтительнее: секрет не попадает в profile patch).
// - baseUrl принимает и корень API (https://api.openai.com/v1), и полный путь
//   (.../v1/audio/speech) — нормализация ниже.

/** Максимальная длина озвучиваемого текста (символы). */
export const VOICE_TEXT_MAX = 300
/** Таймаут запроса к TTS-серверу. */
export const TTS_TIMEOUT_MS = 20000
/** Предел размера аудиоответа (защита памяти от озвучки на 10 минут). */
export const TTS_MAX_BYTES = 8 * 1024 * 1024
/** Таймаут распознавания речи (STT). */
export const STT_TIMEOUT_MS = 20000
/** Предел размера загружаемого аудио для распознавания (5 МБ). */
export const STT_MAX_BYTES = 5 * 1024 * 1024

/** Нормализация текста для озвучки: схлопнуть пробелы, обрезать, пустое → null. */
export function normalizeVoiceText(raw) {
  if (typeof raw !== 'string') return null
  const text = raw.replace(/\s+/g, ' ').trim()
  if (text === '') return null
  return text.length > VOICE_TEXT_MAX ? text.slice(0, VOICE_TEXT_MAX) : text
}

/**
 * Нормализовать базовый URL TTS: http(s), без хвостовых слэшей; полный путь
 * /audio/speech сохраняется как есть.
 * @returns {string|null}
 */
export function normalizeTtsBaseUrl(raw) {
  if (typeof raw !== 'string') return null
  const base = raw.trim().replace(/\/+$/, '')
  if (base === '' || !/^https?:\/\//i.test(base)) return null
  if (/\/audio\/speech$/i.test(base)) return base
  return `${base}/audio/speech`
}

/** Ключ: inline apiKey важнее env (пустая строка = без авторизации). */
export function resolveApiKey(voice, env = process.env) {
  const inline = typeof voice?.apiKey === 'string' ? voice.apiKey.trim() : ''
  if (inline !== '') return inline
  const name = typeof voice?.apiKeyEnv === 'string' ? voice.apiKeyEnv.trim() : ''
  if (name === '') return ''
  const fromEnv = env?.[name]
  return typeof fromEnv === 'string' ? fromEnv.trim() : ''
}

/**
 * Нормализовать базовый URL STT: http(s), без хвостовых слэшей; полный путь
 * /audio/transcriptions сохраняется, /audio/speech заменяется на распознавание.
 * @returns {string|null}
 */
export function normalizeSttUrl(raw) {
  if (typeof raw !== 'string') return null
  const base = raw.trim().replace(/\/+$/, '')
  if (base === '' || !/^https?:\/\//i.test(base)) return null
  if (/\/audio\/transcriptions$/i.test(base)) return base
  if (/\/audio\/speech$/i.test(base)) return base.replace(/\/audio\/speech$/i, '/audio/transcriptions')
  return `${base}/audio/transcriptions`
}

/**
 * Собрать multipart-запрос распознавания речи (OpenAI-совместимый
 * POST {baseUrl}/audio/transcriptions): file + model + language=ru.
 * @param {{ voice: object, audio: Uint8Array | ArrayBuffer, mime?: string, env?: Record<string, string> }} input
 * @returns {{ ok: true, url: string, headers: Record<string,string>, body: FormData } | { ok: false, error: string }}
 */
export function buildSttRequest({ voice, audio, mime = 'audio/webm', env = process.env }) {
  if (voice === null || typeof voice !== 'object') return { ok: false, error: 'voice-config-missing' }
  if (voice.provider !== 'openai') return { ok: false, error: 'voice-provider-browser' }
  const url = normalizeSttUrl(voice.baseUrl)
  if (url === null) return { ok: false, error: 'voice-base-url-invalid' }
  const bytes = audio instanceof ArrayBuffer ? new Uint8Array(audio) : audio
  if (bytes === null || typeof bytes !== 'object' || !Number.isFinite(bytes.byteLength) || bytes.byteLength === 0) {
    return { ok: false, error: 'voice-audio-empty' }
  }
  const headers = { accept: 'application/json' }
  const key = resolveApiKey(voice, env)
  if (key !== '') headers.authorization = `Bearer ${key}`
  const form = new FormData()
  const type = typeof mime === 'string' && mime.startsWith('audio/') ? mime : 'audio/webm'
  form.append('file', new Blob([bytes], { type }), type === 'audio/webm' ? 'audio.webm' : 'audio')
  form.append('model', typeof voice.sttModel === 'string' && voice.sttModel.trim() !== '' ? voice.sttModel.trim() : 'whisper-1')
  form.append('language', 'ru')
  return { ok: true, url, headers, body: form }
}

/**
 * Собрать HTTP-запрос TTS.
 * @param {{ voice: object, text: string, env?: Record<string, string> }} input
 * @returns {{ ok: true, url: string, headers: Record<string,string>, body: string } | { ok: false, error: string }}
 */
export function buildTtsRequest({ voice, text, env = process.env }) {
  if (voice === null || typeof voice !== 'object') return { ok: false, error: 'voice-config-missing' }
  if (voice.provider !== 'openai') return { ok: false, error: 'voice-provider-browser' }
  const url = normalizeTtsBaseUrl(voice.baseUrl)
  if (url === null) return { ok: false, error: 'voice-base-url-invalid' }
  const input = normalizeVoiceText(text)
  if (input === null) return { ok: false, error: 'voice-text-empty' }
  const headers = { 'content-type': 'application/json', accept: 'audio/*' }
  const key = resolveApiKey(voice, env)
  if (key !== '') headers.authorization = `Bearer ${key}`
  const model = typeof voice.model === 'string' && voice.model.trim() !== '' ? voice.model.trim() : 'tts-1'
  const payload = {
    model,
    input,
    voice: typeof voice.voice === 'string' && voice.voice.trim() !== '' ? voice.voice.trim() : 'alloy',
    response_format: typeof voice.format === 'string' && voice.format.trim() !== '' ? voice.format.trim() : 'mp3',
  }
  // Инструкции по манере речи понимает только gpt-4o*-tts; старым моделям поле не шлём.
  if (typeof voice.instructions === 'string' && voice.instructions.trim() !== '' && /gpt-4o.*tts/i.test(model)) {
    payload.instructions = voice.instructions.trim()
  }
  const body = JSON.stringify(payload)
  return { ok: true, url, headers, body }
}
