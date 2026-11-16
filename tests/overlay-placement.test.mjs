// Overlay placement regressions cover vertical flips, horizontal clamping,
// oversized overlays, and selection of the roomier side.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planOverlay } from '../dist/client/overlay-placement.js'

const VW = 1200
const VH = 800
const PET = { width: 110, height: 110 }
/** Create a pet rectangle; b is its distance from the viewport bottom. */
const petAt = (left, top) => ({ ...PET, left, top, bottom: top + PET.height, right: left + PET.width })

const place = (rect, size, above, offsetY = 12) =>
  planOverlay({ rect, viewport: { w: VW, h: VH }, size, above, offsetY })

/** Assert that an overlay centered at centerX with width w remains inside the viewport. */
const assertInside = (left, centerX, w, label) => {
  const m = /calc\(50% ([+-]) (\d+)px\)/.exec(left)
  const dx = m ? (m[1] === '-' ? -1 : 1) * Number(m[2]) : 0
  assert.ok(centerX + dx - w / 2 >= 8 - 1e-9, `${label}: 左边缘越界`)
  assert.ok(centerX + dx + w / 2 <= VW - 8 + 1e-9, `${label}: 右边缘越界`)
}

/**
 * Assert the full vertical span, including offsetY and height, stays within viewport margins.
 * Checking height alone misses overlays clipped by their anchor offset.
 */
const assertVertical = (p, rect, size, offsetY = 12, margin = 8, vh = VH) => {
  const top = p.up ? rect.top - offsetY - size.h : rect.bottom + offsetY
  const bottom = p.up ? rect.top - offsetY : rect.bottom + offsetY + size.h
  assert.ok(top >= margin - 1e-9, `上边缘越界：${top} < ${margin}（up=${p.up}）`)
  assert.ok(bottom <= vh - margin + 1e-9, `下边缘越界：${bottom} > ${vh - margin}（up=${p.up}）`)
}

test('中部位置且空间充足：请求上方 → 在上方，水平不动', () => {
  const rect = petAt(545, 400)
  const size = { w: 200, h: 36 }
  const p = place(rect, size, true)
  assert.equal(p.up, true)
  assert.equal(p.top, '-12px')
  assert.equal(p.transform, 'translate(-50%, -100%)')
  assert.equal(p.left, '50%')
  assertVertical(p, rect, size)
})

test('贴右边缘：向左平移回视口内（菜单被右边界裁掉的主因）', () => {
  const rect = petAt(1074, 674) // Default lower-right anchor: centerX=1129.
  const p = place(rect, { w: 200, h: 36 }, true)
  assert.equal(p.up, true, '上方空间充足，不应翻面')
  assert.equal(p.left, 'calc(50% - 37px)')
  assertInside(p.left, 1129, 200, '贴右')
})

test('贴左边缘：向右平移回视口内', () => {
  const rect = petAt(0, 400) // centerX = 55
  const p = place(rect, { w: 200, h: 36 }, true)
  assert.equal(p.left, 'calc(50% + 53px)')
  assertInside(p.left, 55, 200, '贴左')
})

test('贴底部且请求下方：翻到上方', () => {
  const rect = petAt(545, 674)
  const size = { w: 200, h: 36 }
  const p = place(rect, size, false)
  assert.equal(p.up, true)
  assert.equal(p.top, '-12px')
  assertVertical(p, rect, size)
})

test('贴顶部且请求上方：翻到下方，且动画终点改用 translateX', () => {
  const rect = petAt(545, 0)
  const size = { w: 200, h: 36 }
  const p = place(rect, size, true)
  assert.equal(p.up, false)
  assert.equal(p.top, 'calc(100% + 12px)')
  assert.equal(p.transform, 'translateX(-50%)')
  assertVertical(p, rect, size)
})

test('真机窄带：请求下方时下沿放得下 size.h，但加上 offsetY 就放不下 → 必须翻面', () => {
  // Real clipping regression: viewport 1280x457, pet bottom 393/top 283,
  // card 169x51 and offset 18. Comparing only roomBelow=56 against height=51 clips five pixels.
  const viewport = { w: 1280, h: 457 }
  const rect = { width: 110, height: 110, left: 1154, top: 283, right: 1264, bottom: 393 }
  const size = { w: 169, h: 51 }
  const p = planOverlay({ rect, viewport, size, above: false, offsetY: 18 })
  assert.equal(p.up, true, '下方实际可用 38px < 51px，必须翻到上方')
  assertVertical(p, rect, size, 18, 8, viewport.h)
})

test('请求的朝向放得下时不动（即使另一侧也放得下）', () => {
  assert.equal(place(petAt(545, 400), { w: 100, h: 36 }, true).up, true)
  assert.equal(place(petAt(545, 400), { w: 100, h: 36 }, false).up, false)
})

test('两侧都不足：取更宽裕的一侧（与请求方向无关）', () => {
  const viewport = { w: VW, h: VH }
  const size = { w: 100, h: 1000 } // The overlay is taller than the viewport; neither side fits.
// With the pet near the top, prefer 382 pixels below over 292 above.
  const upper = petAt(545, 300)
  assert.equal(planOverlay({ rect: upper, viewport, size, above: true }).up, false)
  assert.equal(planOverlay({ rect: upper, viewport, size, above: false }).up, false)
  // With the pet at the bottom, prefer 682 pixels above over negative room below.
  const lower = petAt(545, 690)
  assert.equal(planOverlay({ rect: lower, viewport, size, above: false }).up, true)
  assert.equal(planOverlay({ rect: lower, viewport, size, above: true }).up, true)
})

test('浮层比视口还宽：退化为以视口居中', () => {
  const rect = petAt(1074, 674) // centerX = 1129
  const p = place(rect, { w: 1190, h: 36 }, true)
  assert.equal(p.left, 'calc(50% - 529px)')
  assert.equal(1129 - 529, VW / 2)
})

test('尺寸未测到（0×0）：不产生位移，避免误判越界', () => {
  assert.equal(place(petAt(1074, 674), { w: 0, h: 0 }, true).left, '50%')
})

test('自定义 margin 与 offsetY 生效', () => {
  const p = planOverlay({
    rect: petAt(0, 400), viewport: { w: VW, h: VH }, size: { w: 200, h: 36 },
    above: true, offsetY: 20, margin: 24,
  })
  assert.equal(p.top, '-20px')
  assert.equal(p.left, 'calc(50% + 69px)') // 24 - 55 + 100
})

test('высокое облачко у верхней кромки:翻面 вниз, top остаётся относительной строкой', () => {
  const rect = petAt(545, 20) // Only four pixels remain above.
  const size = { w: 200, h: 200 } // The multiline reply does not fit above the pet.
  const p = planOverlay({ rect, viewport: { w: VW, h: VH }, size, above: true, offsetY: 8 })
  assert.equal(p.up, false, 'высокое облачко у верха должно раскрыться вниз')
  assert.equal(p.top, 'calc(100% + 8px)', 'top — относительная строка, не отрицательное число')
  assert.ok(!p.top.startsWith('-'), 'никакого отрицательного top')
  assert.equal(p.transform, 'translateX(-50%)')
  assert.equal(p.left, '50%')
  assertVertical(p, rect, size, 8)
})

test('высокое облачко у верхней кромки и请求 снизу: остаётся снизу', () => {
  const rect = petAt(545, 20)
  const size = { w: 200, h: 200 }
  const p = planOverlay({ rect, viewport: { w: VW, h: VH }, size, above: false, offsetY: 8 })
  assert.equal(p.up, false)
  assert.equal(p.top, 'calc(100% + 8px)')
  assertVertical(p, rect, size, 8)
})
