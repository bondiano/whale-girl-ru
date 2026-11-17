import {
  WORKING_MIN_WAIT_MS,
  WORKING_MAX_WAIT_MS,
  WORKING_MIN_DUR_MS,
  WORKING_MAX_DUR_MS
} from "./state.mjs";
function rand(min, max) {
  return min + Math.random() * (max - min);
}
function nextWorkingRhythm({ now, sessionThink, working = { active: false, until: 0 } }) {
  if (!sessionThink) return { active: false, until: 0 };
  if (working.active) {
    return { active: false, until: now + rand(WORKING_MIN_DUR_MS, WORKING_MAX_DUR_MS) };
  }
  return { active: true, until: now + rand(WORKING_MIN_WAIT_MS, WORKING_MAX_WAIT_MS) };
}
function shouldWake(prevState, nextState, ctx = {}) {
  return prevState === "sleep" && nextState !== "sleep" && !ctx.dragging && (ctx.transient ?? null) === null;
}
function wakeFromInteraction({ sleeping }) {
  return { sleeping: false, wake: sleeping === true };
}
export {
  nextWorkingRhythm,
  shouldWake,
  wakeFromInteraction
};
