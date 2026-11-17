# Decision: xstate animation machine as the single state source

Status: implemented

## Problem

Animation priority lived in a `STATE_TABLE` array in `src/client/logic.ts`, while `docs/state-machine.md` repeated the same order and `verify-spec-states` compared the two. The table was data, not a machine: another copy of the state vocabulary lived in `STATE_NAMES`, a burst row resolved its target dynamically, and the host had to call `pickState` twice to handle the visual wake edge. Adding a state meant editing table rows plus prose plus a gate fixture, and impossible or duplicate priorities were only caught after the fact.

## Decision

- Add `src/client/animation-machine.ts` with one xstate machine:
  - `ANIMATION_STATE_NAMES` is the 15-state vocabulary and also builds one stable node per state.
  - `checking` is the only transient state. Its ordered `always` guards are the priority contract; the first matching guard enters a stable node.
  - One ordered `ANIMATION_RULES` list drives the `checking` guards and derives `ANIMATION_PRIORITY`, so the executable order and the exported contract are the same list. Repeated targets are intentional (server burst `celebrate`, then local turn-completion `celebrate`; drag-release `idle`, then fallback `idle`).
  - `UPDATE` records the host input and re-enters `checking`, so every derivation uses the same order regardless of the previous state.
  - `animationStateOf(snapshot)` projects `checking` to `idle`; `checking` never renders.
- The host owns one long-lived actor in `src/client/index.ts`. `tick()` sends `UPDATE` with local signals and renders `animationStateOf(actor.getSnapshot())`; the wake edge sends a second `UPDATE` after setting `transient = 'wake'`.
- `STATE_NAMES` in `logic.ts` now aliases the machine vocabulary. There is no `pickState`/`STATE_TABLE` path left in production source; tests drive the machine directly.
- `docs/state-machine.md` names the machine as the implementation, documents the guard order, and explains extension by adding a name and a guard rather than a table row.
- `verify-spec-states` now checks the xstate stable nodes against `STATE_NAMES`, validates burst and priority membership, requires the final priority target to be `idle`, compares the documented priority list with `ANIMATION_PRIORITY`, and compares that list with the actual `checking` guard targets. It no longer reads `STATE_TABLE`.
- The sprite manifest, playback modes and rendering stay unchanged; this decision governs state selection only.

## Alternatives considered

- Keep `STATE_TABLE` and add more tests: it would preserve two copies of the order and a dynamic burst row, and would not constrain impossible states or transitions.
- Put the wake transient into the stable state graph: wake depends on the previous rendered state, so the host still needs the edge check; keeping it outside the stable nodes avoids a previous-state-dependent transition matrix.
- Keep a pure helper as the production driver: it creates and stops an actor per tick, discards history and makes the wake edge re-derive from scratch instead of using one snapshot.
- Move the machine to the Node half: the inputs are browser-local (drag, walk timers, speech state, DOM focus), so the machine must run in the client bundle.

## Consequences

- State priority has one source: `ANIMATION_RULES` in `animation-machine.ts` feeds both the guards and `ANIMATION_PRIORITY`. The docs and gate mirror that list instead of a table.
- Adding a state requires a name, a guard and a spec row; the gate rejects missing machine nodes, unknown priority targets and a non-`idle` fallback.
- The host uses one persistent actor, so the wake edge and every tick share the same snapshot; tests create a throwaway actor only in their local projection helper.
- `xstate` is already bundled into `lib/client.js` for the conversation machine, so this adds no new package or host restart.
- Tests cover the actor's `UPDATE` path, stable-node coverage, priority conflicts and the documented order. `docs/state-machine.md` remains the behavior contract.

## 取代检查

Partially supersedes the animation paragraph of `./2026-11-17-conversation-state-machine.md`, which said animation stayed on `pickState`/`STATE_TABLE`; that record remains active for chat/voice and links back here. `docs/state-machine.md` and `docs/sprites-spec.md` were updated in the same change.
