// Canvas renderer handles frame playback, alpha-bound pointer passthrough, bubbles, and badges.
// All data arrives through whaleGirl IPC, without network or CORS access.
// Playback follows each manifest entry's horizontal sheet, frames, fps, playback, and motion.

(() => {
  'use strict'

  const wg = window.whaleGirl
  if (!wg) { console.error('[renderer] 无 whaleGirl bridge（preload 未加载）'); return }

  const canvas = document.getElementById('pet')
  const ctx = canvas.getContext('2d', { willReadFrequently: false })
  const bubble = document.getElementById('bubble')
  const badge = document.getElementById('badge')

  let manifest = null
  let characterId = 'whale-girl'
  const sheetCache = new Map() // `${characterId}/${sheet}` → { img, w, h }
  let animState = 'idle'
  let animCtx = {}
  let frame = 0
  let frameDir = 1
  let lastFrameAt = 0
  let blinkActive = false
  let blinkAt = 0
  let flip = 1
  let facingAt = 0
  let snapshot = null
  let bubbleTimer = null

  // Canvas dimensions follow manifest stageSize; configuration following is a separate desktop enhancement.
  const PET_BASE = 110
  function applySize() {
    const size = PET_BASE
    canvas.width = size
    canvas.height = size
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
  }

  // State configuration.
  function stateCfg(name) {
    return manifest?.characters?.[characterId]?.states?.[name] ?? null
  }
  function sheetKey(sheet) {
    return `${characterId}/${sheet}`
  }
  // Require at least one frame to avoid division by zero in a damaged manifest.
  function framesOf(cfg) {
    const n = cfg?.frames
    return typeof n === 'number' && n > 0 ? Math.floor(n) : 1
  }
  async function ensureSheet(cfg) {
    if (!cfg || !cfg.sheet) return null
    const key = sheetKey(cfg.sheet)
    if (sheetCache.has(key)) return sheetCache.get(key)
    const dataURL = await wg.getSheet(characterId, cfg.sheet)
    if (!dataURL) { sheetCache.set(key, null); return null }
    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = dataURL
    })
    const entry = { img, w: img.naturalWidth, h: img.naturalHeight }
    sheetCache.set(key, entry)
    return entry
  }

  // Frame advancement follows loop/pingpong/once/blink playback modes.
  function tickFrame(now) {
    const cfg = stateCfg(animState)
    if (!cfg || !cfg.sheet) return
    if (!(cfg.frames > 1)) return // Single-frame states remain still in this renderer.

    const step = () => {
      const entry = sheetCache.get(sheetKey(cfg.sheet))
      if (!entry) return // Skip drawing until the sheet is ready.
      const frames = framesOf(cfg)
      const frameW = Math.floor(entry.w / frames)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.scale(flip, 1)
      // Crop using the sprite entry's own dimensions, not canvas dimensions,
      // so canvas resizing cannot push the source rectangle out of bounds.
      ctx.drawImage(
        entry.img,
        frame * frameW, 0, frameW, entry.h,
        -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height,
      )
      ctx.restore()
    }

    if (cfg.playback === 'blink') {
      if (blinkActive) {
        if (now - lastFrameAt >= 1000 / cfg.fps) {
          lastFrameAt = now
          frame += 1
          if (frame >= cfg.frames) { frame = 0; blinkActive = false; blinkAt = now + rand(3000, 9000) }
          step()
        }
      } else {
        if (frame !== 0) { frame = 0; step() }
        if (blinkAt === 0) blinkAt = now + rand(3000, 9000)
        if (now >= blinkAt) blinkActive = true
      }
      return
    }

    if (now - lastFrameAt >= 1000 / (cfg.fps || 2)) {
      lastFrameAt = now
      frame += frameDir
      if (cfg.playback === 'pingpong') {
        if (frame >= cfg.frames - 1 || frame <= 0) frameDir *= -1
        frame = Math.max(0, Math.min(cfg.frames - 1, frame))
      } else if (frame >= cfg.frames) {
        if (cfg.playback === 'loop') frame = 0
        else frame = cfg.frames - 1 // Once playback holds the final frame.
      }
      step()
    } else if (!sheetCache.get(sheetKey(cfg.sheet))?.rendered) {
      step()
    }
  }

  // Occasional facing changes mirror the web client's static-state behavior.
  function tickFacing(now, cfg) {
    if (animState === 'idle' || animState === 'think' || animState === 'wait') {
      if (facingAt === 0) facingAt = now + rand(10000, 25000)
      if (now >= facingAt) {
        flip = -flip
        facingAt = now + rand(10000, 25000)
        // Redraw immediately instead of waiting for the next animation frame.
        const entry = sheetCache.get(sheetKey(cfg.sheet))
        if (entry?.rendered) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.save(); ctx.translate(canvas.width/2, canvas.height/2); ctx.scale(flip, 1)
          const frameW = Math.floor(entry.w / framesOf(cfg))
          ctx.drawImage(entry.img, frame * frameW, 0, frameW, entry.h, -canvas.width/2, -canvas.height/2, canvas.width, canvas.height)
          ctx.restore()
        }
      }
    } else if (facingAt !== 0) {
      facingAt = 0
    }
  }

  function rand(min, max) {
    return min + Math.random() * (max - min)
  }

  // Switch animation state.
  let switchingState = false
  async function switchAnim(next) {
    const name = next?.name || 'idle'
    if (name === animState) {
      animCtx = next?.context ?? animCtx
      // Even when the initial animation is already idle, load and draw its first sheet;
      // an unconditional same-state early return would leave an idle host blank forever.
      const cfg = stateCfg(name)
      if (cfg && !sheetCache.has(sheetKey(cfg.sheet))) {
        await ensureSheet(cfg)
        drawFrame()
        reportHitarea()
      }
      return
    }
    animState = name
    animCtx = next?.context ?? animCtx
    frame = 0
    frameDir = 1
    blinkActive = false
    blinkAt = 0
    lastFrameAt = 0
    if (name === 'walk') {
      // Choose a random walk direction. Artwork faces left, so rightward movement mirrors it.
      walkDir = Math.random() < 0.5 ? 1 : -1
      flip = -walkDir
    }
    applySize()
    const cfg = stateCfg(name)
    if (!cfg) { drawPlaceholder(); return }
    await ensureSheet(cfg)
    drawFrame()
    reportHitarea()
  }

  function drawPlaceholder() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.translate(canvas.width/2, canvas.height/2)
    ctx.font = `${Math.floor(canvas.width * 0.4)}px system-ui`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🐳', 0, 0)
    ctx.restore()
  }

  function drawFrame() {
    const cfg = stateCfg(animState)
    if (!cfg) return drawPlaceholder()
    const entry = sheetCache.get(sheetKey(cfg.sheet))
    if (!entry) return drawPlaceholder()
    const frameW = Math.floor(entry.w / framesOf(cfg))
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.scale(flip, 1)
    ctx.drawImage(entry.img, frame * frameW, 0, frameW, entry.h,
      -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height)
    ctx.restore()
    entry.rendered = true
  }

  // Content bounds enable pet interactions while transparent regions pass pointer events through.
  function reportHitarea() {
    const cfg = stateCfg(animState)
    const entry = sheetCache.get(sheetKey(cfg?.sheet))
    if (!entry) { wg.setHitarea(null); return }
    const frameW = Math.floor(entry.w / framesOf(cfg))
    // Read frame alpha after state or transform changes; small sprite readback is bounded.
    const off = document.createElement('canvas')
    off.width = frameW; off.height = entry.h
    const octx = off.getContext('2d')
    octx.drawImage(entry.img, frame * frameW, 0, frameW, entry.h, 0, 0, frameW, entry.h)
    const data = octx.getImageData(0, 0, frameW, entry.h).data
    let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1
    for (let y = 0; y < entry.h; y++) {
      for (let x = 0; x < frameW; x++) {
        if (data[(y * frameW + x) * 4 + 3] > 24) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX < 0) { wg.setHitarea(null); return }
    // Convert source bounds into scaled canvas coordinates.
    const scaleX = canvas.width / frameW
    const scaleY = canvas.height / entry.h
    wg.setHitarea({
      x: minX * scaleX, y: minY * scaleY,
      w: (maxX - minX + 1) * scaleX, h: (maxY - minY + 1) * scaleY,
    })
  }

  // Render at 60 fps; sprite advancement follows its configured fps.
  // Walking moves the window horizontally at the web client's speed and reverses at screen edges.
  const WALK_SPEED_PX = 45 // Match the web client's CSS-pixel speed; multiply by DPR for physical pixels.
  let walkDir = 0
  let lastWalkStepAt = 0
  function loop(now) {
    const cfg = stateCfg(animState)
    if (cfg) {
      tickFrame(now)
      tickFacing(now, cfg)
    } else if (animState) {
      drawPlaceholder()
    }
    if (animState === 'walk' && walkDir !== 0 && now - lastWalkStepAt >= 50) {
      lastWalkStepAt = now
      const dpr = window.devicePixelRatio || 1
      const dx = Math.round(WALK_SPEED_PX * 0.05 * walkDir * dpr)
      wg.dragWindow(dx, 0).then((hit) => {
        if (hit) { walkDir = -walkDir; flip = -flip } // Reverse at screen edges; the source artwork faces left.
      })
    }
    requestAnimationFrame(loop)
  }

  // Reply bubbles and status labels.
  function showBubble(text) {
    bubble.textContent = text
    bubble.classList.add('show')
    clearTimeout(bubbleTimer)
    bubbleTimer = setTimeout(() => bubble.classList.remove('show'), 2500)
  }
  function renderBadge() {
    if (!snapshot) { badge.classList.remove('show'); return }
    const p = snapshot.pet
    const titles = (p?.titles?.length ?? 0)
    badge.textContent = `Lv.${p?.level ?? 1} · ${p?.stats?.tasksDone ?? 0} 任务` + (titles ? ` · ${titles} 称号` : '')
    if ((snapshot?.activity?.sessionThink ?? false)) badge.textContent += ' · 思考中'
    badge.classList.add('show')
  }

  // Click and drag interactions.
  let dragStart = null
  let dragging = false // Show drag and pause walk displacement while the user drags.
  let lastEngineAnim = null // Cache engine animation during dragging and restore it on release.
  canvas.addEventListener('pointerdown', (e) => {
    dragStart = { x: e.screenX, y: e.screenY, moved: false, px: e.screenX, py: e.screenY }
    canvas.setPointerCapture(e.pointerId)
  })
  canvas.addEventListener('pointermove', (e) => {
    if (!dragStart) return
    const dx = e.screenX - dragStart.x
    const dy = e.screenY - dragStart.y
    if (!dragStart.moved && Math.hypot(dx, dy) > 6) {
      dragStart.moved = true
      dragStart.px = e.screenX
      dragStart.py = e.screenY
      dragging = true
      switchAnim({ name: 'drag', context: {} }) // Drag animation overrides engine state and suspends wandering displacement.
    }
    if (dragStart.moved) {
      // Move the window by pointer delta without a feedback loop, preventing drag jitter.
      const ddx = e.screenX - dragStart.px
      const ddy = e.screenY - dragStart.py
      if (ddx !== 0 || ddy !== 0) {
        // Dragging left preserves left-facing artwork; dragging right mirrors it.
        // Redraw immediately when direction changes and preserve facing across actions.
        const nextFlip = ddx < 0 ? 1 : -1
        if (nextFlip !== flip) {
          flip = nextFlip
          drawFrame()
          reportHitarea()
        }
        wg.dragWindow(ddx, ddy)
        dragStart.px = e.screenX
        dragStart.py = e.screenY
      }
    }
  })
  canvas.addEventListener('pointerup', (e) => {
    if (dragStart && !dragStart.moved) {
      // Clicks alternate feed/play interactions.
      const action = (sessionStorage.getItem('wg:lastAction') === 'feed') ? 'play' : 'feed'
      sessionStorage.setItem('wg:lastAction', action)
      wg.interact(action)
    }
    if (dragging) {
      dragging = false
      // Restore the cached engine animation after dragging, or idle if none exists.
      switchAnim(lastEngineAnim ?? { name: 'idle', context: {} })
    }
    dragStart = null
  })

  // IPC subscriptions.
  wg.onAnim(async (anim) => {
    if (dragging) { lastEngineAnim = anim; return } // During dragging, cache incoming animation intents while continuing to show drag.
    await switchAnim(anim)
  })
  wg.onSnapshot((snap) => {
    snapshot = snap
    renderBadge()
  })
  wg.onReply((reply) => {
    if (reply) showBubble(reply)
  })

  // Startup.
  ;(async () => {
    manifest = await wg.getManifest()
    // Default character.
    if (manifest?.default) characterId = manifest.default
    applySize()
    await switchAnim({ name: 'idle', context: {} })
    requestAnimationFrame(loop)
    renderBadge()
  })()
})()