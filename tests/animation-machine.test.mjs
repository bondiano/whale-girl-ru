// XState animation machine regressions: the machine, not ad-hoc booleans, derives every visible state.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createActor } from 'xstate'
import {
  ANIMATION_BURST_STATES,
  ANIMATION_PRIORITY,
  ANIMATION_STATE_NAMES,
  animationMachine,
  animationStateOf,
} from '../dist/client/animation-machine.js'

const IDLE = { activity: { name: 'idle', until: 0 }, dragging: false, transient: null, sleeping: false, joyUntil: 0, now: 1000 }

function project(actor, patch = {}) {
  actor.send({ type: 'UPDATE', input: { ...IDLE, ...patch } })
  return animationStateOf(actor.getSnapshot())
}

test('машина стартует в idle и переходит по UPDATE', () => {
  const actor = createActor(animationMachine).start()
  assert.equal(animationStateOf(actor.getSnapshot()), 'idle')
  assert.equal(project(actor, { dragging: true }), 'drag')
  assert.equal(project(actor, { transient: 'eat' }), 'eat')
  assert.equal(project(actor, { sessionWait: true }), 'wait')
  assert.equal(project(actor, { sessionThink: true }), 'think')
  assert.equal(project(actor, { sleeping: true }), 'sleep')
  assert.equal(project(actor), 'idle')
  actor.stop()
})

test('стабильные узлы покрывают состояние и приоритеты', () => {
  const nodes = Object.keys(animationMachine.states).filter((name) => name !== 'checking')
  assert.deepEqual(nodes, [...ANIMATION_STATE_NAMES])
  for (const name of ANIMATION_PRIORITY) assert.ok(ANIMATION_STATE_NAMES.includes(name))
  for (const name of ANIMATION_BURST_STATES) assert.ok(ANIMATION_STATE_NAMES.includes(name))
  // A transient checking snapshot must never render.
  assert.equal(animationStateOf({ value: 'checking' }), 'idle')
})

test('UPDATE учитывает приоритет guards, а не предыдущее состояние', () => {
  const actor = createActor(animationMachine).start()
  assert.equal(project(actor, { activity: { name: 'welcome', until: 2000 }, transient: 'eat' }), 'welcome')
  assert.equal(project(actor, { activity: { name: 'celebrate', until: 2000 }, sessionWait: true }), 'celebrate')
  assert.equal(project(actor, { sessionWait: true, sessionThink: true }), 'wait')
  assert.equal(project(actor, { dragReleaseUntil: 2500, now: 1000, sessionThink: true }), 'idle')
  assert.equal(project(actor, { dragReleaseUntil: 2500, now: 3000, sessionThink: true }), 'think')
  actor.stop()
})
