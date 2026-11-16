import type { AnimationSet, Character, Manifest } from './types.js'
// Pure character-manifest readers: no DOM dependency; independently testable. Contract: the legacy
// top-level states shorthand represents the single whale-girl character; the full form is {
// characters: { <id>: { meta?, states } }, default }. Each character has { id, name?, credit?,
// meta?, states }, with a complete state-to-animation map: all 15 states require sheets, enforced
// by verify-assets, with no emoji fallback. Animation entries contain { sheet, frames, fps,
// playback, motion }. Character IDs are restricted to [a-z0-9-] for URL safety; asset routes also
// sanitize paths.
import { STATE_NAMES } from './logic.js'

export const DEFAULT_ROLE_ID = 'whale-girl'
/** Allowed character-ID alphabet for URL safety; matches the verify-assets gate. */
export const ROLE_ID_RE = /^[a-z0-9-]+$/

/** Extract { characters, defaultId }; the legacy states shorthand becomes one character. */
export function parseCharacters(manifest: Manifest | null | undefined): { characters: Record<string, Character>; defaultId: string } {
  const raw = manifest?.characters
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    const characters: Record<string, Character> = {}
    for (const [id, ch] of Object.entries(raw)) {
      if (ch === null || typeof ch !== 'object') continue
      characters[id] = {
        id,
        name: typeof ch.name === 'string' ? ch.name : id,
        credit: typeof ch.credit === 'string' ? ch.credit : undefined,
        meta: ch.meta !== null && typeof ch.meta === 'object' ? ch.meta : {},
        states: ch.states !== null && typeof ch.states === 'object' ? ch.states : {},
      }
    }
    const defaultId = typeof manifest?.default === 'string' && manifest.default in characters
      ? manifest.default
      : Object.keys(characters)[0] ?? DEFAULT_ROLE_ID
    return { characters, defaultId }
  }
  // Legacy format: top-level states describes the single whale-girl character.
  return {
    characters: {
      [DEFAULT_ROLE_ID]: {
        id: DEFAULT_ROLE_ID,
        name: DEFAULT_ROLE_ID,
        credit: undefined,
        meta: {},
        states: manifest?.states !== null && typeof manifest?.states === 'object' ? manifest.states : {},
      },
    },
    defaultId: DEFAULT_ROLE_ID,
  }
}

/** Character IDs in manifest declaration order. */
export function listCharacters(manifest: Manifest | null | undefined) {
  return Object.keys(parseCharacters(manifest).characters)
}

/** Default character ID. */
export function defaultCharacter(manifest: Manifest | null | undefined) {
  return parseCharacters(manifest).defaultId
}

/** Look up a character; return null when absent. */
export function getCharacter(manifest: Manifest | null | undefined, id: string) {
  return parseCharacters(manifest).characters[id] ?? null
}

/**
 * Read an animation from character.states. A missing state returns undefined so callers render a
 * placeholder and warn instead of using emoji. The verify-assets gate requires all 15 states in
 * distributed manifests.
 */
export function stateOf(character: Character | null, stateName: string | null): AnimationSet | undefined {
  return stateName === null ? undefined : character?.states?.[stateName]
}

/** Whether the state belongs to the authoritative state-name set. */
export function isKnownState(stateName: string) {
  return STATE_NAMES.includes(stateName)
}
