import { TTS_MAX_BYTES, TTS_TIMEOUT_MS, buildRealtimeVoiceRequest, buildTtsRequest, isRealtimeVoiceModel, voiceProviderFailure, } from './voice.js';
/** Node's Undici WebSocket extension keeps the API key in the handshake header. */
export const createNodeVoiceSocket = (url, headers) => {
    const NodeWebSocket = globalThis.WebSocket;
    return new NodeWebSocket(url, { headers: { ...headers } });
};
function record(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
/** The requested Realtime output is mono PCM16 at 24 kHz; browsers consume WAV. */
export function pcmToWav(pcm) {
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcm.byteLength, 4);
    header.write('WAVEfmt ', 8);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(24000, 24);
    header.writeUInt32LE(48000, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(pcm.byteLength, 40);
    return Buffer.concat([header, pcm]);
}
function realtimeSpeech(request, socketFactory, signal, onPcm) {
    return new Promise((resolve) => {
        let socket;
        try {
            socket = socketFactory(request.url, request.headers);
        }
        catch {
            resolve({ ok: false, error: 'tts-connection-failed' });
            return;
        }
        const chunks = [];
        let size = 0;
        let finished = false;
        let configured = false;
        let requested = false;
        let pendingByte = null;
        const finish = (result) => {
            if (finished)
                return;
            finished = true;
            signal.removeEventListener('abort', aborted);
            socket.removeEventListener('message', message);
            socket.removeEventListener('error', failed);
            socket.removeEventListener('close', closed);
            try {
                socket.close();
            }
            catch { /* outcome already records completion/failure */ }
            resolve(result);
        };
        const aborted = () => finish({ ok: false, error: signal.reason?.name === 'TimeoutError' ? 'tts-timeout' : 'tts-aborted' });
        const failed = () => finish({ ok: false, error: 'tts-connection-failed' });
        const closed = () => finish({ ok: false, error: 'tts-incomplete' });
        const message = (event) => {
            if (finished)
                return;
            try {
                const data = 'data' in event ? event.data : undefined;
                if (typeof data !== 'string' || data.length > TTS_MAX_BYTES * 2) {
                    finish({ ok: false, error: 'tts-invalid-event' });
                    return;
                }
                const value = record(JSON.parse(data));
                if (value.type === 'session.created' && !configured) {
                    configured = true;
                    socket.send(JSON.stringify({ type: 'session.update', session: request.session }));
                }
                else if (value.type === 'session.updated' && configured && !requested) {
                    requested = true;
                    socket.send(JSON.stringify({
                        type: 'conversation.item.create',
                        item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: request.text }] },
                    }));
                    socket.send(JSON.stringify({ type: 'response.create', response: { output_modalities: ['audio'] } }));
                }
                else if (value.type === 'response.output_audio.delta' && requested) {
                    if (typeof value.delta !== 'string' || value.delta.length % 4 !== 0) {
                        finish({ ok: false, error: 'tts-invalid-audio' });
                        return;
                    }
                    if (value.delta.length > Math.ceil((TTS_MAX_BYTES - size - 44) / 3) * 4) {
                        finish({ ok: false, error: 'tts-too-large' });
                        return;
                    }
                    const chunk = Buffer.from(value.delta, 'base64');
                    if (chunk.toString('base64') !== value.delta) {
                        finish({ ok: false, error: 'tts-invalid-audio' });
                        return;
                    }
                    size += chunk.length;
                    if (size + 44 > TTS_MAX_BYTES) {
                        finish({ ok: false, error: 'tts-too-large' });
                        return;
                    }
                    chunks.push(chunk);
                    if (onPcm !== undefined) {
                        const samples = pendingByte === null ? chunk : Buffer.concat([pendingByte, chunk]);
                        const aligned = samples.length - samples.length % 2;
                        pendingByte = aligned === samples.length ? null : samples.subarray(aligned);
                        if (aligned > 0) {
                            try {
                                onPcm(samples.subarray(0, aligned));
                            }
                            catch {
                                finish({ ok: false, error: 'tts-stream-failed' });
                            }
                        }
                    }
                }
                else if (value.type === 'response.done' && requested) {
                    if (record(value.response).status !== 'completed')
                        finish({ ok: false, error: 'tts-failed' });
                    else if (size === 0)
                        finish({ ok: false, error: 'tts-empty' });
                    else if (size % 2 !== 0)
                        finish({ ok: false, error: 'tts-invalid-audio' });
                    else
                        finish({ ok: true, audio: pcmToWav(Buffer.concat(chunks, size)), contentType: 'audio/wav' });
                }
                else if (value.type === 'error') {
                    finish({ ok: false, error: 'tts-failed' });
                }
            }
            catch {
                finish({ ok: false, error: 'tts-invalid-event' });
            }
        };
        socket.addEventListener('message', message);
        socket.addEventListener('error', failed);
        socket.addEventListener('close', closed);
        signal.addEventListener('abort', aborted, { once: true });
        if (signal.aborted)
            aborted();
    });
}
async function readAudio(response) {
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > TTS_MAX_BYTES)
        return { ok: false, error: 'tts-too-large' };
    const contentType = response.headers.get('content-type') ?? 'audio/mpeg';
    if (!contentType.toLowerCase().startsWith('audio/'))
        return { ok: false, error: 'tts-invalid-content-type' };
    const reader = response.body?.getReader();
    if (reader === undefined)
        return { ok: false, error: 'tts-empty' };
    let size = 0;
    const chunks = [];
    try {
        for (;;) {
            const next = await reader.read();
            if (next.done)
                break;
            size += next.value.byteLength;
            if (size > TTS_MAX_BYTES) {
                await reader.cancel();
                return { ok: false, error: 'tts-too-large' };
            }
            chunks.push(next.value);
        }
    }
    finally {
        reader.releaseLock();
    }
    if (size === 0)
        return { ok: false, error: 'tts-empty' };
    return { ok: true, audio: Buffer.concat(chunks, size), contentType };
}
/** No subscription token probing, automatic API-key selection, retries or paid fallbacks. */
export async function synthesizeVoice({ voice, text, tone, env = process.env, fetchImpl = fetch, socketFactory = createNodeVoiceSocket, signal, onPcm }) {
    const providerFailure = voiceProviderFailure(voice);
    if (providerFailure !== null)
        return providerFailure;
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(new DOMException('Voice request timed out', 'TimeoutError')), TTS_TIMEOUT_MS);
    const combined = signal === undefined ? timeout.signal : AbortSignal.any([signal, timeout.signal]);
    try {
        if (combined.aborted)
            return { ok: false, error: 'tts-aborted' };
        if (isRealtimeVoiceModel(voice?.model)) {
            const options = { voice, text, tone, env };
            const request = buildRealtimeVoiceRequest(options);
            return request.ok ? await realtimeSpeech(request, socketFactory, combined, onPcm) : request;
        }
        const options = { voice, text, tone, env };
        const request = buildTtsRequest(options);
        if (!request.ok)
            return request;
        const response = await fetchImpl(request.url, {
            method: 'POST', headers: request.headers, body: request.body, redirect: 'error', signal: combined,
        });
        if (!response.ok)
            return { ok: false, error: 'tts-failed', status: response.status };
        return await readAudio(response);
    }
    catch {
        return { ok: false, error: combined.aborted ? (timeout.signal.aborted ? 'tts-timeout' : 'tts-aborted') : 'tts-failed' };
    }
    finally {
        clearTimeout(timer);
    }
}
