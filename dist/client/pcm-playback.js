const PCM_RATE = 24000;
const PCM_MAX_BYTES = 8 * 1024 * 1024;
function validPcmType(raw) {
    const [type, ...fields] = (raw ?? '').toLowerCase().split(';').map(value => value.trim());
    const parameters = new Map();
    for (const field of fields) {
        const [key, value] = field.split('=').map(part => part.trim());
        if (key !== undefined && value !== undefined)
            parameters.set(key, value);
    }
    return type === 'audio/pcm' && parameters.get('rate') === '24000'
        && parameters.get('channels') === '1' && parameters.get('encoding') === 's16le';
}
/** Play bounded mono PCM as it arrives; cancellation owns the reader, queued nodes and context. */
export async function playPcmResponse(response, options) {
    const { signal } = options;
    const aborted = () => new DOMException('Speech playback cancelled', 'AbortError');
    if (signal.aborted)
        throw aborted();
    if (!response.ok || !validPcmType(response.headers.get('content-type')))
        throw new Error('tts-invalid-content-type');
    const reader = response.body?.getReader();
    if (reader === undefined)
        throw new Error('tts-empty');
    const sources = new Set();
    let context = null;
    let stopped = false;
    let inputDone = false;
    let playing = false;
    let finishPlayback = () => { };
    const playbackDone = new Promise(resolve => { finishPlayback = resolve; });
    let interrupt = () => { };
    const interrupted = new Promise((_resolve, reject) => { interrupt = reject; });
    void interrupted.catch(() => { });
    const cancelReader = () => { void reader.cancel().catch(() => { }); };
    const stopSources = () => {
        for (const source of sources) {
            source.onended = null;
            try {
                source.stop();
            }
            catch { /* The source may already have ended. */ }
            try {
                source.disconnect();
            }
            catch { /* Disconnection is idempotent cleanup. */ }
        }
        sources.clear();
    };
    const onAbort = () => {
        stopped = true;
        stopSources();
        cancelReader();
        interrupt(aborted());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    let resumeTimer = null;
    try {
        try {
            context = (options.contextFactory ?? (() => new AudioContext()))();
            const resumeTimeout = new Promise((_resolve, reject) => {
                resumeTimer = setTimeout(() => reject(new Error('tts-playback-blocked')), 5000);
            });
            await Promise.race([context.resume(), interrupted, resumeTimeout]);
            if (signal.aborted || stopped)
                throw aborted();
            if (context.state !== 'running')
                throw new Error('tts-playback-blocked');
        }
        catch (error) {
            if (signal.aborted)
                throw aborted();
            throw new Error('tts-playback-blocked', { cause: error });
        }
        finally {
            if (resumeTimer !== null)
                clearTimeout(resumeTimer);
        }
        let nextStart = context.currentTime + 0.03;
        let size = 0;
        let trailingByte = null;
        for (;;) {
            const next = await Promise.race([reader.read(), interrupted]);
            if (signal.aborted || stopped)
                throw aborted();
            if (next.done)
                break;
            size += next.value.byteLength;
            if (size > PCM_MAX_BYTES)
                throw new Error('tts-too-large');
            let bytes = next.value;
            if (trailingByte !== null) {
                const joined = new Uint8Array(bytes.byteLength + 1);
                joined[0] = trailingByte;
                joined.set(bytes, 1);
                bytes = joined;
                trailingByte = null;
            }
            const length = bytes.byteLength - bytes.byteLength % 2;
            if (length !== bytes.byteLength)
                trailingByte = bytes[length];
            if (length === 0)
                continue;
            const buffer = context.createBuffer(1, length / 2, PCM_RATE);
            const data = buffer.getChannelData(0);
            const view = new DataView(bytes.buffer, bytes.byteOffset, length);
            for (let i = 0; i < data.length; i += 1)
                data[i] = view.getInt16(i * 2, true) / 32768;
            const source = context.createBufferSource();
            source.buffer = buffer;
            source.connect(context.destination);
            sources.add(source);
            source.onended = () => {
                if (stopped)
                    return;
                sources.delete(source);
                source.disconnect();
                if (inputDone && sources.size === 0)
                    finishPlayback();
            };
            nextStart = Math.max(nextStart, context.currentTime + 0.03);
            source.start(nextStart);
            nextStart += buffer.duration;
            if (!playing) {
                playing = true;
                options.onPlaying();
            }
        }
        if (trailingByte !== null)
            throw new Error('tts-invalid-audio');
        if (size === 0)
            throw new Error('tts-empty');
        inputDone = true;
        if (sources.size > 0)
            await Promise.race([playbackDone, interrupted]);
        if (signal.aborted || stopped)
            throw aborted();
    }
    catch (error) {
        stopped = true;
        stopSources();
        cancelReader();
        if (signal.aborted)
            throw aborted();
        if (error instanceof Error && error.message.startsWith('tts-'))
            throw error;
        throw new Error('tts-incomplete', { cause: error });
    }
    finally {
        signal.removeEventListener('abort', onAbort);
        if (resumeTimer !== null)
            clearTimeout(resumeTimer);
        try {
            reader.releaseLock();
        }
        catch { /* Cancellation may still be settling. */ }
        if (context !== null)
            void context.close().catch(() => { });
    }
}
