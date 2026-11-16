// Validate the asset manifest deterministically without writes.
// Every character must provide all 15 known states, existing allowed sheet files,
// valid frame counts/fps, and playback with loop>=1, pingpong>=2, once>=1, blink>=2.
// Motion recipes normally require one frame; error alone permits multi-frame shake.
// Multi-frame PNG sheets must have width = frames * height.
// State names must belong to the client's authoritative STATE_NAMES set.
import { readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { STATE_NAMES, PLAYBACK_MODES, PLAYBACK_MIN_FRAMES } from '../../dist/client/logic.js'
import { ROLE_ID_RE } from '../../dist/client/character.js'

const ROOT = resolve(import.meta.dirname, '../..')

/** Allowed extensions match the core asset MIME table. */
const ALLOWED_EXT = ['.png', '.svg', '.webp', '.jpg', '.jpeg', '.gif', '.json']

/** Allowed motion recipes match client pet-motion-* classes. */
export const MOTION_WHITELIST = ['bob', 'wiggle', 'squash', 'shake', 'sigh', 'hop', 'tilt', 'float', 'wave']

/** Only these states allow multi-frame sheets combined with motion; error uses two frames plus shake. */
export const MOTION_MULTIFRAME_ALLOWED = new Set(['error'])

/** Read PNG IHDR dimensions without dependencies; return null for other formats. */
function pngSize(file) {
  const buf = readFileSync(file)
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

/** Validate one character's states; sheets live under assets/characters/<id>/. */
function checkStates(states, roleId, errors, root) {
  const dir = roleId === null ? join(root, 'lib', 'assets') : join(root, 'lib', 'assets', 'characters', roleId)
  const label = roleId === null ? 'states' : `characters.${roleId}.states`
  // Require all 15 states; missing artwork cannot fall back to emoji.
  const declared = new Set(Object.keys(states))
  for (const name of STATE_NAMES) {
    if (!declared.has(name)) {
      errors.push(`${label}: 缺必备状态 ${name}（素材必须全量提供 15 状态，不再 emoji 降级）`)
    }
  }
  for (const [name, cfg] of Object.entries(states)) {
    if (!STATE_NAMES.includes(name)) {
      errors.push(`${label}.${name}: 状态不在 client STATE_NAMES 权威集合（须同步 client/logic.mjs 与 spec）`)
    }
    if (cfg === null || typeof cfg !== 'object' || typeof cfg.sheet !== 'string' || cfg.sheet === '') {
      errors.push(`${label}.${name}: 缺 sheet 字段`)
      continue
    }
    const file = join(dir, cfg.sheet)
    try {
      if (!statSync(file).isFile()) throw new Error('not a file')
    } catch {
      errors.push(`${label}.${name}: sheet "${cfg.sheet}" 文件不存在（期望 ${dir.slice(root.length + 1)}/${cfg.sheet}）`)
    }
    const dot = cfg.sheet.lastIndexOf('.')
    const ext = dot === -1 ? '' : cfg.sheet.slice(dot).toLowerCase()
    if (!ALLOWED_EXT.includes(ext)) {
      errors.push(`${label}.${name}: sheet "${cfg.sheet}" 扩展名不在白名单 ${ALLOWED_EXT.join('/')}`)
    }
    if (!Number.isInteger(cfg.frames) || cfg.frames < 1) errors.push(`${label}.${name}: frames 必须是正整数`)
    if (typeof cfg.fps !== 'number' || cfg.fps <= 0) errors.push(`${label}.${name}: fps 必须是正数`)
    // Optional frameMs must contain one positive duration per frame.
    // Without it, playback uses the uniform fps interval.
    if (cfg.frameMs !== undefined) {
      if (!Array.isArray(cfg.frameMs) || cfg.frameMs.length !== cfg.frames
        || !cfg.frameMs.every((ms) => typeof ms === 'number' && Number.isFinite(ms) && ms > 0)) {
        errors.push(`${label}.${name}: frameMs 必须是正数数组且长度 === frames（逐帧停留 ms；缺省回退 fps 节拍）`)
      }
    }
    // Cross-check playback mode and its minimum frame count.
    if (!PLAYBACK_MODES.includes(cfg.playback)) {
      errors.push(`${label}.${name}: playback "${cfg.playback}" 不在 ${PLAYBACK_MODES.join('/')}`)
    } else if (cfg.frames < PLAYBACK_MIN_FRAMES[cfg.playback]) {
      errors.push(`${label}.${name}: playback ${cfg.playback} 要求 frames ≥ ${PLAYBACK_MIN_FRAMES[cfg.playback]}（当前 ${cfg.frames}）`)
    }
    if (cfg.motion !== undefined) {
      if (!MOTION_WHITELIST.includes(cfg.motion)) {
        errors.push(`${label}.${name}: motion "${cfg.motion}" 不在白名单 ${MOTION_WHITELIST.join('/')}`)
      }
      if (cfg.frames !== 1 && !MOTION_MULTIFRAME_ALLOWED.has(name)) {
        errors.push(`${label}.${name}: motion 配方要求 frames === 1（帧播放器与运动配方互斥；仅 ${[...MOTION_MULTIFRAME_ALLOWED].join('/')} 定向例外）`)
      }
    }
    // Multi-frame PNG sheets use equally sized square frames in one horizontal row.
    // A 256x256 image with frames:2 is invalid because the player would split one pose.
    if (cfg.frames > 1 && cfg.sheet.toLowerCase().endsWith('.png')) {
      try {
        const size = pngSize(file)
        if (size !== null && size.w !== cfg.frames * size.h) {
          errors.push(`${label}.${name}: frames ${cfg.frames} 要求 PNG 宽度 = ${cfg.frames} × 高度（当前 ${size.w}×${size.h}——单姿势图勿配 frames>1）`)
        }
      } catch {
        // statSync already reported an unreadable file; skip its dimension check.
      }
    }
  }
}

/** Validate the asset manifest and return { ok, errors }. */
export function check(root = ROOT) {
  const errors = []
  const manifestPath = join(root, 'lib', 'assets', 'manifest.json')
  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    return { ok: false, errors: [`assets/manifest.json 无法解析：${error instanceof Error ? error.message : String(error)}`] }
  }
  if (manifest === null || typeof manifest !== 'object') {
    return { ok: false, errors: ['lib/assets/manifest.json 必须是对象'] }
  }
  // Validate characters and any coexisting legacy top-level states; neither format may hide stale data.
  const hasCharacters = manifest.characters !== undefined
  if (hasCharacters) {
    if (manifest.characters === null || typeof manifest.characters !== 'object' || Array.isArray(manifest.characters)) {
      return { ok: false, errors: ['lib/assets/manifest.json 的 characters 必须是对象'] }
    }
    for (const [roleId, ch] of Object.entries(manifest.characters)) {
      if (!ROLE_ID_RE.test(roleId)) {
        errors.push(`characters.${roleId}: 角色 id 只允许 [a-z0-9-]（URL 路径安全）`)
        continue
      }
      if (ch === null || typeof ch !== 'object') {
        errors.push(`characters.${roleId}: 角色定义必须是对象`)
        continue
      }
      if (ch.states === null || typeof ch.states !== 'object' || Array.isArray(ch.states)) {
        errors.push(`characters.${roleId}: 缺 states 对象`)
        continue
      }
      checkStates(ch.states, roleId, errors, root)
    }
    if (manifest.default !== undefined) {
      if (typeof manifest.default !== 'string' || !(manifest.default in manifest.characters)) {
        errors.push(`default "${String(manifest.default)}" 必须指向 characters 中存在的角色`)
      }
    }
    // Validate coexisting legacy states against the flat asset directory too.
    if (manifest.states !== undefined) {
      if (manifest.states === null || typeof manifest.states !== 'object' || Array.isArray(manifest.states)) {
        errors.push('lib/assets/manifest.json 的顶层 states（兼容块）必须是对象')
      } else {
        checkStates(manifest.states, null, errors, root)
      }
    }
  } else {
    if (manifest.states === undefined || typeof manifest.states !== 'object' || Array.isArray(manifest.states)) {
      return { ok: false, errors: ['lib/assets/manifest.json 缺 states 对象（或 characters 角色索引）'] }
    }
    checkStates(manifest.states, null, errors, root)
  }
  return { ok: errors.length === 0, errors }
}

// CLI entry point; imports do not execute it.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { ok, errors } = check()
  for (const e of errors) console.error(`[verify-assets] ${e}`)
  if (!ok) {
    console.error(`[verify-assets] ${errors.length} 处违规`)
    process.exit(1)
  }
  console.log('[verify-assets] OK')
}
