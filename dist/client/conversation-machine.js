// Conversation state machine: one source of truth for the chat/voice lifecycle.
//
// The pet's visible animation state is owned by the xstate machine in animation-machine.ts. What used to be a dozen
// independent booleans (chatOpen, chatPending, textPending, listening, recording, autoListening,
// speechPending) is now derived from this xstate machine so impossible combinations cannot happen:
// a reply cannot be pending while chat is closed, a hands-free microphone cannot open while text
// input is in progress, and closing the chat cancels voice/transcription instead of leaving a
// detached error bubble behind.
import { assign, setup } from 'xstate';
const eventMode = (event) => (event.type === 'LISTEN_MANUAL' || event.type === 'LISTEN_AUTO' ? event.mode : 'browser');
export const conversationMachine = setup({
    types: {
        context: {},
        events: {},
        input: {},
    },
    guards: {
        voiceOn: ({ context }) => context.voiceEnabled,
        voiceOff: ({ event }) => event.type === 'CONFIG' && event.voiceEnabled !== true,
        voiceEnabledNow: ({ event }) => event.type === 'CONFIG' && event.voiceEnabled === true,
        autoListenAllowed: ({ context }) => context.conversationMode && context.voiceEnabled && !context.userTyping,
    },
    actions: {
        rememberManual: assign({ autoListening: false, listenMode: ({ event }) => eventMode(event) }),
        rememberAuto: assign({ autoListening: true, listenMode: ({ event }) => eventMode(event) }),
        forgetListen: assign({ autoListening: false }),
        updateConfig: assign({
            conversationMode: ({ event }) => event.type === 'CONFIG' ? event.conversationMode : false,
            voiceEnabled: ({ event }) => event.type === 'CONFIG' ? event.voiceEnabled : false,
            userTyping: ({ event }) => event.type === 'CONFIG' ? event.userTyping : false,
        }),
        updateTyping: assign({ userTyping: ({ event }) => event.type === 'TYPING' ? event.userTyping : false }),
    },
}).createMachine({
    id: 'conversation',
    type: 'parallel',
    context: ({ input }) => ({
        conversationMode: input.conversationMode === true,
        voiceEnabled: input.voiceEnabled === true,
        userTyping: input.userTyping === true,
        autoListening: false,
        listenMode: 'browser',
    }),
    on: {
        CONFIG: { actions: 'updateConfig' },
        TYPING: { actions: 'updateTyping' },
    },
    states: {
        chat: {
            initial: 'closed',
            states: {
                closed: { on: { OPEN: 'composing' } },
                composing: { on: { SEND: 'waiting', CLOSE: 'closed' } },
                waiting: { on: { REPLY: 'revealing', FAIL: 'settled', CLOSE: 'closed' } },
                revealing: { on: { REVEALED: 'settled', FAIL: 'settled', CLOSE: 'closed' } },
                settled: { on: { COMPOSE: 'composing', CLOSE: 'closed' } },
            },
        },
        voice: {
            initial: 'check',
            states: {
                check: {
                    always: [
                        { target: 'idle', guard: 'voiceOn' },
                        { target: 'off' },
                    ],
                },
                off: {
                    on: {
                        CONFIG: { target: 'idle', guard: 'voiceEnabledNow' },
                        // Browser speech recognition does not need TTS: a manual mic click still works when
                        // voice output is disabled. Hands-free auto-listen stays gated on voiceEnabled.
                        LISTEN_MANUAL: { target: 'listening', actions: 'rememberManual' },
                    },
                },
                idle: {
                    on: {
                        CONFIG: { target: 'off', guard: 'voiceOff' },
                        SPEAK_START: 'speaking',
                        // Capture stops before its blob is transcribed; allow the upload to claim the voice
                        // region even after LISTEN_END already fired from the recorder's stop callback.
                        TRANSCRIBE_START: 'transcribing',
                        LISTEN_MANUAL: { target: 'listening', actions: 'rememberManual' },
                        LISTEN_AUTO: { target: 'listening', guard: 'autoListenAllowed', actions: 'rememberAuto' },
                    },
                },
                speaking: {
                    on: {
                        SPEAK_END: 'idle',
                        CANCEL: 'idle',
                        CONFIG: { target: 'off', guard: 'voiceOff', actions: 'forgetListen' },
                    },
                },
                listening: {
                    on: {
                        LISTEN_END: { target: 'idle', actions: 'forgetListen' },
                        TRANSCRIBE_START: 'transcribing',
                        CANCEL: { target: 'idle', actions: 'forgetListen' },
                        CONFIG: { target: 'off', guard: 'voiceOff', actions: 'forgetListen' },
                    },
                },
                transcribing: {
                    on: {
                        TRANSCRIBE_END: { target: 'idle', actions: 'forgetListen' },
                        CANCEL: { target: 'idle', actions: 'forgetListen' },
                        CONFIG: { target: 'off', guard: 'voiceOff', actions: 'forgetListen' },
                    },
                },
            },
        },
    },
});
/** Project the machine snapshot into the UI flags the DOM layer needs. */
export function conversationFlags(snapshot) {
    const value = snapshot.value;
    const chat = value.chat ?? 'closed';
    const voice = value.voice ?? 'off';
    return {
        chatOpen: chat !== 'closed',
        chatPending: chat === 'waiting',
        textPending: chat === 'waiting' || chat === 'revealing',
        speechPending: voice === 'speaking',
        listening: voice === 'listening' && snapshot.context.listenMode === 'browser',
        recording: voice === 'listening' && snapshot.context.listenMode === 'server',
        transcribing: voice === 'transcribing',
        autoListening: snapshot.context.autoListening,
    };
}
/** Hands-free listening is allowed only while typing is not in progress and voice is on. */
export function canAutoListen(snapshot) {
    return snapshot.context.conversationMode
        && snapshot.context.voiceEnabled
        && !snapshot.context.userTyping;
}
