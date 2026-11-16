// Local scheduler advances sleep, walk, working interludes, and eat/play/joy/wake transients.
// Server snapshots provide event windows and session facts; local ticks provide rhythm.
// State is serializable data, advanced by step() with defaults matching the web client.

import {
  JOY_MS, TRANSIENT_MS, SLEEP_AFTER_MS,
  WORKING_MIN_WAIT_MS, WORKING_MAX_WAIT_MS, WORKING_MIN_DUR_MS, WORKING_MAX_DUR_MS,
} from './state.mjs'
import { nextWorkingRhythm, shouldWake, wakeFromInteraction } from './behaviors.mjs'

function rand(min, max) {
  return min + Math.random() * (max - min)
}

/** Initial scheduler state. */
export function createScheduler({ sleepAfterMs = SLEEP_AFTER_MS } = {}) {
  return {
    sleepAfterMs,
    idleSince: 0,          // Idle entry timestamp; sleep counting starts here.
    sleeping: false,       // Whether the pet is currently sleeping.
    joyUntil: 0,           // Joy window after interaction.
    transient: null,       // 'eat'|'play'|'wake'|null
    transientUntil: 0,
    walking: false,
    nextWalkAt: 0,
    working: { active: false, until: 0 },
    lastActivityState: 'idle',
  }
}

/**
 * Advance the scheduler for one engine tick.
 * @param {object} sched Scheduler state.
 * @param {object} ctx
 * @param {object} ctx.snapshot Server state snapshot.
 * @param {number} ctx.now
 */
export function stepScheduler(sched, { snapshot, now = Date.now() } = {}) {
  const act = snapshot?.activity ?? { name: 'idle', until: 0 }
  // Clear eat/play/wake after playback or timeout.
  if (sched.transient !== null && now >= sched.transientUntil) {
    const wasFun = sched.transient === 'eat' || sched.transient === 'play'
    sched.transient = null
    if (wasFun) sched.joyUntil = now + JOY_MS
  }
  // Use session activity to update idle timing and sleep.
  const isActive = act.name !== 'idle' || act.until > now
  if (isActive) {
    sched.idleSince = 0
  } else if (sched.idleSince === 0) {
    sched.idleSince = now
  }
  sched.sleeping = act.name === 'idle' && sched.idleSince !== 0 && now - sched.idleSince > sched.sleepAfterMs

  // Arm working interludes only during session thinking, and reconsider only at
  // the stage boundary; unconditional decisions every tick would rapidly flicker think/working.
  if (act.sessionThink !== true) {
    if (sched.working.active !== false || sched.working.until !== 0) {
      sched.working = { active: false, until: 0 }
    }
  } else if (sched.working.until === 0 || now >= sched.working.until) {
    sched.working = nextWorkingRhythm({ now, sessionThink: true, working: sched.working })
  }

  // Occasionally wander while idle. Leaving idle resets the schedule to avoid immediate wandering on return.
  if (sched.walking) {
    if (now >= sched.nextWalkAt) {
      sched.walking = false
      sched.nextWalkAt = now + rand(18000, 40000)
    }
  } else if (!sched.sleeping && act.name === 'idle') {
    if (sched.nextWalkAt === 0) sched.nextWalkAt = now + rand(18000, 40000)
    if (now >= sched.nextWalkAt) {
      sched.walking = true
      sched.nextWalkAt = now + rand(3000, 6000)
    }
  } else {
    if (sched.walking) sched.walking = false
    sched.nextWalkAt = 0 // Reset the wander schedule outside idle.
  }

  return sched
}

/**
 * Reset idle and start eat/play after interaction; these outrank wake.
 * Wake is reserved for non-interaction paths such as drag release.
 * An explicit now keeps this boundary deterministic with scheduler tests.
 */
export function applyInteraction(sched, action, now = Date.now()) {
  const decision = wakeFromInteraction({ sleeping: sched.sleeping })
  sched.sleeping = decision.sleeping
  sched.idleSince = 0
  sched.joyUntil = now + JOY_MS
  sched.transient = action === 'feed' ? 'eat' : 'play'
  sched.transientUntil = now + TRANSIENT_MS
  return sched
}
