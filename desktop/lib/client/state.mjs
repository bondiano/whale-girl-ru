const WAKE_MS = 3e3;
const JOY_MS = 1600;
const TRANSIENT_MS = 1500;
const SLEEP_AFTER_MS = 6e4;
const WORKING_MIN_WAIT_MS = 12e3;
const WORKING_MAX_WAIT_MS = 3e4;
const WORKING_MIN_DUR_MS = 2500;
const WORKING_MAX_DUR_MS = 6e3;
const STATE_TABLE = [
  // Valid activity bursts take priority until their deadline.
  // Use injected c.now rather than wall-clock time so selection remains pure.
  { state: "burst", when: (c) => c.activity.name !== "idle" && c.activity.name !== "working" && c.activity.until > c.now, resolve: (c) => c.activity.name },
  { state: "eat", when: (c) => c.transient === "eat" },
  { state: "play", when: (c) => c.transient === "play" },
  { state: "wake", when: (c) => c.transient === "wake" },
  { state: "wait", when: (c) => c.sessionWait },
  // Local turn-completion celebration has lower priority than event bursts.
  { state: "celebrate", when: (c) => c.celebrateUntil > c.now },
  { state: "working", when: (c) => c.workingActive },
  { state: "think", when: (c) => c.sessionThink },
  { state: "joy", when: (c) => c.now < c.joyUntil },
  { state: "sleep", when: (c) => c.sleep },
  { state: "walk", when: (c) => c.walking },
  { state: "idle", when: () => true }
];
function pickState(input) {
  const ctx = { now: input.now ?? Date.now(), ...input };
  for (const row of STATE_TABLE) {
    if (row.when(ctx)) return row.resolve ? row.resolve(ctx) : row.state;
  }
  return "idle";
}
function pickAnimation(body, sched = {}) {
  const act = body?.activity ?? { name: "idle", until: 0 };
  const now = Date.now();
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
    now
  });
  return {
    name,
    context: {
      activityName: act.name,
      pet: body?.pet ?? null,
      sessionThink: act.sessionThink === true,
      sessionWait: act.sessionWait === true,
      until: act.until ?? 0
    }
  };
}
export {
  JOY_MS,
  SLEEP_AFTER_MS,
  STATE_TABLE,
  TRANSIENT_MS,
  WAKE_MS,
  WORKING_MAX_DUR_MS,
  WORKING_MAX_WAIT_MS,
  WORKING_MIN_DUR_MS,
  WORKING_MIN_WAIT_MS,
  pickAnimation,
  pickState
};
