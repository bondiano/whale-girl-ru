// Builds the desktop shell. Two JavaScript consumers load raw files, so both
// keep their committed paths: Electron main and the Tauri shell spawn
// lib/index.mjs, and render/index.html loads render/renderer.js plus
// render/tauri-bridge.js as classic scripts.
import { readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('..', import.meta.url))
const srcDir = join(root, 'src')
const outDir = join(root, 'lib')
const renderDir = join(root, 'render')

async function entries(dir) {
  const found = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...await entries(full))
    else if (entry.name.endsWith('.mts')) found.push(full)
  }
  return found
}

const entryPoints = await entries(srcDir)
await build({
  entryPoints,
  outdir: outDir,
  outbase: srcDir,
  outExtension: { '.js': '.mjs' },
  format: 'esm',
  platform: 'node',
  target: 'node22',
  bundle: false,
  logLevel: 'warning',
})

const renderScripts = ['renderer', 'tauri-bridge']
await build({
  entryPoints: renderScripts.map(name => join(renderDir, 'src', `${name}.ts`)),
  outdir: renderDir,
  outExtension: { '.js': '.js' },
  format: 'iife',
  target: 'es2022',
  bundle: false,
  logLevel: 'warning',
})

for (const entry of entryPoints) process.stdout.write(`emitted lib/${relative(srcDir, entry).replace(/\.mts$/, '.mjs')}\n`)
for (const name of renderScripts) process.stdout.write(`emitted render/${name}.js\n`)
