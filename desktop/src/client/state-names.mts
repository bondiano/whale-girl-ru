// Authoritative desktop animation state names mirror the web client.
// Renderers and state selection validate against this set, falling back for unknown names.
export const STATE_NAMES = Object.freeze([
  'idle', 'working', 'celebrate', 'error', 'disappointed', 'joy', 'eat', 'play',
  'drag', 'walk', 'sleep', 'wake', 'welcome', 'think', 'wait',
])

export function isKnownState(name) {
  return STATE_NAMES.includes(name)
}
