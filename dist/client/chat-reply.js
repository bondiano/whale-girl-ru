/** Text generation and voice preparation are distinct from audible playback. */
export function replyWaitingPhase(textPending, voicePending, speaking) {
    return textPending ? 'thinking' : voicePending && !speaking ? 'voice' : null;
}
/** Start speech alongside text reveal; cancellation must never restore an obsolete reply. */
export async function presentChatReply(options) {
    if (!options.current())
        return;
    options.speak();
    await options.reveal();
    if (options.current())
        options.finish();
}
