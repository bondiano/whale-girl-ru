# Decision: TypeScript sources, selected-session context and explicit voice billing

Status: implemented

## Problem

Untyped host and browser boundaries conceal runtime mistakes. A global pet chat mixes session histories and cannot reliably explain the session displayed by the user. Voice settings conflate subscription access, browser speech and separately billed audio APIs.

## Decision

Sources live in `src/`, with strict TypeScript and `noUncheckedIndexedAccess`. NodeNext emits `dist/`; the browser builder retains the DSH loader wrapper in `lib/client.js`. Package prepare/prepack and both workstation installers build the plugin before loading it. No runtime dependency is added.

The client obtains the selected session from the public sessions snapshot's `retainedBy.mainView`. `/chat` accepts an optional bounded `sessionId`. Each model and session pair has isolated, bounded in-memory pet history. Context contains that session's activity and at most six visible user/assistant text excerpts, 400 characters each. Tool output, reasoning and system messages are excluded. Missing session data is reported as unavailable. `chat.sessionContext=false` prevents reading conversation text.

The menu groups «Как дела?» with feeding and playing, followed by conversation and settings, with an emoji on every action. Keyboard navigation, Escape and focus restoration share a small menu module. The level/status card uses inline display:none while the menu, dragging or a speech bubble occupies the pet; opening the menu hides it immediately. «Как дела?» sends a session-status question through the same chat path; the chat input contains only microphone, text and send controls. Sending a nonempty message hides and blurs the input without cancelling the pending reply or its audio; the conversation action reopens it. Event bubbles default to fifteen seconds. Chat and interaction replies allow 30–120 seconds of reading time after text reveal. Speech starts as soon as a reply arrives, alongside text reveal. Closing or replacing the conversation prevents stale reveal completion from restoring its bubble. Feeding and playing share authoritative work/programming/AI reply pools with configuration fallbacks. Idle chatter and the built-in chat persona may offer a concise practical tip. Settings opens the whale-girl package via the public pluginNavigation service. Voice switches and character cycling are absent from the menu; voice configuration stays in the package settings. Built-in and custom chat personas receive a shared instruction to use one or two suitable emojis without emoji chains.

Browser speech remains the default and voice starts disabled. Subscription audio returns an explicit unsupported error before credential lookup or network access. OpenAI API is labelled as separately billed. Its defaults are `gpt-transcribe` and Realtime `gpt-realtime-2.1-mini` with `marin`; explicitly configured speech-compatible models retain `/audio/speech`. Realtime credentials remain on the server, requests and audio are bounded, and provider failure is visible. Client configuration responses redact inline API credentials.

[OpenAI SIWC limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations) exclude audio and transcription; [API billing](https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform) is separate. Models follow the [transcription](https://developers.openai.com/api/docs/guides/speech-to-text) and [Realtime](https://developers.openai.com/api/docs/guides/realtime-conversations) contracts.

## Alternatives considered

Keeping JavaScript sources alongside TypeScript duplicates the implementation and permits tests to exercise a different runtime; only generated JavaScript is distributed.

Using ChatGPT private backend endpoints lacks a supported subscription audio contract. Automatically trying an API key would create paid requests under a misleading subscription label.

Sending every running session to the model makes «current session» ambiguous and leaks unrelated conversation content. The selected-session boundary is explicit.

## Consequences

Node changes require a host restart; client changes require rebuilding and reloading. macOS and WSL share the same built plugin. The standalone `desktop/` companion retains its independent build and scope.

Submission removes the old greeting before showing typing. Ordinary workspace clicks dismiss a visible composer but preserve a submitted reply and its audio; Escape and settings explicitly cancel the exchange. Hidden exchanges release the pet after the reading window, pending request and speech have all ended.

Validation covers compiled-domain behavior, selected-session isolation, subscription refusal, audio transport, menu navigation, early speech versus reveal ordering, cancellation, generated-bundle freshness and source-sensitive gates. A live browser probe covers composer dismissal/reopening, retained replies after workspace clicks and menu grouping without the level card.

Partial supersession (部分取代): [voice, news and session context](../feature/2026-11-16-pet-voice-news-session.md) retains news and model selection; this record owns selected-session excerpts, isolated history and audio authentication. The official bundle contract remains in force.
