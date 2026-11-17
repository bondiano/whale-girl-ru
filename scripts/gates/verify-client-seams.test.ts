// Client service gate regressions prove retired references are rejected.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { check } from './verify-client-seams.ts'

const OK_SOURCE = "export const inject = ['slots', 'locale', 'configForms']"
const OK_BUNDLE = 'window.__ModuleLoader__.load({ id: "whale-girl", factory: () => {} });'

/** Create a minimal src/client/index.ts tree and generated lib/client.js bundle. */
function makeTree({ client = OK_SOURCE, bundle = OK_BUNDLE } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'vseams-'))
  const mk = (rel, content) => {
    const p = join(root, rel)
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, content)
  }
  mk('src/client/index.ts', client)
  mk('lib/client.js', bundle)
  return root
}

test('接受：client 源码与生成物只用现行缝名', () => {
  const { ok, errors } = check(makeTree())
  assert.equal(ok, true, errors.join('\n'))
})

test('拒绝：源码注入已退役服务 settingsScope', () => {
  const { ok, errors } = check(makeTree({ client: "export const inject = ['slots', 'settingsScope']" }))
  assert.equal(ok, false)
  assert.match(errors.join('\n'), /settingsScope（现行：configForms/)
})

test('拒绝：生成物残留已退役槽名 settings.plugin.item（生成物与源码一致才合规）', () => {
  const { ok, errors } = check(makeTree({ bundle: 'ctx.slots.inject("settings.plugin.item", () => {})' }))
  assert.equal(ok, false)
  assert.match(errors.join('\n'), /settings\.plugin\.item（现行：plugins\.item/)
})

test('拒绝：client half 产物缺失（无法判定缝名）', () => {
  const root = makeTree()
  const { ok, errors } = check(join(root, 'missing-root'))
  assert.equal(ok, false)
  assert.match(errors.join('\n'), /无法列举/)
})
