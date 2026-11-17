import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
for (const [command, args] of [
  [process.execPath, ['node_modules/typescript/bin/tsc']],
  [process.execPath, ['scripts/build-client.ts']],
]) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
