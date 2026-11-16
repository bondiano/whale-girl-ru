// Map server activity and pet snapshots to desktop animation intents without DOM.
// Priority mirrors the web client without its drag branch: event burst, local transient,
// wait, turn celebration, working interlude, think, joy, sleep, walk, idle.
// Return { name, context } with only the renderer's required parameters.
// Selection is pure; persistent rhythm belongs to the scheduler.

import { STATE_NAMES } from './state-names.mjs'

// Local timing parameters mirror the web client's constants.
export const WAKE_MS = 3000        // Wake transition.
export const JOY_MS = 1600         // Brief joy after interaction.
export const TRANSIENT_MS = 1500   // Eat/play transient.
export const SLEEP_AFTER_MS = 60000 // Sleep after 60 idle seconds, matching the plugin default.
// Working interludes appear occasionally during session thinking.
export const WORKING_MIN_WAIT_MS = 12000
export const WORKING_MAX_WAIT_MS = 30000
export const WORKING_MIN_DUR_MS = 2500
export const WORKING_MAX_DUR_MS = 6000

/**
 * State table order defines priority, matching the web client except drag.
 * Input includes activity/session flags, celebration/joy windows, sleep/walk,
 * transient state, and workingActive.
 */
export const STATE_TABLE = [
  // Valid activity bursts take priority until their deadline.
  // Use injected c.now rather than wall-clock time so selection remains pure.
  { state: 'burst', when: (c) => c.activity.name !== 'idle' && c.activity.name !== 'working' && c.activity.until > c.now, resolve: (c) => c.activity.name },
  { state: 'eat', when: (c) => c.transient === 'eat' },
  { state: 'play', when: (c) => c.transient === 'play' },
  { state: 'wake', when: (c) => c.transient === 'wake' },
  { state: 'wait', when: (c) => c.sessionWait },
  // Local turn-completion celebration has lower priority than event bursts.
  { state: 'celebrate', when: (c) => c.celebrateUntil > c.now },
  { state: 'working', when: (c) => c.workingActive },
  { state: 'think', when: (c) => c.sessionThink },
  { state: 'joy', when: (c) => c.now < c.joyUntil },
  { state: 'sleep', when: (c) => c.sleep },
  { state: 'walk', when: (c) => c.walking },
  { state: 'idle', when: () => true },
]

/** Select an animation name using explicit time for deterministic tests. */
export function pickState(input) {
  const ctx = { now: input.now ?? Date.now(), ...input }
  for (const row of STATE_TABLE) {
    if (row.when(ctx)) return row.resolve ? row.resolve(ctx) : row.state
  }
  return 'idle'
}

/**
 * Derive animation intent from a server snapshot and local scheduler.
 * @param {object} body State response.
 * @param {object} sched Local state from createScheduler().
 * @returns {{ name: string, context: object }}
 */
export function pickAnimation(body, sched = {}) {
  const act = body?.activity ?? { name: 'idle', until: 0 }
  const now = Date.now()
  const name = pickState({
    activity: act,
    sessionThink: act.sessionThink === true,
    sessionWait: act.sessionWait === true,
    celebrateUntil: act.turnCompletedUntil ?? 0,
    joyUntil: sched.joyUntil ?? 0,
    transient: sched.transient ?? null,
    sleep: sched.sleeping === true,
    walking: sched.walking === true,
    workingActive: sched.working?.active === true,
    now,
  })
  return {
    name,
    context: {
      activityName: act.name,
      pet: body?.pet ?? null,
      sessionThink: act.sessionThink === true,
      sessionWait: act.sessionWait === true,
      until: act.until ?? 0,
    },
  }
}
