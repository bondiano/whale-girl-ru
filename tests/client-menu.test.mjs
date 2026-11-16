import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bindMenuKeyboard, currentSessionId, menuFocusIndex, SESSION_STATUS_QUESTION } from '../dist/client/menu.js'

test('menu focus wraps, handles endpoints and ignores unrelated keys', () => {
  assert.equal(menuFocusIndex('ArrowDown', 2, 3), 0)
  assert.equal(menuFocusIndex('ArrowUp', 0, 3), 2)
  assert.equal(menuFocusIndex('ArrowDown', -1, 3), 0)
  assert.equal(menuFocusIndex('Home', 2, 3), 0)
  assert.equal(menuFocusIndex('End', 0, 3), 2)
  assert.equal(menuFocusIndex('x', 1, 3), -1)
  assert.equal(menuFocusIndex('Home', -1, 0), -1)
})

test('current session follows the unique mainView reference, never the running/background session', () => {
  const byId = {
    background: { running: true, retainedBy: { controllerOperation: 1 } },
    shown: { running: false, retainedBy: { mainView: 1 } },
  }
  assert.equal(currentSessionId({ byId }), 'shown')
  assert.equal(currentSessionId({ byId: { ...byId, duplicate: { retainedBy: { mainView: 1 } } } }), undefined)
  assert.equal(currentSessionId({ byId: { background: byId.background } }), undefined)
  assert.equal(currentSessionId(null), undefined)
  assert.equal(currentSessionId({ byId: { malformed: null } }), undefined)
  assert.match(SESSION_STATUS_QUESTION, /текущей сессии/)
})

test('keyboard skips unavailable items, Escape restores trigger and Tab lets focus leave', () => {
  const ownerDocument = { activeElement: null }
  const item = (disabled = false, display = '') => ({ disabled, style: { display }, focus() { ownerDocument.activeElement = this } })
  const items = [item(), item(true), item(false, 'none'), item()]
  const listeners = new Map()
  const menu = { ownerDocument, querySelectorAll: () => items, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name) => listeners.delete(name) }
  const closed = []
  const dispose = bindMenuKeyboard(menu, (restore) => closed.push(restore))
  const key = (key) => { let prevented = false; listeners.get('keydown')({ key, preventDefault() { prevented = true }, stopPropagation() {} }); return prevented }
  assert.equal(key('ArrowDown'), true)
  assert.equal(ownerDocument.activeElement, items[0])
  key('ArrowDown')
  assert.equal(ownerDocument.activeElement, items[3])
  key('ArrowDown')
  assert.equal(ownerDocument.activeElement, items[0])
  assert.equal(key('Escape'), true)
  assert.equal(key('Tab'), false)
  assert.deepEqual(closed, [true, false])
  dispose()
  assert.equal(listeners.size, 0)
})
