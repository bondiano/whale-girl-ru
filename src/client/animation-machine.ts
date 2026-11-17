// XState animation machine: the single source for the pet's visible state.
// A tick sends UPDATE with the host's local signals; the transient `checking` state resolves the
// priority list below and enters exactly one stable animation state. Stable states have no
// outgoing transitions of their own, so every re-derivation goes through `checking` and the order
// of guards is the priority order.
import { assign, setup } from 'xstate'

/** The 15 animation states. Every character supplies a sheet for each; docs/sprites-spec.md is the asset table. */
export const ANIMATION_STATE_NAMES = Object.freeze([
  'idle', 'working', 'celebrate', 'error', 'disappointed', 'joy', 'eat', 'play',
  'drag', 'walk', 'sleep', 'wake', 'welcome', 'think', 'wait',
] as const)

/** Burst names carried by the host activity interval. */
export const ANIMATION_BURST_STATES = Object.freeze([
  'welcome', 'celebrate', 'error', 'disappointed',
] as const)

export interface AnimationInput {
  activity?: { name: string; until: number }
  dragging?: boolean
  walking?: boolean
  transient?: string | null
  sleeping?: boolean
  joyUntil?: number
  now?: number
  sessionThink?: boolean
  sessionWait?: boolean
  dragReleaseUntil?: number
  workingActive?: boolean
  celebrateUntil?: number
}

export interface AnimationContext {
  activity: { name: string; until: number }
  dragging: boolean
  walking: boolean
  transient: string | null
  sleeping: boolean
  joyUntil: number
  now: number
  sessionThink: boolean
  sessionWait: boolean
  dragReleaseUntil: number
  workingActive: boolean
  celebrateUntil: number
}

/** Fill every field so guards never branch on undefined for absent input. */
export function normalizeAnimationInput(input: AnimationInput = {}): AnimationContext {
  const now = input.now ?? Date.now()
  return {
    activity: input.activity ?? { name: 'idle', until: 0 },
    dragging: input.dragging ?? false,
    walking: input.walking ?? false,
    transient: input.transient ?? null,
    sleeping: input.sleeping ?? false,
    joyUntil: input.joyUntil ?? 0,
    now,
    sessionThink: input.sessionThink ?? false,
    sessionWait: input.sessionWait ?? false,
    dragReleaseUntil: input.dragReleaseUntil ?? 0,
    workingActive: input.workingActive ?? false,
    celebrateUntil: input.celebrateUntil ?? 0,
  }
}

/** True when the host activity carries a live burst with this name. */
function burstDue(context: AnimationContext, name: string): boolean {
  return context.activity.name === name && context.activity.until > context.now
}

interface AnimationRule {
  target: string
  guard: string
  when: (context: AnimationContext) => boolean
}

/**
 * One ordered rule list drives both the machine's `checking` guards and the exported priority
 * contract, so the two cannot drift. Repeated targets are intentional: a burst and a local timer
 * can share a state name but occupy different priority positions.
 */
const ANIMATION_RULES: readonly AnimationRule[] = [
  { target: 'drag', guard: 'dragging', when: (context) => context.dragging },
  // Drag-release buffer: hold idle for 1.5 s, but let a requested wake animation through.
  {
    target: 'idle',
    guard: 'dragReleaseHeld',
    when: (context) => context.dragReleaseUntil > context.now && context.transient !== 'wake',
  },
  // Host event bursts (welcome/celebrate/error/disappointed) outrank interactions.
  { target: 'welcome', guard: 'welcomeBurst', when: (context) => burstDue(context, 'welcome') },
  { target: 'celebrate', guard: 'celebrateBurst', when: (context) => burstDue(context, 'celebrate') },
  { target: 'error', guard: 'errorBurst', when: (context) => burstDue(context, 'error') },
  { target: 'disappointed', guard: 'disappointedBurst', when: (context) => burstDue(context, 'disappointed') },
  { target: 'eat', guard: 'transientEat', when: (context) => context.transient === 'eat' },
  { target: 'play', guard: 'transientPlay', when: (context) => context.transient === 'play' },
  { target: 'wake', guard: 'transientWake', when: (context) => context.transient === 'wake' },
  { target: 'wait', guard: 'sessionWait', when: (context) => context.sessionWait },
  // Local turn-completion celebration stays below approval wait and above companionship.
  { target: 'celebrate', guard: 'celebrateUntil', when: (context) => context.celebrateUntil > context.now },
  { target: 'working', guard: 'workingActive', when: (context) => context.workingActive },
  { target: 'think', guard: 'sessionThink', when: (context) => context.sessionThink },
  { target: 'joy', guard: 'joyUntil', when: (context) => context.now < context.joyUntil },
  { target: 'sleep', guard: 'sleeping', when: (context) => context.sleeping },
  { target: 'walk', guard: 'walking', when: (context) => context.walking },
  { target: 'idle', guard: 'idleFallback', when: () => true },
]

/** Priority order of the machine's `checking` guards, derived from the same rule list. */
export const ANIMATION_PRIORITY = Object.freeze(ANIMATION_RULES.map((rule) => rule.target))

/** One stable state node per animation; `checking` is the only transient state. */
const stableStates = Object.fromEntries(ANIMATION_STATE_NAMES.map((name) => [name, {}]))

export const animationMachine = setup({
  types: {
    context: {} as AnimationContext,
    events: {} as { type: 'UPDATE'; input: AnimationInput },
  },
  actions: {
    remember: assign(({ event }) => normalizeAnimationInput(event.input)),
  },
  guards: Object.fromEntries(ANIMATION_RULES.map(rule => [rule.guard, ({ context }: { context: AnimationContext }) => rule.when(context)])),
}).createMachine({
  id: 'animation',
  initial: 'checking',
  context: normalizeAnimationInput(),
  on: {
    UPDATE: { target: '.checking', actions: 'remember' },
  },
  states: {
    checking: {
      // Guards are generated from ANIMATION_RULES, which also derives ANIMATION_PRIORITY;
      // verify-spec-states compares the documented order with that same list.
      always: ANIMATION_RULES.map(({ target, guard }) => ({ guard, target })),
    },
    ...stableStates,
  },
})

/** Project the flat machine snapshot to the visible state name; `checking` never renders. */
export function animationStateOf(snapshot: { value: unknown }): string {
  const value = snapshot.value
  return typeof value === 'string' && value !== 'checking' ? value : 'idle'
}
