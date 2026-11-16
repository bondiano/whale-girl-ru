// Generator regression: create minimal source, build, tamper, and verify --check rejects drift.
// Untampered output passes; unavailable esbuild is an explicit skip.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generate, esbuildAvailable } from '../build-client.mjs'

const ENTRY = `export function apply() {}\n`

function makeRoot({ entry = ENTRY } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'gen-'))
  mkdirSync(join(root, 'src', 'client'), { recursive: true })
  mkdirSync(join(root, 'lib'), { recursive: true })
  writeFileSync(join(root, 'src', 'client', 'index.ts'), entry)
  return root
}

test('拒绝：client.js 与生成器输出不一致（含修复提示）', { skip: !esbuildAvailable() }, async () => {
  const root = makeRoot()
  await generate({ check: false, root })
  writeFileSync(join(root, 'lib', 'client.js'), readFileSync(join(root, 'lib', 'client.js'), 'utf8') + '\n// tampered')
  const result = await generate({ check: true, root })
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /不一致/)
  assert.match(result.errors.join('\n'), /build-client\.mjs/)
})

test('接受：client.js 与生成器输出一致', { skip: !esbuildAvailable() }, async () => {
  const root = makeRoot()
  await generate({ check: false, root })
  const result = await generate({ check: true, root })
  assert.equal(result.ok, true)
})

test('拒绝：client.js 缺失', { skip: !esbuildAvailable() }, async () => {
  const root = makeRoot()
  const result = await generate({ check: true, root })
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /不存在/)
})
