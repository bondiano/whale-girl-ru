// Pure overlay geometry without DOM access keeps pet menus, hover cards, and reply bubbles inside
// the viewport instead of clipping half of them near edges. Numeric inputs produce inline-style
// strings. Vertically prefer the requested side, flipping when the other has more room; subtract
// offsetY (pet/overlay gap, default 0) and margin because actual height usage is offsetY+size.h.
// Horizontally center on the pet and correct overflow using measured width; an oversized overlay
// centers on the viewport. Apply shifts through calc(50% +/- Npx), not transform, which bubble
// entrance keyframes control. tests/overlay-placement.test.mjs checks signs numerically because
// browser geometry errors are difficult to diagnose.
export function planOverlay({ rect, viewport, size, above, offsetY = 0, margin = 8 }: { rect: { top: number; bottom: number; left: number; width: number }; viewport: { w: number; h: number }; size: { w: number; h: number }; above: boolean; offsetY?: number; margin?: number }) {
  // An upper overlay occupies rect.top-offsetY-size.h through rect.top-offsetY; a lower one
  // occupies rect.bottom+offsetY through rect.bottom+offsetY+size.h. Subtract offsetY from both
  // room calculations. Comparing only size.h misses a narrow band where it appears to fit but
  // actually clips by offsetY-margin (5 px in the reported issue).
  const roomAbove = rect.top - margin - offsetY
  const roomBelow = viewport.h - rect.bottom - margin - offsetY
  // Flip vertically when the requested side lacks room and the other has more; choose the larger
  // side when neither fits.
  let up = above
  if (above && roomAbove < size.h && roomBelow > roomAbove) up = false
  else if (!above && roomBelow < size.h && roomAbove > roomBelow) up = true
  // Horizontal extent is pet center plus/minus half width; shift inside the viewport while
  // retaining margin on both sides.
  const centerX = rect.left + rect.width / 2
  let dx = 0
  if (size.w >= viewport.w - margin * 2) dx = viewport.w / 2 - centerX // Wider than the viewport: center on the viewport.
  else if (centerX - size.w / 2 < margin) dx = margin - centerX + size.w / 2
  else if (centerX + size.w / 2 > viewport.w - margin) dx = viewport.w - margin - centerX - size.w / 2
  const shift = Math.round(dx)
  return {
    up,
    // Expose numeric placement too: the style strings below apply only inside the host (absolute
    // position, left:50%). A fixed chat input on body uses viewport coordinates, so return shift/up
    // and let the caller calculate top/left from getBoundingClientRect.
    shift,
    top: up ? `-${offsetY}px` : `calc(100% + ${offsetY}px)`,
    transform: up ? 'translate(-50%, -100%)' : 'translateX(-50%)',
    left: shift === 0 ? '50%' : `calc(50% ${shift > 0 ? '+' : '-'} ${Math.abs(shift)}px)`,
  }
}
