import {
  JOY_MS,
  TRANSIENT_MS,
  SLEEP_AFTER_MS
} from "./state.mjs";
import { nextWorkingRhythm, wakeFromInteraction } from "./behaviors.mjs";
function rand(min, max) {
  return min + Math.random() * (max - min);
}
function createScheduler({ sleepAfterMs = SLEEP_AFTER_MS } = {}) {
  return {
    sleepAfterMs,
    idleSince: 0,
    // Idle entry timestamp; sleep counting starts here.
    sleeping: false,
    // Whether the pet is currently sleeping.
    joyUntil: 0,
    // Joy window after interaction.
    transient: null,
    // 'eat'|'play'|'wake'|null
    transientUntil: 0,
    walking: false,
    nextWalkAt: 0,
    working: { active: false, until: 0 },
    lastActivityState: "idle"
  };
}
function stepScheduler(sched, { snapshot, now = Date.now() } = {}) {
  const act = snapshot?.activity ?? { name: "idle", until: 0 };
  if (sched.transient !== null && now >= sched.transientUntil) {
    const wasFun = sched.transient === "eat" || sched.transient === "play";
    sched.transient = null;
    if (wasFun) sched.joyUntil = now + JOY_MS;
  }
  const isActive = act.name !== "idle" || act.until > now;
  if (isActive) {
    sched.idleSince = 0;
  } else if (sched.idleSince === 0) {
    sched.idleSince = now;
  }
  sched.sleeping = act.name === "idle" && sched.idleSince !== 0 && now - sched.idleSince > sched.sleepAfterMs;
  if (act.sessionThink !== true) {
    if (sched.working.active !== false || sched.working.until !== 0) {
      sched.working = { active: false, until: 0 };
    }
  } else if (sched.working.until === 0 || now >= sched.working.until) {
    sched.working = nextWorkingRhythm({ now, sessionThink: true, working: sched.working });
  }
  if (sched.walking) {
    if (now >= sched.nextWalkAt) {
      sched.walking = false;
      sched.nextWalkAt = now + rand(18e3, 4e4);
    }
  } else if (!sched.sleeping && act.name === "idle") {
    if (sched.nextWalkAt === 0) sched.nextWalkAt = now + rand(18e3, 4e4);
    if (now >= sched.nextWalkAt) {
      sched.walking = true;
      sched.nextWalkAt = now + rand(3e3, 6e3);
    }
  } else {
    if (sched.walking) sched.walking = false;
    sched.nextWalkAt = 0;
  }
  return sched;
}
function applyInteraction(sched, action, now = Date.now()) {
  const decision = wakeFromInteraction({ sleeping: sched.sleeping });
  sched.sleeping = decision.sleeping;
  sched.idleSince = 0;
  sched.joyUntil = now + JOY_MS;
  sched.transient = action === "feed" ? "eat" : "play";
  sched.transientUntil = now + TRANSIENT_MS;
  return sched;
}
export {
  applyInteraction,
  createScheduler,
  stepScheduler
};
