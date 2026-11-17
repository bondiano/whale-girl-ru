# Decision: xstate conversation machine for chat and voice

Status: implemented

## Problem

Chat and voice shared a dozen independent booleans (`chatOpen`, `chatPending`, `textPending`, `listening`, `recording`, `autoListening`, `speechPending`) plus timers, a speech session counter and several cancellation paths. The combinations were not constrained: a reply could stay pending after the chat closed, and `conversationMode` could reopen the microphone after a silent short reply even though no speech had played. The microphone also kept the last automatic intent after errors, so a late `onerror`/empty transcript produced a stray «Не разобрала слова» bubble after the user had already started typing.

## Decision

- Add `xstate@^5.33.4` as a client dependency and keep the machine in `src/client/conversation-machine.ts`.
- One parallel machine with two regions:
  - `chat`: `closed → composing → waiting → revealing → settled`, with `FAIL` settling from `waiting`/`revealing` and `CLOSE` leaving any state.
  - `voice`: `check → off|idle → speaking|listening|transcribing`, with `CONFIG` applying conversation/voice/typing changes live.
- `LISTEN_AUTO` is allowed only by the `autoListenAllowed` guard: conversation mode on, voice enabled and no active text entry. `LISTEN_MANUAL` bypasses that guard so a deliberate browser mic click still works with TTS disabled.
- The DOM layer no longer owns chat/voice state. `chatOpen`, `chatPending`, `textPending`, `speechPending`, `listening`, `recording` and `autoListening` are read-only projections of `conversationFlags(snapshot)`; every transition goes through `actor.send()`.
- `syncTyping()` pushes focus/draft changes as `TYPING` events before a listen decision. The old `shouldResumeConversation` predicate is removed; `canAutoListen` is the single guard.
- Automatic listening resumes only after a spoken reply (`finishSpeechSession`), never from `sendChat` after a silent short reply. Automatic failures (`onerror`, empty transcript, capture error) are silent; only a deliberate microphone action may show an error bubble.
- Server capture gets `recording`/`transcribing` phases, so the mic button and the cancellation path can see the whole lifecycle instead of inferring it from booleans.
- Animation state is owned by the separate xstate machine in `./2026-11-17-animation-state-machine.md`; the sprite manifest and rendering are untouched.

## Alternatives considered

- Keep the booleans and add more guards: the current bug came from missing combinations, so another boolean would not make impossible states unrepresentable.
- One flat machine for chat and voice: closing the chat must cancel voice, while speech may outlive the composer; separate parallel regions keep those lifecycles independent without a combinatorial state list.
- Separate actors per concern: more moving parts and duplicated cancellation; a single snapshot is easier to test and render.
- Move the machine to the Node half: the lifecycle is browser-only (focus, microphone, speech synthesis, DOM), so it must stay in the client.

## Consequences

- Impossible combinations are rejected by construction: no pending reply while closed, no hands-free listen while typing, no transcription after cancellation.
- `xstate` is bundled into `lib/client.js` by esbuild; the Node half does not import the machine. The plugin build and `npm ci` for the package include it.
- Client-only change: rebuild `lib/client.js` and refresh the page; no Node host restart needed.
- Tests cover the chat lifecycle, failure settling, the typing and conversation-mode guards, manual listening with TTS off, server transcription, speech start/stop and config-driven cancellation.
- Decision record `../bug-fix/2026-11-17-typing-voice-gate.md` keeps the behavior contract; this record replaces its mechanism.

## 取代检查

This record replaces the boolean-based mechanism of `../bug-fix/2026-11-17-typing-voice-gate.md`, not its user-visible rule: hands-free listening still stops while any text field is focused or the pet draft is non-empty. Voice records `../bug-fix/2026-11-17-long-reply-speech.md` (long-answer-only speech, full multi-chunk reading, prefetch, bubble hold) and `../bug-fix/2026-11-17-celebrate-phrase-cooldown.md` remain in force. Animation selection moved to `./2026-11-17-animation-state-machine.md`; this record covers only chat and voice.
