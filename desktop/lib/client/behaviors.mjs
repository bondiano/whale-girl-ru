// Pure desktop behavior functions mirror the web client's working interludes,
// sleep/wake edges, and interaction wakefulness without DOM dependencies.

import {
  WORKING_MIN_WAIT_MS, WORKING_MAX_WAIT_MS, WORKING_MIN_DUR_MS, WORKING_MAX_DUR_MS,
} from './state.mjs'

function rand(min, max) {
  return min + Math.random() * (max - min)
}

/**
 * Choose a working interlude during session thinking; otherwise remain in think.
 * @param {object} input
 * @param {number} input.now
 * @param {boolean} input.sessionThink
 * @param {object} input.working Current { active, until } stage.
 * @returns {object} Next { active, until } stage.
 */
export function nextWorkingRhythm({ now, sessionThink, working = { active: false, until: 0 } }) {
  if (!sessionThink) return { active: false, until: 0 }
  if (working.active) {
    return { active: false, until: now + rand(WORKING_MIN_DUR_MS, WORKING_MAX_DUR_MS) }
  }
  return { active: true, until: now + rand(WORKING_MIN_WAIT_MS, WORKING_MAX_WAIT_MS) }
}

/** Leaving a previously visible sleep state triggers wake unless dragging or a transient interrupts it. */
export function shouldWake(prevState, nextState, ctx = {}) {
  return prevState === 'sleep' && nextState !== 'sleep' && !ctx.dragging && (ctx.transient ?? null) === null
}

/** Dragging, feeding, and playing reset idle time; sleeping interactions also request wake. */
export function wakeFromInteraction({ sleeping }) {
  return { sleeping: false, wake: sleeping === true }
}
