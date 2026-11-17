/** Remove whole emoji sequences while preserving ordinary digits, punctuation and programming text. */
export function cleanSpeechText(raw) {
    if (typeof raw !== 'string')
        return '';
    return raw
        .replace(/[#*0-9]\uFE0F?\u20E3/gu, ' ')
        .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}]/gu, ' ')
        .replace(/\u200D|\uFE0E|\uFE0F|\u20E3|[\u{E0020}-\u{E007F}]/gu, '')
        .replace(/[«»"]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s+([,.!?;:])/g, '$1')
        .trim();
}
/** Longest speech chunk accepted by the TTS boundary; matches VOICE_TEXT_MAX without importing voice.ts. */
const SPEECH_CHUNK_MAX = 300;
/** Return the end of the last sentence, clause, or word boundary inside the window, if any. */
function lastBreakEnd(window, pattern) {
    let end = 0;
    for (const match of window.matchAll(pattern))
        end = (match.index ?? 0) + match[0].length;
    return end;
}
/**
 * Split a reply into TTS-sized chunks without dropping words. Boundaries are preferred in this
 * order: sentence punctuation, clause punctuation, dash, whitespace. A single word longer than
 * the limit is cut at the limit because no boundary exists; joining chunks cut on whitespace with
 * single spaces reproduces the cleaned text.
 */
export function splitSpeechChunks(raw, max = SPEECH_CHUNK_MAX) {
    const restText = cleanSpeechText(raw);
    if (restText === '')
        return [];
    const limit = Number.isFinite(max) ? Math.max(1, Math.floor(Number(max))) : SPEECH_CHUNK_MAX;
    const chunks = [];
    let rest = restText;
    while (rest !== '') {
        const chars = Array.from(rest);
        if (chars.length <= limit) {
            chunks.push(rest);
            break;
        }
        const window = chars.slice(0, limit).join('');
        const cut = lastBreakEnd(window, /[.!?…]["»']?\s/g)
            || lastBreakEnd(window, /[,;:]\s/g)
            || lastBreakEnd(window, /[—–-]\s/g)
            || lastBreakEnd(window, /\s/g)
            || window.length;
        const piece = window.slice(0, cut).trim();
        if (piece !== '')
            chunks.push(piece);
        rest = rest.slice(cut).trimStart();
    }
    return chunks;
}
/**
 * Long-answer auto-speech is opt-in and needs an explicit length threshold. A voice block without
 * minSpeakChars predates this mode (when auto-read defaulted on), so it stays silent instead of
 * reviving reading from stale settings.
 */
export function shouldSpeakReply(text, voice) {
    if (voice === null || typeof voice !== 'object')
        return false;
    if (voice.enabled !== true || voice.autoSpeakChat !== true)
        return false;
    if (typeof voice.minSpeakChars !== 'number' || !Number.isFinite(voice.minSpeakChars))
        return false;
    const clean = cleanSpeechText(text);
    if (clean === '')
        return false;
    const minimum = Math.max(0, Math.floor(voice.minSpeakChars));
    return minimum === 0 || Array.from(clean).length >= minimum;
}
const TONES = {
    warm: 'Произнеси тепло, дружелюбно и естественно.',
    cheerful: 'Произнеси радостно и с лёгким воодушевлением, без крика.',
    calm: 'Произнеси спокойно и мягко, с поддерживающей интонацией.',
    focused: 'Произнеси собранно и ясно, как короткий совет коллеге.',
    curious: 'Произнеси с живой, доброжелательной вопросительной интонацией.',
};
/** Mood is separate metadata; emoji and tone names never become spoken content. */
export function speechTone(text) {
    if (/не (?:удалось|получилось)|ошибк|сбой|расстро/i.test(text))
        return 'calm';
    if (/ура|побед|справились|отличн|!/i.test(text))
        return 'cheerful';
    if (text.includes('?'))
        return 'curious';
    if (/код|тест|AI|программ|граничн|отлад/i.test(text))
        return 'focused';
    return 'warm';
}
/** Only known delivery styles supplement the administrator's existing voice instructions. */
export function toneInstructions(configured, tone) {
    const base = typeof configured === 'string' ? cleanSpeechText(configured).slice(0, 500) : '';
    const delivery = typeof tone === 'string' && Object.hasOwn(TONES, tone) ? TONES[tone] : '';
    return [base, delivery].filter(Boolean).join(' ');
}
