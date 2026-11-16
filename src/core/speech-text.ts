/** Remove whole emoji sequences while preserving ordinary digits, punctuation and programming text. */
export function cleanSpeechText(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw
    .replace(/[#*0-9]\uFE0F?\u20E3/gu, ' ')
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}]/gu, ' ')
    .replace(/\u200D|\uFE0E|\uFE0F|\u20E3|[\u{E0020}-\u{E007F}]/gu, '')
    .replace(/[«»"]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim()
}

const TONES = {
  warm: 'Произнеси тепло, дружелюбно и естественно.',
  cheerful: 'Произнеси радостно и с лёгким воодушевлением, без крика.',
  calm: 'Произнеси спокойно и мягко, с поддерживающей интонацией.',
  focused: 'Произнеси собранно и ясно, как короткий совет коллеге.',
  curious: 'Произнеси с живой, доброжелательной вопросительной интонацией.',
} as const
export type SpeechTone = keyof typeof TONES

/** Mood is separate metadata; emoji and tone names never become spoken content. */
export function speechTone(text: string): SpeechTone {
  if (/не (?:удалось|получилось)|ошибк|сбой|расстро/i.test(text)) return 'calm'
  if (/ура|побед|справились|отличн|!/i.test(text)) return 'cheerful'
  if (text.includes('?')) return 'curious'
  if (/код|тест|AI|программ|граничн|отлад/i.test(text)) return 'focused'
  return 'warm'
}

/** Only known delivery styles supplement the administrator's existing voice instructions. */
export function toneInstructions(configured: unknown, tone: unknown): string {
  const base = typeof configured === 'string' ? cleanSpeechText(configured).slice(0, 500) : ''
  const delivery = typeof tone === 'string' && Object.hasOwn(TONES, tone) ? TONES[tone as SpeechTone] : ''
  return [base, delivery].filter(Boolean).join(' ')
}
