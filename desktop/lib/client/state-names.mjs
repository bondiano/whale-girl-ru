const STATE_NAMES = Object.freeze([
  "idle",
  "working",
  "celebrate",
  "error",
  "disappointed",
  "joy",
  "eat",
  "play",
  "drag",
  "walk",
  "sleep",
  "wake",
  "welcome",
  "think",
  "wait"
]);
function isKnownState(name) {
  return STATE_NAMES.includes(name);
}
export {
  STATE_NAMES,
  isKnownState
};
