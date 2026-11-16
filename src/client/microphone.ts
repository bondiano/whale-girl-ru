/** Capture owns its tracks and submits only after an intentional stop. */
export function createMicrophoneCapture(options: {
  allowed(): boolean;
  acquire(): Promise<MediaStream>;
  create(stream: MediaStream): MediaRecorder;
  recording(value: boolean): void;
  audio(blob: Blob, mime: string): void;
  error(reason: unknown): void;
}) {
  let generation = 0
  let pending = false
  let active: { recorder: MediaRecorder; stream: MediaStream; submit: boolean; timer: ReturnType<typeof setTimeout> | null } | null = null
  const tracksOff = (stream: MediaStream) => { for (const track of stream.getTracks()) track.stop() }
  const stop = (submit = true) => {
    const capture = active
    if (capture === null) return
    capture.submit = submit
    if (capture.timer !== null) { clearTimeout(capture.timer); capture.timer = null }
    if (capture.recorder.state !== 'inactive') capture.recorder.stop()
  }
  const cancel = () => {
    generation += 1
    pending = false
    const capture = active
    if (capture !== null) {
      capture.submit = false
      tracksOff(capture.stream)
      stop(false)
      active = null
    }
    options.recording(false)
  }
  const start = async () => {
    if (pending || active !== null || !options.allowed()) return
    const token = ++generation
    pending = true
    let stream: MediaStream | null = null
    try {
      stream = await options.acquire()
      if (token !== generation || !options.allowed()) { tracksOff(stream); return }
      const recorder = options.create(stream)
      const capture = { recorder, stream, submit: false, timer: null as ReturnType<typeof setTimeout> | null }
      const chunks: Blob[] = []
      active = capture
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data) }
      recorder.onstop = () => {
        tracksOff(capture.stream)
        if (capture.timer !== null) clearTimeout(capture.timer)
        if (active === capture) { active = null; options.recording(false) }
        if (!capture.submit || token !== generation || !options.allowed()) return
        const mime = recorder.mimeType || 'audio/webm'
        const blob = new Blob(chunks, { type: mime })
        if (blob.size > 0) options.audio(blob, mime)
      }
      recorder.onerror = () => {
        if (token !== generation) return
        cancel()
        options.error(new Error('audio-capture'))
      }
      recorder.start()
      options.recording(true)
      capture.timer = setTimeout(() => stop(true), 30000)
    } catch (error) {
      if (stream !== null) tracksOff(stream)
      if (token === generation) { cancel(); options.error(error) }
    } finally {
      if (token === generation) pending = false
    }
  }
  return { start, stop, cancel, busy: () => pending || active !== null }
}

/** Delayed conversation re-entry belongs to the open chat generation. */
export function createConversationResume(allowed: () => boolean, listen: () => void, delayMs = 250) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let generation = 0
  const cancel = () => {
    generation += 1
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  const schedule = () => {
    cancel()
    if (!allowed()) return
    const token = generation
    timer = setTimeout(() => {
      timer = null
      if (token === generation && allowed()) listen()
    }, delayMs)
  }
  return { cancel, schedule }
}

/** A response may play only while its exact request remains current. */
export function createSpeechRequest() {
  let active: AbortController | null = null
  const cancel = () => { active?.abort(); active = null }
  const start = () => { cancel(); active = new AbortController(); return active.signal }
  const current = (signal: AbortSignal) => active?.signal === signal && !signal.aborted
  return { start, cancel, current }
}
