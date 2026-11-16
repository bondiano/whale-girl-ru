import type { AnimationSet, Character, Manifest, SpeechRecognitionLike } from './types.js'
import type { SettingsValues as importSettingsValues } from './settings-fields.js'
import type { PetState } from '../core/pet-state.js'
// whale-girl browser half: a self-rendered DOM pet overlay inside the GUI (mode A). The official
// bundle exports { name, inject, apply }, registers through __ModuleLoader__.load, and the client
// kernel calls apply(ctx) on mount (see the footer). Pet rendering has no platform-module
// dependencies: CSS, animation, dragging, and menus are implemented locally. Only the package
// settings card depends on platform modules: its plugins.bundle.config slot uses React supplied by
// the platform seed registry; esbuild marks react external (scripts/build-client.mjs). The
// sprite-sheet player reads per-state sheet/frames/fps/playback from assets/manifest.json; sheets
// contain horizontal frames with transparency. Missing or unloaded sheets display placeholders
// instead of emoji. Pure state/expression selection lives in client/logic.mjs; this module owns DOM
// and timing. TRANSIENT_MS resets eat/play even without sheets. Pointer capture starts only after
// the drag threshold, preserving ordinary menu-button clicks.

import { TRANSIENT_MS, WAKE_MS, JOY_MS, ROUND_CELEBRATE_MS, chatBubbleDuration, pickState, nextWorkingRhythm, shouldWake, nextBlinkAt, nextFacingAt, facingFromDrag, wakeFromInteraction, memoryLine, pickPhrase, nextChatterAt, shouldDimForDialogs, voiceErrorMessage } from './logic.js'
import { parseCharacters, getCharacter, stateOf } from './character.js'
// Route endpoints have one source (src/core/routes.ts), enforced by verify-routes-sync; esbuild
// inlines them into the bundle.
import { STATE_PATH, INTERACT_PATH, CONFIG_PATH, ASSETS_PATH, EVENTS_PATH, CHAT_PATH, VOICE_PATH, TRANSCRIBE_PATH } from '../core/routes.js'
// Package configuration card: the keyed plugins.bundle.config slot renders the bundle package's
// settings. This enhancement is optional: registration failures leave the pet running without its
// card (see apply guards).
import { registerWhaleSettingsCard } from './settings-card.js'
import { createMicrophoneCapture, createConversationResume, createSpeechRequest } from './microphone.js'
import { planOverlay } from './overlay-placement.js'
import { bindMenuKeyboard, currentSessionId, SESSION_STATUS_QUESTION } from './menu.js'
import { presentChatReply } from './chat-reply.js'

const ASSETS_URL = ASSETS_PATH
const MANIFEST_URL = `${ASSETS_URL}/manifest.json`
// Client runtime defaults match the Node half's src/core/config.ts DEFAULTS, enforced by
// verify-config-sync. A changed /state configRevision fetches fresh settings through
// applyClientConfig; unconfigured values use defaults.
interface ClientConfig extends importSettingsValues {
 enabled: boolean; sessionMemory: boolean; size: number; opacity: number;
 walk: { enabled: boolean; minWaitMs: number; maxWaitMs: number; minMs: number; maxMs: number; speedPxPerSec: number };
 sleepAfterMs: number; pollMs: number; bubbleMs: number;
 voice: { enabled: boolean; provider: string; rate: number; conversation: boolean; autoSpeakChat: boolean; voice?: string; baseUrl?: string };
 chat: { enabled: boolean; sessionContext: boolean; provider?: string; model?: string }; replies?: Record<string, string[]>;
}
interface Bubble { el: HTMLDivElement; scroll: HTMLDivElement; textEl: HTMLSpanElement; tail: HTMLDivElement; timer: ReturnType<typeof setTimeout> | null }
type Box = { x: number; y: number; w: number; h: number }
const CFG_DEFAULTS: ClientConfig = {
  enabled: true, sessionMemory: false, size: 110, opacity: 1,
  walk: { enabled: true, minWaitMs: 18000, maxWaitMs: 40000, minMs: 3000, maxMs: 6000, speedPxPerSec: 45 },
  sleepAfterMs: 60000, pollMs: 3000, bubbleMs: 15000,
  // Mirrors DEFAULTS (verify-config-sync): the client needs defaults before its first /config
  // response.
  voice: { enabled: false, provider: 'browser', rate: 1, conversation: false, autoSpeakChat: true },
  chat: { enabled: true, sessionContext: true },
}
// Settings namespace equals the card key and Node settings.register namespace; otherwise the card
// never appears. The browser cannot import src/core/config.ts because that imports schemastery.
// Keep this literal synchronized with the Node namespace; the cross-boundary contract is checked in
// the settings UI.
const SETTINGS_NAMESPACE = 'whale-girl'
let cfg: ClientConfig = { ...CFG_DEFAULTS }
// Animation-state checks run every 200 ms. The old 50 ms interval checked 20 times per second and
// wasted CPU in idle tabs. A 200 ms delay is imperceptible for random blinking/turning every 3-25
// s. Frame cadence follows cfg.fps and walking uses rAF, independently of this interval. Hidden
// pages suspend timers (onVisibility).
const TICK_MS = 200
// After releasing a drag, briefly return to idle (1.5 s) before deriving the underlying state.
const DRAG_RELEASE_MS = 1500

const CSS = `
[data-whale-girl] { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000;
  width: var(--pet-size, 110px); height: var(--pet-size, 110px);
  font-family: system-ui, sans-serif; user-select: none; touch-action: none;
  opacity: var(--pet-opacity, 1); }
[data-whale-girl] .pet-stage { position: relative; width: var(--pet-size, 110px); height: var(--pet-size, 110px); display: grid; place-items: center;
  font-size: calc(var(--pet-size, 110px) * 0.4); line-height: 1; text-align: center;
  filter: drop-shadow(0 4px 6px rgba(0,0,0,.25));
  pointer-events: none; /*
   * The visual layer does not intercept input: the content-bounds hit area owns interaction;
   * transparent margins are not clickable.
   */
[data-whale-girl] .pet-effects { position: absolute; left: 0; top: 0; width: var(--pet-size, 110px); height: var(--pet-size, 110px);
  pointer-events: none; overflow: visible; z-index: 2; }
[data-whale-girl] .pet-hitarea { position: absolute; inset: 0; width: var(--pet-size, 110px); height: var(--pet-size, 110px);
  cursor: grab; touch-action: none; z-index: 3; border-radius: 8px; }
[data-whale-girl] .pet-sprite { pointer-events: none; /*
 * Visual positioning, sizing, and transforms are inline JS styles because the host may override
 * injected CSS.
 */ }
[data-whale-girl] .pet-sprite.ready { display: block; }
/*
 * The status card sits below the pet with clearance for its +/-4 px bob, and flips above near the
 * bottom edge.
 */
[data-whale-girl] .pet-status { position: absolute; left: 50%; top: calc(100% + 18px); transform: translateX(-50%);
  width: max-content; min-width: 96px; max-width: calc(100vw - 24px); padding: 5px 8px;
  background: rgba(27,30,40,.94); backdrop-filter: blur(10px) saturate(1.15);
  border: 1px solid rgba(255,255,255,.10); border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0,0,0,.38), 0 3px 8px rgba(0,0,0,.28);
  color: #E8EBF2; font-size: 11px; display: grid; gap: 4px; z-index: 1;
  opacity: 0; visibility: hidden; pointer-events: none;
  transition: opacity .15s ease-out, transform .15s ease-out, visibility 0s linear .2s; }
[data-whale-girl] .pet-status::after { /* The tail bridges the pet/card gap so hover remains continuous without flicker. */
  content: ''; position: absolute; left: 50%; top: -5px; width: 10px; height: 10px;
  transform: translateX(-50%) rotate(45deg); background: rgba(27,30,40,.94);
  border-top: 1px solid rgba(255,255,255,.10); border-left: 1px solid rgba(255,255,255,.10);
  border-top-left-radius: 3px; pointer-events: auto; }
[data-whale-girl]:hover .pet-status,
[data-whale-girl]:focus-within .pet-status {
  opacity: 1; visibility: visible; pointer-events: auto;
  transform: translateX(-50%) translateY(0);
  transition: opacity .2s cubic-bezier(.16,1,.3,1), transform .2s cubic-bezier(.16,1,.3,1), visibility 0s;
  transition-delay: .06s; }
[data-whale-girl] .pet-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
[data-whale-girl] .pet-lv { background: rgba(86,134,254,.16); color: #B7C8FE; border-radius: 5px;
  padding: 2px 6px; font-size: 10px; font-weight: 600; line-height: 16px; white-space: nowrap; }
[data-whale-girl] .pet-stats { color: #E8EBF2; font-size: 11px; line-height: 16px;
  font-variant-numeric: tabular-nums; white-space: nowrap; }
[data-whale-girl] .pet-note { color: #E8EBF2; font-size: 11px; line-height: 15px;
  text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
[data-whale-girl] .pet-status::after { /* The tail bridges the pet/card gap for continuous hover; main positioning is inline JS. */
  content: ''; position: absolute; left: 50%; bottom: -5px; width: 10px; height: 10px;
  transform: translateX(-50%) rotate(45deg); background: rgba(24,28,38,.94);
  border-top: 1px solid rgba(255,255,255,.10); border-left: 1px solid rgba(255,255,255,.10);
  border-top-left-radius: 3px; pointer-events: auto; }
[data-whale-girl] .pet-status.pet-status-above::after { top: auto; bottom: auto; top: -5px; } /* At the bottom edge the card flips above; its tail points down toward the pet. */
[data-whale-girl] .pet-menu { display: none; position: absolute; left: 50%; top: -12px; transform: translate(-50%, -100%);
  width: max-content; gap: 6px; padding: 6px; border-radius: 8px;
  background: rgba(20,20,28,.72); }
[data-whale-girl] .pet-bubble { position: absolute; left: 50%; top: calc(100% + 12px); transform: translateX(-50%);
  background: rgba(24,28,38,.94); color: #E8EBF2; font-size: 11px; padding: 8px 10px; border-radius: 10px;
  max-width: min(280px, calc(100vw - 16px)); text-align: left; pointer-events: none;
  animation: whale-girl-pop .25s ease-out; z-index: 3; }
[data-whale-girl] .pet-menu.open { display: flex; }
[data-whale-girl] .pet-menu button { flex: 1; border: 0; border-radius: 6px; padding: 4px 8px;
  font-size: 11px; cursor: pointer; background: rgba(255,255,255,.14); color: #E8EBF2; }
[data-whale-girl] .pet-menu button:hover { background: rgba(255,255,255,.28); }
[data-whale-girl] .pet-menu button:focus-visible, [data-whale-girl] .pet-stage:focus-visible { outline: 2px solid #B7C8FE; outline-offset: 2px; }
[data-whale-girl-chat] :focus-visible { outline: 2px solid #B7C8FE !important; outline-offset: 2px; }
[data-whale-girl] .pet-heart { position: absolute; font-size: 20px; pointer-events: none;
  animation: whale-girl-float 1.8s ease-out forwards; }
/*
 * State motion recipes map manifest.motion to stage CSS classes: multi-frame sheets use the frame
 * player, single-frame sheets use these animations. Animate the stage, which has no inline
 * transform, to avoid conflicting with sprite scaling. Restrained amplitudes (+/-2-6 px/degrees)
 * and quarter-step keyframes create smooth oscillation.
 */
[data-whale-girl] .pet-stage.pet-motion-bob { animation: whale-girl-m-bob 2.4s ease-in-out infinite; }
[data-whale-girl] .pet-stage.pet-motion-wiggle { animation: whale-girl-m-wiggle .9s ease-in-out infinite; }
[data-whale-girl] .pet-stage.pet-motion-squash { animation: whale-girl-m-squash .7s ease-in-out infinite; }
[data-whale-girl] .pet-stage.pet-motion-shake { animation: whale-girl-m-shake .3s linear infinite; }
[data-whale-girl] .pet-stage.pet-motion-sigh { animation: whale-girl-m-sigh 1.6s ease-in-out infinite; }
[data-whale-girl] .pet-stage.pet-motion-hop { animation: whale-girl-m-hop .6s ease-in-out infinite; }
[data-whale-girl] .pet-stage.pet-motion-tilt { animation: whale-girl-m-tilt 1.2s ease-in-out infinite; }
[data-whale-girl] .pet-stage.pet-motion-float { animation: whale-girl-m-float 3.2s ease-in-out infinite; }
[data-whale-girl] .pet-stage.pet-motion-wave { animation: whale-girl-m-wave 1s ease-in-out infinite; }
@keyframes whale-girl-m-bob { 0%,100% { transform: translateY(0); } 30% { transform: translateY(-3px); } 60% { transform: translateY(-4px); } }
@keyframes whale-girl-m-wiggle { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-2deg); } 75% { transform: rotate(2deg); } }
@keyframes whale-girl-m-squash { 0%,100% { transform: scale(1,1); } 25% { transform: scale(1.06,.94); } 50% { transform: scale(.96,1.04); } 75% { transform: scale(1.03,.97); } }
@keyframes whale-girl-m-shake { 0%,100% { transform: translateX(0); } 30% { transform: translateX(-2px); } 60% { transform: translateX(2px); } 80% { transform: translateX(-1px); } }
@keyframes whale-girl-m-sigh { 0%,100% { transform: translateY(0) scale(1,1); } 40% { transform: translateY(1.5px) scale(1,.98); } }
@keyframes whale-girl-m-hop { 0%,100% { transform: translateY(0); } 40% { transform: translateY(-6px); } 70% { transform: translateY(0); } }
@keyframes whale-girl-m-tilt { 0%,100% { transform: rotate(0); } 30% { transform: rotate(-4deg); } 70% { transform: rotate(4deg); } }
@keyframes whale-girl-m-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes whale-girl-m-wave { 0%,100% { transform: rotate(0); } 20% { transform: rotate(-6deg); } 40% { transform: rotate(6deg); } 60% { transform: rotate(-4deg); } 80% { transform: rotate(4deg); } }
@keyframes whale-girl-float { 0% { opacity: 1; transform: translateY(0) scale(.7); }
  70% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-72px) scale(1.25); } }
@keyframes whale-girl-pop { from { opacity: 0; transform: translateX(-50%) translateY(4px); } }
[data-whale-girl][data-whale-girl-inert] { opacity: .6; pointer-events: none; }
[data-whale-girl] .pet-stage.pet-speaking { animation: whale-girl-m-speak .55s ease-in-out infinite; }
@keyframes whale-girl-m-speak { 0%,100% { transform: translateY(0); } 45% { transform: translateY(-2px); } 70% { transform: translateY(0); } }
[data-whale-girl] .pet-typing { display: inline-flex; align-items: center; gap: 3px; height: 12px; }
[data-whale-girl] .pet-typing i { width: 4px; height: 4px; border-radius: 50%; background: #9FB4FF; animation: whale-girl-typing 1s ease-in-out infinite; }
[data-whale-girl] .pet-typing i:nth-child(2) { animation-delay: .15s; }
[data-whale-girl] .pet-typing i:nth-child(3) { animation-delay: .3s; }
@keyframes whale-girl-typing { 0%,80%,100% { opacity: .25; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-2px); } }
[data-whale-girl][data-whale-girl-hidden] { display: none; }
[data-whale-girl] .pet-stage:focus-visible { outline: 2px solid rgba(255,255,255,.6); outline-offset: 2px; border-radius: 8px; }
@media (prefers-reduced-motion: reduce) {
  [data-whale-girl] .pet-stage { animation: none !important; }
  [data-whale-girl] .pet-typing i { animation: none; opacity: .7; }
  [data-whale-girl] .pet-sprite { animation: none !important; }
  [data-whale-girl] .pet-heart { animation: none; opacity: 0; }
  [data-whale-girl] .pet-bubble { animation: none; }
  [data-whale-girl] .pet-status { transition: none !important; }
}
`

export function apply(ctx: import('./client-host.js').ClientContext) {
  // Idempotency guard: repeated bundle execution during development, HMR, or loader retries must
  // not duplicate the pet or stylesheet.
  if (document.querySelector('[data-whale-girl]') !== null) {
    console.warn('[whale-girl] apply: экземпляр уже существует, повторное монтирование пропущено')
    return () => {}
  }
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)

  // The package settings card is optional. slots/locale/configForms must be declared in inject
  // before use (see footer). Registration errors leave the pet running without the card.
  let offSettings: (() => void) | null = null
  try {
    if (ctx.configForms && ctx.slots) {
      offSettings = registerWhaleSettingsCard(ctx, SETTINGS_NAMESPACE, CFG_DEFAULTS)
    }
  } catch (error) {
    console.warn('[whale-girl] не удалось зарегистрировать карточку настроек (питомец работает как обычно):', error)
    offSettings = null
  }

  // Shared panels (v6): status, bubbles, and menu are pet-relative overlays sharing background,
  // radii, typography, padding, and shadow. Anchors and interactions differ. Critical styles stay
  // inline because the host may override/remove injected CSS (see hitarea/menu decisions). Theme
  // values are centralized so one change applies consistently.
  const PANEL_THEME = {
    bg: 'rgba(24, 28, 38, .94)',      // Shared panel background for status, bubbles, and menu.
    border: 'rgba(255,255,255,.10)',  // Border color for solid panels.
    text: '#E8EBF2',                  // Primary text color.
    radius: '10px',                   // Shared corner radius.
    font: '11px',                     // Shared base font size.
    shadow: '0 12px 32px rgba(0,0,0,.38), 0 3px 8px rgba(0,0,0,.28)', // Overlay shadow.
  }
  /**
   * Create the overlay panel shared by status, bubbles, and menu. opts.anchor selects below
   * (status) or above (bubble/menu). opts.variant selects solid (border/shadow) or plain
   * (background only). opts.offsetY is the pet-to-panel gap; opts.zIndex controls stacking and
   * opts.display the initial display value. Returns { el, show, hide }.
   */
  const createPanel = ({ anchor = 'below', variant = 'plain', offsetY = 12, zIndex = '3', display = 'block' } = {}) => {
    const el = document.createElement('div')
    const pos = anchor === 'above'
      ? `top: -${offsetY}px; transform: translate(-50%, -100%);`
      : `top: calc(100% + ${offsetY}px); transform: translateX(-50%);`
    const surface = variant === 'solid'
      ? `background: ${PANEL_THEME.bg}; border: 1px solid ${PANEL_THEME.border}; box-shadow: ${PANEL_THEME.shadow};`
      : `background: ${PANEL_THEME.bg};`
    // Critical styles stay inline: if the host removes injected positioning, the panel enters
    // document flow and displaces the pet.
    el.style.cssText = [
      'position: absolute; left: 50%;', pos,
      'width: max-content;', surface,
      `color: ${PANEL_THEME.text}; font-size: ${PANEL_THEME.font};`,
      `border-radius: ${PANEL_THEME.radius}; z-index: ${zIndex};`,
      `display: ${display}; pointer-events: none;`,
    ].join(' ')
    return {
      el,
      show() { el.style.display = display },
      hide() { el.style.display = 'none' },
    }
  }

  const host = document.createElement('div')
  host.setAttribute('data-whale-girl', '')
  host.setAttribute('role', 'group')
  host.setAttribute('aria-label', 'Домашний питомец')
  host.setAttribute('aria-expanded', 'false')
  // Critical host styles stay inline. Losing position when the host removes injected CSS makes the
  // pet invisible/out of place; see the hitarea/menu/effects environment findings. Host positioning
  // was the last remaining injected-CSS dependency.
  host.style.cssText = `position: fixed; right: 16px; bottom: 16px; z-index: 2147483000;
    width: var(--pet-size, 110px); height: var(--pet-size, 110px);
    font-family: system-ui, sans-serif; user-select: none; touch-action: none;
    opacity: var(--pet-opacity, 1);`
  // Mount hidden until boot reads enabled, avoiding a flash before applying visibility settings.
  host.style.display = 'none'
  document.body.appendChild(host)

  const stage = document.createElement('div')
  stage.className = 'pet-stage'
  stage.setAttribute('role', 'button')
  stage.setAttribute('tabindex', '0')
  stage.setAttribute('aria-label', 'Меню действий: Enter или пробел')
  const sprite = document.createElement('div')
  sprite.className = 'pet-sprite'
  stage.appendChild(sprite)

  // Status card: solid panel with border, shadow, and blur; displayed on hover with child elements
  // and edge-aware classes.
  const status = createPanel({ anchor: 'below', variant: 'solid', offsetY: 18, zIndex: '1' }).el
  status.className = 'pet-status'
  status.style.backdropFilter = 'blur(10px) saturate(1.15)'
  status.style.padding = '5px 8px'
  status.style.minWidth = '96px'
  status.style.maxWidth = 'calc(100vw - 24px)'
  status.style.display = 'grid'
  status.style.gap = '4px'
  status.style.opacity = '0'
  status.style.visibility = 'hidden'
  status.style.pointerEvents = 'none'
  status.style.transition = 'opacity .15s ease-out, visibility 0s linear .2s'
  status.innerHTML = `
    <div class="pet-meta" style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
      <span class="pet-lv" style="background:rgba(86,134,254,.16); color:#B7C8FE; border-radius:5px; padding:2px 6px; font-size:10px; font-weight:600; line-height:16px; white-space:nowrap;">Lv.1</span>
      <span class="pet-stats" style="color:#E8EBF2; font-size:11px; line-height:16px; font-variant-numeric:tabular-nums; white-space:nowrap;">Задач: 0</span>
    </div>
    <div class="pet-note" style="color:#E8EBF2; font-size:11px; line-height:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;">…</div>`
  const metaLv = status.querySelector<HTMLElement>('.pet-lv')!
  const metaStats = status.querySelector<HTMLElement>('.pet-stats')!
  const metaNote = status.querySelector<HTMLElement>('.pet-note')!
  // Keep badge styles inline so host CSS cannot remove its background/separation.
  metaLv.style.cssText = 'background:rgba(86,134,254,.16); color:#B7C8FE; border-radius:5px; padding:2px 6px; font-size:10px; font-weight:600; line-height:16px; white-space:nowrap;'
  metaStats.style.cssText = 'color:#E8EBF2; font-size:11px; line-height:16px; font-variant-numeric:tabular-nums; white-space:nowrap;'
  metaNote.style.cssText = 'color:#E8EBF2; font-size:11px; line-height:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;'

  // Menu: plain-background panel with button children; toggle controls visibility. Anchor above the
  // pet because the default bottom-right position would clip a downward menu and is closer to the
  // pointer above.
  const menu = createPanel({ anchor: 'above', variant: 'plain', offsetY: 12, zIndex: '4', display: 'none' }).el
  menu.className = 'pet-menu'
  menu.id = 'whale-girl-actions'
  menu.setAttribute('role', 'menu')
  menu.setAttribute('aria-label', 'Действия питомца')
  stage.setAttribute('aria-haspopup', 'menu')
  stage.setAttribute('aria-controls', menu.id)
  stage.setAttribute('aria-expanded', 'false')
  menu.style.flexDirection = 'column'
  menu.style.width = '220px'
  menu.style.maxWidth = 'calc(100vw - 16px)'
  menu.style.boxSizing = 'border-box'
  menu.style.overflowY = 'auto'
  menu.style.touchAction = 'pan-y'
  menu.style.gap = '2px'
  menu.style.padding = '6px'
  menu.style.display = 'none' // Initially hidden; toggleMenu switches inline display.
  menu.style.pointerEvents = 'auto' // Buttons must receive pointer input, overriding the panel's default pointer-events:none.
  const BTN_STYLE = 'flex:none; min-height:40px; text-align:left; border:0; border-radius:6px; padding:8px 10px; font-size:13px; cursor:pointer; background:rgba(255,255,255,.14); color:#E8EBF2; font-family:system-ui,sans-serif;'
  const feedBtn = document.createElement('button')
  feedBtn.textContent = '🍗 Покормить'
  feedBtn.style.cssText = BTN_STYLE
  const playBtn = document.createElement('button')
  playBtn.textContent = '🎾 Поиграть'
  playBtn.style.cssText = BTN_STYLE
  const chatBtn = document.createElement('button')
  chatBtn.textContent = '💬 Поговорить'
  chatBtn.style.cssText = BTN_STYLE
  const newsBtn = document.createElement('button')
  newsBtn.textContent = '📰 Новости'
  newsBtn.style.cssText = BTN_STYLE
  const settingsBtn = document.createElement('button')
  settingsBtn.textContent = '⚙️ Настройки'
  settingsBtn.style.cssText = BTN_STYLE
  const statusBtn = document.createElement('button')
  statusBtn.textContent = '🐳 Как дела?'
  statusBtn.style.cssText = BTN_STYLE
  const menuGroup = (label: string, buttons: HTMLButtonElement[]) => {
    const group = document.createElement('div')
    group.setAttribute('role', 'group')
    group.setAttribute('aria-label', label)
    group.style.cssText = 'display:flex; flex-direction:column; gap:2px;'
    for (const button of buttons) {
      button.type = 'button'
      button.tabIndex = -1
      if (!button.hasAttribute('role')) button.setAttribute('role', 'menuitem')
      button.addEventListener('focus', () => { button.style.outline = '2px solid #B7C8FE'; button.style.outlineOffset = '-2px' })
      button.addEventListener('blur', () => { button.style.outline = '' })
      group.appendChild(button)
    }
    return group
  }
  const separator = () => {
    const element = document.createElement('div')
    element.setAttribute('role', 'separator')
    element.style.cssText = 'height:1px; flex:none; margin:4px 6px; background:rgba(255,255,255,.14);'
    return element
  }
  menu.append(menuGroup('Питомец', [statusBtn, feedBtn, playBtn]), separator(),
    menuGroup('Беседа', [chatBtn, newsBtn]), separator(),
    menuGroup('Настройки', [settingsBtn]))

  // Separate effects layer for hearts/bubbles, above the stage. Replacing stage children/text does
  // not remove active effects.
  const effects = document.createElement('div')
  effects.className = 'pet-effects'
  // Critical effects styles stay inline. If injected CSS is removed, static positioning puts
  // effects into document flow and pushes the sprite down.
  effects.style.cssText = 'position: absolute; left: 0; top: 0; width: var(--pet-size, 110px); height: var(--pet-size, 110px); pointer-events: none; overflow: visible; z-index: 2;'
  // Content-bounds hit area owns pointer events instead of the stage. Interaction follows the
  // actual silhouette, leaving surrounding transparent pixels unclickable.
  const hitarea = document.createElement('div')
  hitarea.className = 'pet-hitarea'
  // Keep hit-area styles inline; position/size are updated by applyHitArea. If host CSS removal
  // makes it static, the pet loses its interactive region.
  hitarea.style.cssText = `position: absolute; inset: 0; cursor: grab; touch-action: none; z-index: 3; border-radius: 8px;`
  // The status card belongs to effects, which shares the stage's size and origin (0,0,110,110).
  // top:calc(100% + 18px) therefore places it 18 px below the pet without overlap.
  effects.appendChild(status)
  host.append(effects, stage, hitarea, menu)

  // Viewport-aware status layout runs when hover reveals the card. It is anchored below the pet and
  // edge-aligned near either viewport side. An active bubble or drag hides it to prioritize
  // speech/movement. Visibility uses inline styles, independently of host-modifiable :hover CSS.
  const setStatusVisible = (visible: boolean) => {
    status.style.display = visible ? 'grid' : 'none'
    status.style.opacity = visible ? '1' : '0'
    status.style.visibility = visible ? 'visible' : 'hidden'
    status.style.pointerEvents = visible ? 'auto' : 'none'
    status.style.transition = visible ? 'opacity .2s cubic-bezier(.16,1,.3,1)' : 'none'
  }
  // Shared overlay placement anchors menu/status/bubbles to the pet and keeps them inside the
  // viewport. Vertically, prefer the requested side; flip when it lacks room and the other side has
  // more. Horizontally, the pet-centered left:50%/translateX(-50%) placement is corrected using
  // measured width near viewport edges. Apply the correction to left, because bubble entrance
  // keyframes overwrite transform. Pure geometry lives in src/client/overlay-placement.ts and
  // tests/overlay-placement.test.mjs. Inline styles are authoritative because the host may remove
  // injected CSS. Returns the actual side: true means above.
  const placeOverlay = (el: HTMLElement, { above, offsetY }: { above: boolean; offsetY: number }) => {
    const plan = planOverlay({
      rect: host.getBoundingClientRect(),
      viewport: { w: window.innerWidth, h: window.innerHeight },
      size: { w: el.offsetWidth || 0, h: el.offsetHeight || 0 },
      above,
      offsetY,
    })
    el.style.top = plan.top
    el.style.bottom = 'auto'
    el.style.right = 'auto'
    el.style.transform = plan.transform
    el.style.left = plan.left
    return plan.up
  }

  const layoutStatus = () => {
    if (activeBubble !== null || dragging || menu.classList.contains('open')) {
      setStatusVisible(false) // Hide the status card during bubbles, dragging, or an open menu using authoritative inline
      // styles.
      return
    }
    setStatusVisible(host.matches(':hover') || host.contains(document.activeElement))
    if (status.style.display === 'none') return
    // Prefer below; placeOverlay flips above at the bottom and shifts horizontally near side edges.
    // The pet-status-above class controls the tail direction.
    const above = placeOverlay(status, { above: false, offsetY: 18 })
    status.classList.toggle('pet-status-above', above)
  }
  const onHostEnter = () => {
    layoutStatus()
  }
  const onHostLeave = () => {
    if (menu.classList.contains('open')) return
    setStatusVisible(false)
  }
  host.addEventListener('mouseenter', onHostEnter)
  host.addEventListener('mouseleave', onHostLeave)
  // A speech bubble takes priority over the status card; relayout immediately after showReply.
  const onBubbleShown = () => {
    layoutStatus()
  }

  // Place the menu above the default bottom-right pet so it stays visible and near the pointer.
  // placeOverlay flips or shifts it near viewport edges when needed.
  const layoutMenu = () => {
    const rect = host.getBoundingClientRect()
    const room = Math.max(rect.top, window.innerHeight - rect.bottom) - 28
    menu.style.maxHeight = `${Math.max(48, room)}px`
    placeOverlay(menu, { above: true, offsetY: 12 })
  }

  // Toggle the menu and synchronize aria-expanded; omit open to invert its state.
  const toggleMenu = (open?: boolean, { focus = false, restoreFocus = false }: { focus?: boolean; restoreFocus?: boolean } = {}) => {
    const next = open ?? !menu.classList.contains('open')
    menu.classList.toggle('open', next)
    // Inline display is authoritative: host CSS may be removed, and inline display:none outranks
    // the pet-menu.open class. Set display explicitly instead of relying only on the class.
    menu.style.display = next ? 'flex' : 'none'
    if (next) {
      layoutMenu() // Measure after showing: display:none has zero offsetHeight.
      setStatusVisible(false)
      releaseInteraction() // Opening the menu signals user presence: reset idle time and wake a sleeping pet; do not
      // sleep while the menu is open.
    }
    host.setAttribute('aria-expanded', String(next))
    stage.setAttribute('aria-expanded', String(next))
    if (next && focus) {
      const first = [...menu.querySelectorAll('button')].find((item) => !item.disabled && item.style.display !== 'none')
      first?.focus()
    } else if (!next && restoreFocus) stage.focus()
    return next
  }

  const offMenuKeyboard = bindMenuKeyboard(menu, (restoreFocus) => toggleMenu(false, { restoreFocus }))

  // Runtime state.
  let pet: PetState | null = null
  let activity = { name: 'idle', until: 0 }
  let manifest: Manifest = { states: {} }
  // Character context: manifest index to selected character (whale-girl by default). Character IDs
  // determine assets/characters/<id>/ paths and namespace cache keys to avoid stale sprites after
  // switching.
  let character: Character = { id: 'whale-girl', states: {} }
  let characterId = 'whale-girl'
  const loaded = new Set() // Successfully loaded `${id}:${sheet}` keys.
  const sheetSize = new Map<string, { w: number; h: number }>() // The same keys map to natural image dimensions { w, h }.
  let dragging = false
  let pressed = false
  let moved = false
  let transient: string | null = null // 'eat' | 'play' | 'wake' | null: one-shot interaction/waking state.
  let transientUntil = 0 // Timeout safety: reset even if a sheet is missing or playback is incomplete.
  let joyUntil = 0 // Brief post-interaction joy (JOY_MS).
  let dragReleaseUntil = 0 // Drag-release buffer: idle for 1.5 s, then derive the underlying state. Capture whether the pet
  // visibly showed sleep at pointerdown/keydown. Wake detection follows the visual state rather
  // than derived sleeping: an active session can display think/working while sleeping remains true,
  // and that interaction must not replay wake (logic.mjs wakeFromInteraction).
  let interactFromSleep = false
  let showingSprite = false // Whether animState currently renders a sprite; late assets can replace its placeholder.
  let idleSince = 0 // Time of entering idle; sustained-idle sleep timing starts here.
  let sleeping = false
  let animState: string | null = null
  let frame = 0
  let frameDirection = 1
  // Random idle blinking (v4): normally hold open-eyed frame 0, then play 0->1->2->0 at random
  // intervals. nextBlinkAt chooses the trigger; blinkActive tracks playback until frame 0 is held
  // again.
  let blinkAt = 0
  let blinkActive = false
  // Occasional turns during idle/think/wait use nextFacingAt. Walk/drag update flip, preserving
  // direction across actions; a static-state trigger toggles it and refreshes the sprite.
  let facingAt = 0
  let lastFrameAt = 0
  // Random working interludes (v3): usually think, occasionally working. nextWorkingRhythm decides
  // timing; this host executes scheduled flips. workingActive feeds pickState, and workingTimer
  // schedules the transition.
  let working = { active: false, until: 0 }
  let workingTimer: ReturnType<typeof setTimeout> | null = null
  // Client turn-completion window: play celebrate for ROUND_CELEBRATE_MS after session completion
  // changes.
  let celebrateUntil = 0
  // Walking: periodic strolls along the viewport bottom.
  let walking = false
  let walkDir = 1
  let flip = 1 // Horizontal sprite scaleX: assets face left by default; 1 faces left, -1 mirrors right.
  let wanderTimer: ReturnType<typeof setTimeout> | null = null
  let walkRaf: number | null = null
  // Session-awareness signals (P2 thinking state) derived from the host sessions snapshot.
  let sessionMood = { thinking: false, waiting: false, titles: [] }
  // Chat/voice/chatter: the input is a separate fixed layer and replies are bubbles in effects.
  // Chat uses Node /chat; voice uses model /voice or SpeechSynthesis/SpeechRecognition.
  let chatEl: HTMLFormElement | null = null
  let chatInput: HTMLInputElement | null = null
  let chatOpen = false
  let chatGeneration = 0
  let chatPending = false
  const composerVisible = () => chatOpen && chatEl !== null && chatEl.style.display !== 'none'
  let chatMic: HTMLButtonElement | null = null
  let listening = false
  let conversationMode = false
  let recording = false
  let recognition: SpeechRecognitionLike | null = null
  let revealToken = 0
  let currentAudio: HTMLAudioElement | null = null
  let speechPending = false
  let chatterAt = 0
  let lastChatterPhrase: string | null = null
  let lastActivityName: string | null = null
  let lastLevel = 0

  // Rendering.
  const renderStatus = () => {
    if (pet) {
      metaLv.textContent = `Lv.${pet.level}`
      // Inline flex gap separates the badge and counters even when host styles override defaults.
      metaStats.textContent = pet.stats.failures > 0
        ? `Задач: ${pet.stats.tasksDone} · провалов: ${pet.stats.failures}`
        : `Задач: ${pet.stats.tasksDone}`
      const last = pet.memory[pet.memory.length - 1]
      metaNote.textContent = last ?? (pet.titles.length > 0 ? `Звание «${pet.titles.join('», «')}»` : '…')
      // Text changes affect measured width. Re-clamp a visible hover card after task/title updates
      // or third-party status overrides; reusing its previous horizontal shift can overflow the
      // edges.
      if (status.style.visibility === 'visible') layoutStatus()
    }
  }

  // Missing-asset placeholder (v5): verify-assets requires sheets for all 15 states before
  // distribution, so no emoji fallback is needed. Only runtime load failures/delays reach this
  // transparent placeholder with a diagnostic console warning.
  const showPlaceholder = (name: string) => {
    sprite.classList.remove('ready')
    stage.replaceChildren(sprite)
    console.warn(`[whale-girl] для состояния ${name} нет доступного sheet (manifest должен содержать все 15 состояний; если объявлено — не загрузились ресурсы)`)
  }

  // Cache keys include the character ID so switching cannot display another character's sheet.
  const sheetKey = (sheet: string) => `${characterId}:${sheet}`
  // Sheet URLs use assets/characters/<id>/. parseCharacters filters IDs through ROLE_ID_RE, and the
  // assets route separately sanitizes paths.
  const sheetUrl = (sheet: string) => `${ASSETS_URL}/characters/${characterId}/${sheet}`

  // Name the animation parameter anim to avoid shadowing module-level cfg. Using an undefined
  // animation cfg.size previously made scale NaN, causing browsers to discard the transform,
  // enlarge the sprite, and lose mirroring.
  const showSprite = (name: string, anim: AnimationSet) => {
    const key = sheetKey(anim.sheet)
    const size = sheetSize.get(key)
    if (!size || size.w <= 0 || size.h <= 0) {
      showPlaceholder(name) // Unknown dimensions mean loading failed or is unfinished: show a placeholder rather than
      // divide by zero.
      return
    }
    // Clear the previous placeholder/sprite so eat/play cannot remain after their state ends.
    stage.replaceChildren(sprite)
    const frameW = size.w / anim.frames
    // Use the host's real box after --pet-size/config.size, not an absent animation size field.
    // Configured size is applied through CSS variables, outside manifest state entries.
    const target = host.offsetWidth || 110
    const scale = Math.min(target / frameW, target / size.h, 1)
    sprite.className = 'pet-sprite ready'
    sprite.style.cssText = `
      position: absolute; left: 50%; top: 50%; display: block;
      background-image: url("${sheetUrl(anim.sheet)}");
      background-size: ${size.w}px ${size.h}px;
      width: ${frameW}px; height: ${size.h}px;
      transform: translate(-50%, -50%) scale(${scale}) scaleX(${flip});
    `
    // Center through inline absolute positioning, not host-modifiable grid place-items.
    // translate(-50%,-50%) uses the sprite's center and aligns exactly with the content-bounds hit
    // area (box.x/box.y).
    applyFrame(frameW, frame)
  }

  const applyFrame = (frameW: number, idx: number) => {
    sprite.style.backgroundPosition = `-${frameW * idx}px 0`
  }

  // Static random turning updates only the current sprite's scaleX transform, preserving
  // frames/background. nextFacingAt uses this path; walk/drag already refresh their own flips.
  const applyFacing = () => {
    if (!showingSprite) return
    const cfg = stateOf(character, animState)
    if (!cfg || !loaded.has(sheetKey(cfg.sheet))) return
    const size = sheetSize.get(sheetKey(cfg.sheet))
    if (!size || size.w <= 0 || size.h <= 0) return
    const frameW = size.w / cfg.frames
    const target = host.offsetWidth || 110
    const scale = Math.min(target / frameW, target / size.h, 1)
    sprite.style.transform = `translate(-50%, -50%) scale(${scale}) scaleX(${flip})`
    applyHitArea() // Mirror the hit area when flip changes so it stays aligned with the character.
  }

  const setState = (name: string) => {
    if (name === animState) return
    animState = name
    frame = 0
    frameDirection = 1
    blinkAt = 0 // Reschedule random blinking when re-entering a blink state.
    blinkActive = false
    facingAt = 0 // Reschedule random turning when re-entering a static state. Record when frame 0 is applied
    // rather than zero: otherwise now-0>=1000/fps immediately advances to frame 1 in the same tick.
    // Two-frame once wake animations would never show their first frame. Hold frame 0 for a full
    // frame interval before advancing (issue #12).
    lastFrameAt = Date.now()
    applyHitArea() // Update the hit area for each state's individual content bounds. manifest.motion selects stage
    // classes for both sprite and placeholder paths; clear them when absent. Iterate a snapshot
    // before removing classes: mutating a live DOMTokenList can skip entries.
    const motionClasses = [...stage.classList].filter((cls) => cls.startsWith('pet-motion-'))
    for (const cls of motionClasses) stage.classList.remove(cls)
    const cfg = stateOf(character, name)
    const motion = cfg?.motion
    if (motion) stage.classList.add(`pet-motion-${motion}`)
    if (cfg && loaded.has(sheetKey(cfg.sheet))) {
      showSprite(name, cfg)
      showingSprite = true
    } else {
      showPlaceholder(name) // Missing/unloaded assets use a placeholder, without emoji fallback.
      showingSprite = false
    }
    // Brief opacity transitions soften pose changes. Hidden pages do not execute the double rAF,
    // which can leave opacity at zero; a timeout guarantees restoration.
    stage.style.opacity = '0'
    const restoreOpacity = () => { stage.style.opacity = '1' }
    requestAnimationFrame(() => requestAnimationFrame(restoreOpacity))
    setTimeout(restoreOpacity, 60)
  }

  // Asset loading. Per-state content bounds use normalized 0-1 coordinates to fit the clickable
  // area to the displayed silhouette. Occupancy varies significantly (55-88%; walk is only 55%
  // wide); taking the union would make idle clickable over transparent margins. Until analysis
  // completes, use the full frame.
  let stateBoxes = new Map<string, Box>() // stateName → { x, y, w, h }
  const applyHitArea = () => {
    if (hitarea === null) return
    const size = parseFloat(getComputedStyle(host).getPropertyValue('--pet-size')) || 110
    // Use the current state's bounds; before analysis completes, use the full image.
    const box = stateBoxes.get(animState ?? '') ?? { x: 0, y: 0, w: 1, h: 1 }
    const hitW = Math.max(40, size * box.w)
    const hitH = Math.max(40, size * box.h)
    // Align to actual frame-relative content offsets box.x/box.y instead of assuming centering. For
    // scaleX mirroring, the horizontal offset is 1 - x - w. Keep the hit area synchronized with the
    // center-mirrored sprite.
    const flipped = flip < 0
    const offX = size * (flipped ? 1 - box.x - box.w : box.x)
    const offY = size * box.y
    hitarea.style.left = `${offX}px`
    hitarea.style.top = `${offY}px`
    hitarea.style.width = `${hitW}px`
    hitarea.style.height = `${hitH}px`
  }
  // Reset content bounds on character switches/reloads because silhouettes differ.
  const resetContentBox = () => {
    stateBoxes = new Map()
  }

  // Analyze opaque pixels in only the first frame through an offscreen canvas. Whole-sheet scanning
  // includes later horizontal frames and inflates the hit area (e.g. a 768 px three-frame idle
  // sheet gives width 0.925 instead of 0.78), making transparent space clickable.
  const analyzeSheet = (img: HTMLImageElement, frames: number) => {
    const canvas = document.createElement('canvas')
    const fw = img.naturalWidth / frames
    canvas.width = fw
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (ctx === null) return null
    ctx.drawImage(img, 0, 0, fw, img.naturalHeight, 0, 0, fw, img.naturalHeight) // Analyze only the first frame.
    const data = ctx.getImageData(0, 0, fw, canvas.height).data
    let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < fw; x++) {
        if ((data[(y * fw + x) * 4 + 3] ?? 0) > 10) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX < 0) return null // Entirely transparent.
    return {
      x: minX / fw, y: minY / canvas.height,
      w: (maxX - minX + 1) / fw, h: (maxY - minY + 1) / canvas.height,
    }
  }

  // Bounded sheet retries prevent transient network/cache errors from leaving permanent blank
  // placeholders. Resolve null after exhaustion so showPlaceholder can warn; on successful load,
  // resolve the image.
  const loadImageWithRetry = (src: string, retries = 3) => new Promise<HTMLImageElement | null>((resolve) => {
    let attempts = 0
    const attempt = () => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => {
        attempts += 1
        if (attempts < retries) setTimeout(attempt, 250 * attempts)
        else resolve(null)
      }
      img.src = src
    }
    attempt()
  })

  const preload = (name: string, cfg: AnimationSet) => loadImageWithRetry(sheetUrl(cfg.sheet)).then((img) => {
    if (img === null) return // Retries exhausted: keep this state's placeholder and showPlaceholder diagnostic.
    sheetSize.set(sheetKey(cfg.sheet), { w: img.naturalWidth, h: img.naturalHeight })
    loaded.add(sheetKey(cfg.sheet))
    const box = analyzeSheet(img, cfg.frames)
    if (box !== null) stateBoxes.set(name, box) // Store bounds per state so the hit area follows the current animation.
    applyHitArea()
  })

  // Retry manifest network/non-2xx failures a bounded number of times, avoiding permanent blank
  // assets after transient errors. Structural validation failures are not retried: malformed data
  // will not improve; keep the current character.
  const loadAssets = async (attempt = 1) => {
    try {
      // The manifest is an exception to immutable asset caching (see
      // 2026-08-16-assets-cache-idle-first-load.md). It is a small, release-dependent index
      // containing frameMs/character metadata; fetch it no-store on each page load, with asset
      // routes reading it from disk. Sheets retain immutable caching and the rename-on-change
      // contract.
      const res = await fetch(MANIFEST_URL, { cache: 'no-store' })
      if (!res.ok) throw new Error(`manifest ${res.status}`)
      const next = await res.json()
      // Require an object manifest with parseable characters. Do not assign invalid manifests;
      // preserve the current character.
      if (next === null || typeof next !== 'object') return
      manifest = next
      resetContentBox() // Reset bounds for the new silhouette; preload merges them progressively. Resolve the default
      // and preferred localStorage character; parseCharacters filters IDs with ROLE_ID_RE.
      const pref = (() => { try { return localStorage.getItem('whale-girl:character') ?? null } catch { return null } })()
      const roles = parseCharacters(manifest)
      const nextId = pref !== null && pref in roles.characters ? pref : roles.defaultId
      characterId = nextId
      character = getCharacter(manifest, nextId) ?? { id: nextId, states: {} }
      // meta.stageSize supplies --pet-size only when the user has not configured size. applyClientConfig sets
      // sizeConfigured synchronously during boot/refresh. Using lastConfigRevision is unsafe
      // because it updates only in refresh, racing manifest loading and potentially overwriting an
      // applied user size with stageSize (issue #12).
      const stageSize = character.meta?.stageSize
      if (typeof stageSize === 'number' && !sizeConfigured) {
        host.style.setProperty('--pet-size', `${stageSize}px`)
      }
      // Load idle first so its request and analysis win under connection-pool saturation. Preload
      // other states in the background without awaiting them. A character without idle loads all
      // states concurrently.
      const states = Object.entries(character.states)
      const idleEntry = states.find(([n]) => n === 'idle')
      if (idleEntry) await preload(idleEntry[0], idleEntry[1])
      for (const [n, cfg] of states) if (n !== 'idle') preload(n, cfg)
    } catch {
      // Retry manifest network failures a bounded number of times; preserve the current character
      // after exhaustion.
      if (attempt < 3) setTimeout(() => loadAssets(attempt + 1), 500 * attempt)
    }
  }

  // Main animation loop. Reset completed/timed-out eat/play/wake transients; interaction transients
  // are followed by brief joy.
  const resetTransient = (now: number) => {
    const wasFun = transient === 'eat' || transient === 'play'
    transient = null
    transientUntil = 0
    if (wasFun) joyUntil = now + JOY_MS
  }
  const tick = () => {
    const now = Date.now()
    // Random chatter every 45-110 s only while idle: not sleeping, dragging, walking, displaying a
    // bubble, or showing menu/chat. Choose the pool from the current mood.
    if (chatterAt === 0) chatterAt = nextChatterAt({ now })
    else if (now >= chatterAt) {
      chatterAt = nextChatterAt({ now })
      const busy = sleeping || dragging || walking || chatOpen || activeBubble !== null
        || menu.classList.contains('open')
      if (!busy) {
        const pool = sessionMood.waiting ? cfg.replies?.wait : sessionMood.thinking ? cfg.replies?.think : cfg.replies?.idle
        const phrase = pickPhrase(pool, { avoid: lastChatterPhrase })
        if (phrase !== null) {
          lastChatterPhrase = phrase
          showReply(phrase)
        }
      }
    }
    // Reset transient animations at their deadline regardless of missing sheets or incomplete
    // playback, preventing stuck states.
    if (transient !== null && now >= transientUntil) {
      resetTransient(now)
    }
    const target = pickState({ activity, dragging, walking, transient, sleeping, joyUntil, dragReleaseUntil, now, sessionThink: sessionMood.thinking, sessionWait: sessionMood.waiting, workingActive: working.active, celebrateUntil })
    // Visual waking edge: show wake when the previous frame displayed sleep and the next leaves it,
    // unless dragging or another transient intervenes. Derived sleeping cannot trigger this:
    // sessions prioritize think/working while activity stays idle and sleeping stays true, so that
    // flag never flips. Use the actual animState transition out of sleep.
    if (shouldWake(animState, target, { dragging, transient })) {
      transient = 'wake'
      transientUntil = now + WAKE_MS
      // Recompute after transient changes; wake outranks think/working/sleep/walk in STATE_TABLE.
      setState(pickState({ activity, dragging, walking, transient, sleeping, joyUntil, dragReleaseUntil, now, sessionThink: sessionMood.thinking, sessionWait: sessionMood.waiting, workingActive: working.active, celebrateUntil }))
      return
    }
    setState(target)
    const anim = stateOf(character, animState)
    if (anim && loaded.has(sheetKey(anim.sheet))) {
      // Validate playback mode at runtime too: repository gates guarantee valid manifests, but
      // modified distribution assets must not silently freeze playback.
      if (anim.playback !== undefined && !['loop', 'pingpong', 'once', 'blink'].includes(anim.playback)) {
        console.warn(`[whale-girl] состояние ${animState}: playback "${anim.playback}" недопустим, играем loop`)
      }
      const size = sheetSize.get(sheetKey(anim.sheet))
      if (!size) return
      const frameW = size.w / anim.frames
      if (!showingSprite) {
        // Late sprite assets replace the current placeholder.
        showSprite(animState ?? 'idle', anim)
        showingSprite = true
        frame = 0
        lastFrameAt = Date.now() // As in setState, hold the first frame for one interval after replacing a placeholder.
      }
      // Random turning in idle/think/wait shares flip with walk/drag so facing stays continuous
      // across actions. Reset scheduling in non-static states (walk/drag/burst/transient) to avoid
      // immediately firing an old deadline on return.
      if ((animState === 'idle' || animState === 'think' || animState === 'wait') && !chatOpen) {
        if (facingAt === 0) facingAt = nextFacingAt({ now })
        if (now >= facingAt) {
          flip = -flip
          applyFacing()
          facingAt = nextFacingAt({ now })
        }
      } else if (facingAt !== 0) {
        facingAt = 0 // Leaving a static state clears its schedule; sample a new delay on return.
      }
      // Advance only multi-frame sheets. Single-frame states use manifest.motion CSS; advancing
      // them would briefly show an empty -width position. Optional frameMs[i] sets per-frame dwell
      // in milliseconds; otherwise use 1000/fps. Manifest timing expresses slower first frames and
      // faster later frames without state-name special cases.
      const holdFor = anim.frameMs?.[frame] ?? 1000 / anim.fps
      if (anim.frames > 1 && now - lastFrameAt >= holdFor) {
        // Advance according to the data-driven playback mode, without state-name special cases
        // (v5).
        if (anim.playback === 'blink') {
          // Hold frame 0, then occasionally play 0->1->...->N-1->0.
          if (blinkActive) {
            // Advance one action: 0->1->...->N-1->0, where N=anim.frames.
            lastFrameAt = now
            frame += 1
            if (frame >= anim.frames) {
              frame = 0 // Action finished: hold frame 0 and schedule the next random trigger.
              blinkActive = false
              blinkAt = nextBlinkAt({ now })
            }
            applyFrame(frameW, frame)
          } else {
            // Hold frame 0 until its scheduled random action starts.
            if (frame !== 0) {
              frame = 0
              applyFrame(frameW, frame)
            }
            if (blinkAt === 0) blinkAt = nextBlinkAt({ now })
            if (now >= blinkAt) blinkActive = true
          }
          return
        }
        lastFrameAt = now
        frame += frameDirection
        if (anim.playback === 'pingpong' && anim.frames > 1) {
          // Ping-pong: 0->1->...->N-1->...->0, reversing direction at the endpoints.
          if (frame >= anim.frames - 1 || frame <= 0) frameDirection *= -1
          frame = Math.max(0, Math.min(anim.frames - 1, frame))
        } else if (frame >= anim.frames) {
          if (anim.playback === 'loop') frame = 0
          else {
            // Once playback holds the final frame: frame 0 starts the action and the last frame
            // completes it.
            frame = anim.frames - 1
            if (transient !== null && transient !== 'wake') {
              resetTransient(now) // Reset non-wake transients immediately after playback, before timeout. Wake holds
              // its final frame until WAKE_MS.
            }
          }
        }
        applyFrame(frameW, frame)
      }
    }
  }

  // Interaction. Drag release, feeding, playing, and opening the menu signal user presence,
  // restarting idle timing so the pet does not immediately sleep again (wakeFromInteraction). If
  // the pet visibly showed sleep at interaction start (interactFromSleep), add the natural wake
  // transition. Pure functions decide; this layer executes.
  const releaseInteraction = () => {
    const decision = wakeFromInteraction({ visuallySleeping: interactFromSleep })
    sleeping = decision.sleeping
    idleSince = 0 // Restart idle timing; refresh records its start when activity becomes idle.
    if (decision.wake) {
      transient = 'wake'
      transientUntil = Date.now() + WAKE_MS
    }
  }
  // Burst hearts upward around the stage center, not a corner. The relative-positioned stage
  // anchors offsets around the character's upper-middle area.
  const spawnHearts = () => {
    for (let i = 0; i < 4; i++) {
      const heart = document.createElement('div')
      heart.className = 'pet-heart'
      heart.textContent = '💗'
      // Critical styles stay inline: if host CSS removes position, effects enter document flow and
      // push the character down.
      heart.style.cssText = `
        position: absolute; font-size: 20px; pointer-events: none; line-height: 1;
        left: ${20 + Math.random() * 110}px; top: ${30 + Math.random() * 80}px;
        z-index: 3; opacity: 1;
      `
      effects.appendChild(heart)
      // Use the Web Animations API rather than injected keyframes, which the host may remove
      // (previous whale-girl-float failures left static hearts). Float upward, enlarge, and fade
      // out.
      if (typeof heart.animate === 'function') {
        heart.animate(
          [
            { opacity: 1, transform: 'translateY(0) scale(.7)' },
            { opacity: 1, transform: 'translateY(-60%) scale(1.25)', offset: 0.7 },
            { opacity: 0, transform: 'translateY(-120%) scale(1.4)' },
          ],
          { duration: 1800, easing: 'ease-out', fill: 'forwards' },
        )
      }
      heart.addEventListener('animationend', () => heart.remove())
      // Timeout cleanup handles reduced-motion and missing animate(): animationend may never fire,
      // otherwise leaving invisible hearts in the DOM indefinitely.
      setTimeout(() => heart.remove(), 2000)
    }
  }

  // Reply bubbles for interactions/chat have a manga-style tail pointing at the pet. Text wraps
  // with pre-wrap/overflow-wrap; width is at most min(280px, 100vw-16px), and height at most 40vh
  // with scrolling. The tail is a real inline-styled child: pseudo-elements cannot receive inline
  // styles and the host may remove injected CSS. Text lives in its own span so
  // revealText.textContent cannot erase the tail. Open chat adds input height to offsetY. Only one
  // bubble exists at a time; each new reply replaces the previous one.
  const bubbleTimers = new Set<ReturnType<typeof setTimeout>>()
  let activeBubble: HTMLDivElement | null = null
  const BUBBLE_TAIL_SIZE = 8
  const BUBBLE_MAX_WIDTH = 'min(280px, calc(100vw - 16px))'
  // Pet clearance: base 8 px plus input height while chat is open.
  const bubbleOffsetAbove = () => 8 + (composerVisible() ? (chatEl!.offsetHeight || 44) + 6 : 0)
  const clearBubble = () => {
    if (activeBubble !== null) {
      activeBubble.remove()
      activeBubble = null
    }
  }
  const createBubble = (): Bubble => {
    const el = createPanel({ anchor: 'above', variant: 'plain', offsetY: bubbleOffsetAbove(), zIndex: '3' }).el
    el.className = 'pet-bubble'
    el.style.cssText += ` padding:8px 10px; white-space:pre-wrap; overflow-wrap:anywhere; word-break:break-word;
      max-width:${BUBBLE_MAX_WIDTH}; text-align:left; line-height:1.35;`
    const scroll = document.createElement('div')
    scroll.className = 'pet-bubble-scroll'
    scroll.style.cssText = 'max-height:40vh; overflow-y:auto; overflow-x:hidden; white-space:pre-wrap; overflow-wrap:anywhere; pointer-events:auto;'
    const textEl = document.createElement('span')
    textEl.className = 'pet-bubble-text'
    textEl.style.cssText = 'display:block; white-space:pre-wrap; overflow-wrap:anywhere;'
    scroll.appendChild(textEl)
    const tail = document.createElement('div')
    tail.className = 'pet-bubble-tail'
    tail.setAttribute('aria-hidden', 'true')
    tail.style.cssText = `position:absolute; left:50%; width:0; height:0; transform:translateX(-50%);
      border-left:${BUBBLE_TAIL_SIZE}px solid transparent; border-right:${BUBBLE_TAIL_SIZE}px solid transparent;`
    el.append(scroll, tail)
    effects.appendChild(el)
    activeBubble = el
    return { el, scroll, textEl, tail, timer: null }
  }
  // The 30-second typing safety timer may remove a bubble during a pending request. Return a
  // connected bubble, existing or newly created, so the response remains visible.
  const ensureLiveBubble = (bubble: Bubble) => {
    if (bubble.el.isConnected) return bubble
    const next = createBubble()
    if (typeof onBubbleShown === 'function') onBubbleShown()
    return next
  }
  // Position the bubble and tail: point down when above the pet, up when flipped below it.
  const placeBubble = (bubble: Bubble) => {
    const up = placeOverlay(bubble.el, { above: true, offsetY: bubbleOffsetAbove() })
    bubble.tail.style.top = up ? 'auto' : `-${BUBBLE_TAIL_SIZE}px`
    bubble.tail.style.bottom = up ? `-${BUBBLE_TAIL_SIZE}px` : 'auto'
    bubble.tail.style.borderTop = up ? `${BUBBLE_TAIL_SIZE}px solid ${PANEL_THEME.bg}` : '0'
    bubble.tail.style.borderBottom = up ? '0' : `${BUBBLE_TAIL_SIZE}px solid ${PANEL_THEME.bg}`
    // Point the tail toward the pet rather than the shifted bubble center. Near viewport edges,
    // planOverlay shifts the bubble away from the pet center; keep the tail inside rounded corners
    // and the background.
    const rect = bubble.el.getBoundingClientRect()
    if (rect.width > 0) {
      const pet = host.getBoundingClientRect()
      const petCenter = pet.left + pet.width / 2
      const tail = Math.min(Math.max(14, petCenter - rect.left), rect.width - 14)
      bubble.tail.style.left = `${tail}px`
    }
    return up
  }
  // Reserve rendered final-text height before typing: the bottom is transform-anchored, so growing
  // text would push the bubble past the viewport top. clientHeight already respects
  // max-height:40vh; scrollHeight would include the entire long reply and min-height would override
  // the cap, disabling scrolling.
  const reserveBubbleHeight = (bubble: Bubble) => {
    const height = bubble.scroll.clientHeight
    if (height > 0) bubble.scroll.style.minHeight = `${height}px`
  }
  const animateBubble = (el: HTMLElement, up: boolean) => {
    if (typeof el.animate !== 'function') {
      el.style.opacity = '1'
      return
    }
    // Keyframes include translate(-50%, ...); preserve horizontal centering and finish with the
    // exact transform assigned by placeOverlay.
    el.animate(
      [
        { opacity: 0, transform: up ? 'translate(-50%, -85%)' : 'translate(-50%, -15%)' },
        { opacity: 1, transform: up ? 'translate(-50%, -100%)' : 'translateX(-50%)' },
      ],
      { duration: 250, easing: 'ease-out', fill: 'forwards' },
    )
  }
  const disarmBubble = (bubble: Bubble) => {
    if (bubble.timer !== null) {
      clearTimeout(bubble.timer)
      if (bubble.timer !== null) bubbleTimers.delete(bubble.timer)
      bubble.timer = null
    }
  }
  const armBubble = (bubble: Bubble, ms: number) => {
    disarmBubble(bubble)
    bubble.timer = setTimeout(() => {
      if (bubble.timer !== null) bubbleTimers.delete(bubble.timer)
      bubble.timer = null
      if (activeBubble === bubble.el) activeBubble = null
      bubble.el.remove()
      if (typeof onBubbleShown === 'function') onBubbleShown() // The bubble disappeared; restore the status card.
      finishChatWhenIdle()
    }, Math.max(250, ms))
    bubbleTimers.add(bubble.timer)
  }
  // Typing indicator: three dots inside the future reply bubble, not a panel log.
  const showTypingBubble = () => {
    clearBubble()
    const bubble = createBubble()
    const dots = document.createElement('span')
    dots.className = 'pet-typing'
    dots.setAttribute('aria-label', 'Кит-девочка печатает')
    for (let i = 0; i < 3; i += 1) dots.appendChild(document.createElement('i'))
    bubble.textEl.appendChild(dots)
    animateBubble(bubble.el, placeBubble(bubble))
    if (typeof onBubbleShown === 'function') onBubbleShown()
    armBubble(bubble, 30000) // Safety timeout: a stalled request must not leave typing dots forever.
    return bubble
  }
  const showReply = (text: unknown, { ms }: { ms?: number } = {}) => {
    // Menu and bubble share the area above the pet; the reply takes priority over the menu in the
    // higher effects layer.
    if (menu.classList.contains('open')) toggleMenu(false)
    clearBubble()
    const bubble = createBubble()
    const message = typeof text === 'string' ? text : String(text ?? '')
    bubble.textEl.textContent = message
    reserveBubbleHeight(bubble)
    animateBubble(bubble.el, placeBubble(bubble))
    if (typeof onBubbleShown === 'function') onBubbleShown()
    armBubble(bubble, typeof ms === 'number' ? ms : cfg.bubbleMs)
    return bubble
  }
  // Keep multi-line chat replies visible long enough to read.
  const chatBubbleMs = (text: string) => chatBubbleDuration(text, cfg.bubbleMs)

  // Chat. The input is a compact fixed layer above the pet, with no panel/history. Replies appear
  // in manga bubbles and the pet stays still during conversation. The fixed layer must be above the
  // host z-index to overlap menus/settings; the host's stacking context prevents an internal fixed
  // layer from escaping it.
  const chatEnabled = () => cfg.chat?.enabled !== false
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
  let chatGreeted = false

  const ensureChat = () => {
    if (chatEl !== null) return chatEl
    const panel = document.createElement('form')
    panel.setAttribute('data-whale-girl-chat', '')
    panel.setAttribute('aria-label', 'Сообщение питомцу')
    panel.style.cssText = `position: fixed; z-index: 2147483001; display: flex; gap: 6px; align-items: center;
      width: min(300px, calc(100vw - 16px)); box-sizing: border-box; padding: 6px 8px; margin: 0;
      background: rgba(24,28,38,.97); border: 1px solid rgba(255,255,255,.10); border-radius: 12px;
      box-shadow: 0 18px 44px rgba(0,0,0,.45), 0 4px 10px rgba(0,0,0,.3);
      color: #E8EBF2; font-family: system-ui, sans-serif; font-size: 12px;`
    const mic = document.createElement('button')
    mic.type = 'button'
    mic.textContent = '🎙'
    mic.setAttribute('aria-label', 'Сказать голосом')
    mic.title = 'Сказать голосом'
    mic.style.cssText = 'border:0; border-radius:8px; background:rgba(255,255,255,.10); color:#fff; cursor:pointer; padding:6px 8px; font-size:12px; flex:none;'
    mic.addEventListener('click', () => { void toggleMic() })
    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'Напиши или скажи…'
    input.setAttribute('aria-label', 'Сообщение питомцу')
    input.maxLength = 500
    input.style.cssText = 'flex:1; min-width:0; border:1px solid rgba(255,255,255,.14); border-radius:8px; background:rgba(255,255,255,.06); color:#E8EBF2; font:inherit; font-size:12px; padding:6px 8px; outline:none;'
    const send = document.createElement('button')
    send.type = 'submit'
    send.textContent = '➤'
    send.setAttribute('aria-label', 'Отправить')
    send.style.cssText = 'border:0; border-radius:8px; background:rgba(86,134,254,.85); color:#fff; cursor:pointer; padding:6px 10px; font-size:12px; flex:none;'
    panel.style.flexWrap = 'wrap'
    panel.append(mic, input, send)
    panel.addEventListener('submit', (event) => { event.preventDefault(); void sendChat() })
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); void sendChat() }
      if (event.key === 'Escape') closeChat()
    })
    // Input focus signals user presence: stop movement during conversation.
    input.addEventListener('focus', () => stopWalk())
    // Input-row clicks must not reach document handlers that close the menu/chat.
    panel.addEventListener('pointerdown', (event) => event.stopPropagation())
    document.body.appendChild(panel)
    chatEl = panel
    chatInput = input
    chatMic = mic
    updateMic()
    return panel
  }

  // Use planOverlay for input side/shift, sharing menu/status geometry. Convert left/top to
  // absolute viewport pixels because the element belongs to body, outside the host coordinate
  // system.
  const positionChat = () => {
    if (chatEl === null) return
    const rect = host.getBoundingClientRect()
    const width = chatEl.offsetWidth || 300
    const height = chatEl.offsetHeight || 44
    const plan = planOverlay({
      rect,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      size: { w: width, h: height },
      above: true,
      offsetY: 8,
    })
    const top = plan.up ? rect.top - 8 - height : rect.bottom + 8
    const left = rect.left + rect.width / 2 - width / 2 + plan.shift
    chatEl.style.left = `${clamp(left, 8, Math.max(8, window.innerWidth - width - 8))}px`
    chatEl.style.top = `${clamp(top, 8, Math.max(8, window.innerHeight - height - 8))}px`
    chatEl.style.right = 'auto'
    chatEl.style.bottom = 'auto'
  }

  // Reveal responses at 20 ms/character for messenger-like typing. Show reduced-motion or very long
  // replies immediately instead of delaying them for half a minute.
  const preferReducedMotion = () => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
  }
  const revealText = async (bubble: Bubble, text: string) => {
    const token = revealToken + 1
    revealToken = token
    bubble.textEl.textContent = ''
    bubble.scroll.scrollTop = 0
    if (preferReducedMotion() || text.length > 400) {
      bubble.textEl.textContent = text
      bubble.scroll.scrollTop = bubble.scroll.scrollHeight
      return
    }
    for (let index = 1; index <= text.length; index += 1) {
      if (revealToken !== token || !bubble.el.isConnected) return
      bubble.textEl.textContent = text.slice(0, index)
      bubble.scroll.scrollTop = bubble.scroll.scrollHeight
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
  }

  // Microphone: browser SpeechRecognition or MediaRecorder uploads to /transcribe for OpenAI.
  // Server STT exists only for provider=openai; browser mode would receive 403/400, so it uses the
  // browser API (voiceErrorMessage).
  const stopListening = () => {
    if (recognition !== null) {
      try { recognition.stop() } catch { /* Already stopped. */ }
      recognition = null
    }
    if (listening) { listening = false; updateMic() }
  }
  const updateMic = () => {
    if (chatMic === null) return
    const active = recording || listening
    chatMic.textContent = active ? '⏹' : '🎙'
    chatMic.style.background = active ? 'rgba(240,90,90,.75)' : 'rgba(255,255,255,.10)'
    chatMic.setAttribute('aria-pressed', active ? 'true' : 'false')
    chatMic.title = active ? 'Остановить запись' : 'Сказать голосом'
    chatMic.setAttribute('aria-label', chatMic.title)
  }
  const listenOnce = () => {
    if (!chatEnabled()) return
    if (!chatOpen) openChat() // Voice must work without first opening the input row.
    if (chatInput === null) return
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (typeof Recognition !== 'function') {
      showReply('Браузер не умеет распознавать речь. Напиши текстом — я тут.')
      return
    }
    stopListening()
    try {
      const instance = new Recognition()
      recognition = instance
      instance.lang = 'ru-RU'
      instance.interimResults = false
      instance.maxAlternatives = 1
      instance.onstart = () => { if (recognition === instance) { listening = true; updateMic() } }
      instance.onresult = (event) => {
        const transcript = event?.results?.[0]?.[0]?.transcript
        if (recognition !== instance || !chatOpen) return
        if (typeof transcript === 'string' && transcript.trim() !== '' && chatInput !== null) {
          chatInput.value = transcript.trim()
          void sendChat()
        }
      }
      instance.onerror = (event) => {
        if (recognition !== instance || !chatOpen) return
        // Translate not-allowed/no-speech/network/audio-capture/service-not-allowed into actionable
        // messages.
        showReply(voiceErrorMessage(typeof event?.error === 'string' ? event.error : ''))
      }
      instance.onend = () => {
        if (recognition !== instance) return
        recognition = null
        if (listening) { listening = false; updateMic() }
      }
      instance.start()
    } catch {
      listening = false
      updateMic()
      showReply('Не получилось включить микрофон. Напиши текстом — я тут.')
    }
  }
  let transcriptionGeneration = 0
  const uploadAudio = async (blob: Blob, mime: string) => {
    const generation = transcriptionGeneration
    try {
      const res = await fetch(TRANSCRIBE_PATH, {
        method: 'POST',
        headers: { 'content-type': mime || 'audio/webm' },
        body: blob,
      })
      const body = await res.json().catch(() => null)
      if (!chatOpen || generation !== transcriptionGeneration) return
      if (!res.ok) {
        showReply(voiceErrorMessage(body?.error))
        return
      }
      const text = typeof body?.text === 'string' ? body.text.trim() : ''
      if (text === '') {
        showReply('Не разобрала слова. Попробуй ещё раз или напиши текстом.')
        return
      }
      if (chatInput !== null) chatInput.value = text
      await sendChat()
    } catch {
      if (chatOpen && generation === transcriptionGeneration) showReply(voiceErrorMessage(null))
    }
  }
  const microphone = createMicrophoneCapture({
    allowed: () => chatOpen && cfg.voice.enabled === true && cfg.voice.provider !== 'browser',
    acquire: () => navigator.mediaDevices.getUserMedia({ audio: true }),
    create: (stream) => new MediaRecorder(stream),
    recording: (active) => { recording = active; updateMic() },
    audio: (blob, mime) => { void uploadAudio(blob, mime) },
    error: (error) => showReply(voiceErrorMessage(error instanceof Error && error.name === 'NotAllowedError' ? 'not-allowed' : 'audio-capture')),
  })
  const stopRecording = () => microphone.stop(true)
  const startRecording = () => microphone.start()
  // Provider routing: /transcribe is meaningful only for enabled OpenAI voice. Otherwise use
  // browser SpeechRecognition instead of receiving voice-disabled with no transcription.
  const serverStt = () => cfg.voice?.enabled === true
    && cfg.voice?.provider !== 'browser'
  const toggleMic = async () => {
    if (recording) { stopRecording(); return }
    if (microphone.busy()) return
    if (listening) { stopListening(); return }
    if (cfg.voice.provider === 'subscription') {
      showReply(voiceErrorMessage('voice-subscription-unsupported'))
      return
    }
    if (cfg.voice.provider !== 'browser' && cfg.voice.enabled !== true) {
      showReply(voiceErrorMessage('voice-disabled'))
      return
    }
    if (serverStt()) {
      if (!chatOpen) openChat()
      if (typeof window.MediaRecorder !== 'function' || navigator.mediaDevices?.getUserMedia === undefined) {
        showReply('Запись недоступна. Открой DSH через localhost или HTTPS и разреши микрофон.')
        return
      }
      await startRecording()
      return
    }
    listenOnce()
  }

  // Conversation mode: listen again after replying, when enabled in settings.
  const conversationResume = createConversationResume(
    () => chatOpen && conversationMode && cfg.voice.enabled === true && !recording && !listening,
    () => { void toggleMic() },
  )
  const maybeConversationListen = () => conversationResume.schedule()
  const cancelMicrophone = () => { transcriptionGeneration += 1; conversationResume.cancel(); microphone.cancel(); stopListening() }

  const setSpeaking = (on: boolean) => {
    try { stage.classList.toggle('pet-speaking', on) } catch { /* The stage may have been removed. */ }
  }

  const closeChat = () => {
    chatOpen = false
    chatGeneration += 1
    cancelMicrophone()
    revealToken += 1 // Interrupt unfinished text reveal.
    clearBubble()
    stopListening()
    if (chatEl !== null) chatEl.style.display = 'none'
    if (chatInput !== null) chatInput.blur()
    stopSpeaking()
    layoutStatus()
    scheduleWander() // Chat closed: resume wandering immediately rather than waiting for the old timer.
  }

  const finishChatWhenIdle = () => {
    if (chatOpen && !composerVisible() && !chatPending && !speechPending && !conversationMode && activeBubble === null) closeChat()
  }

  // Dismissing the composer after submission keeps the pending reply and its audio alive.
  const dismissChatInput = () => {
    if (chatEl !== null) chatEl.style.display = 'none'
    chatInput?.blur()
    cancelMicrophone()
  }

  const openChat = () => {
    if (!chatEnabled()) return
    const panel = ensureChat()
    panel.style.display = 'flex'
    chatOpen = true
    toggleMenu(false)
    releaseInteraction()
    stopWalk() // Stop movement before measuring the pet's position.
    positionChat()
    clearBubble()
    layoutStatus()
    if (!chatGreeted) {
      chatGreeted = true
      showReply('Привет! Я тут. О чём поговорим?')
    }
    if (chatInput !== null) {
      setTimeout(() => { try { if (composerVisible()) chatInput?.focus() } catch { /* The page may have navigated away. */ } }, 0)
    }
  }

  const toggleChat = () => { if (composerVisible()) closeChat(); else openChat() }

  const askSessionStatus = () => {
    toggleMenu(false)
    if (!chatEnabled() || chatPending) return
    if (!chatOpen) openChat()
    if (chatInput === null) return
    chatInput.value = SESSION_STATUS_QUESTION
    void sendChat()
  }

  const sendChat = async () => {
    if (chatInput === null || chatPending) return
    const text = chatInput.value.replace(/\s+/g, ' ').trim()
    if (text === '') return
    chatPending = true
    const generation = chatGeneration
    chatInput.value = ''
    dismissChatInput()
    let typing = showTypingBubble()
    try {
      const res = await fetch(CHAT_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, sessionId: currentSessionId(ctx.sessions?.list?.getSnapshot()) }),
      })
      const body = await res.json().catch(() => null)
      if (generation !== chatGeneration || !chatOpen) return
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
      const reply = typeof body?.reply === 'string' && body.reply !== '' ? body.reply : '…'
      const bubbleText = typeof body?.bubble === 'string' && body.bubble !== '' ? body.bubble : reply
      const speech = typeof body?.speech === 'string' && body.speech !== '' ? body.speech : reply
      typing = ensureLiveBubble(typing)
      disarmBubble(typing)
      // Reveal within the same bubble: reserve final height first so typing cannot expand it upward
      // beyond the viewport.
      typing.textEl.textContent = reply
      reserveBubbleHeight(typing)
      placeBubble(typing)
      const spoken = chatOpen && cfg.voice?.autoSpeakChat !== false && cfg.voice?.enabled === true
      await presentChatReply({
        current: () => generation === chatGeneration && chatOpen && activeBubble === typing.el,
        speak: () => { if (spoken) speak(speech) },
        reveal: () => revealText(typing, reply),
        finish: () => {
          armBubble(typing, chatBubbleMs(bubbleText))
          if (!spoken) maybeConversationListen()
        },
      })
    } catch {
      if (generation !== chatGeneration || !chatOpen) return
      const message = 'Хм… не получилось поговорить. Попробуй ещё раз!'
      typing = ensureLiveBubble(typing)
      typing.textEl.textContent = message
      reserveBubbleHeight(typing)
      placeBubble(typing)
      armBubble(typing, chatBubbleMs(message))
    } finally {
      chatPending = false
      finishChatWhenIdle()
      if (chatInput !== null && composerVisible() && generation === chatGeneration) {
        // Restore focus only if the user has not moved elsewhere. Receiving a reply must not steal
        // focus from settings or another host input.
        const active = document.activeElement
        const inside = active === null || active === document.body || active === chatInput
        if (inside) {
          try { chatInput.focus() } catch { /* The page may have navigated away. */ }
        }
      }
    }
  }

  const syncChatAvailability = () => {
    for (const button of [chatBtn, statusBtn, newsBtn]) button.style.display = chatEnabled() ? '' : 'none'
    if (!chatEnabled() && chatOpen) closeChat()
  }

  // Voice. browser uses system SpeechSynthesis without network; openai posts /voice to the
  // configured OpenAI-compatible TTS server (model/voice/URL in settings). Surface model errors
  // explicitly rather than silently substituting a provider.
  const speechRequest = createSpeechRequest()
  let releaseAudio: (() => void) | null = null
  const stopSpeaking = () => {
    speechPending = false
    speechRequest.cancel()
    try { window.speechSynthesis?.cancel() } catch { /* Without the API there is nothing to cancel. */ }
    if (currentAudio !== null) {
      try { currentAudio.pause() } catch { /* Already stopped. */ }
      currentAudio = null
    }
    releaseAudio?.()
    releaseAudio = null
    setSpeaking(false)
  }

  const pickBrowserVoice = () => {
    const synth = window.speechSynthesis
    if (synth === undefined) return null
    let voices = []
    try { voices = synth.getVoices() } catch { return null }
    if (!Array.isArray(voices) || voices.length === 0) return null
    const wanted = typeof cfg.voice?.voice === 'string' ? cfg.voice.voice.trim().toLowerCase() : ''
    if (wanted !== '') {
      const exact = voices.find((voice) => typeof voice.name === 'string' && voice.name.toLowerCase() === wanted)
      if (exact !== undefined) return exact
    }
    return voices.find((voice) => typeof voice.lang === 'string' && voice.lang.toLowerCase().startsWith('ru')) ?? null
  }

  const speakBrowser = (text: string) => {
    const synth = window.speechSynthesis
    if (synth === undefined || typeof SpeechSynthesisUtterance !== 'function') { speechPending = false; finishChatWhenIdle(); return }
    try {
      synth.cancel()
      const signal = speechRequest.start()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'ru-RU'
      utterance.rate = typeof cfg.voice?.rate === 'number' ? Math.min(2, Math.max(0.5, cfg.voice.rate)) : 1
      const voice = pickBrowserVoice()
      if (voice !== null) utterance.voice = voice
      utterance.onstart = () => { if (speechRequest.current(signal)) setSpeaking(true) }
      utterance.onend = () => { if (speechRequest.current(signal)) { speechPending = false; setSpeaking(false); maybeConversationListen(); finishChatWhenIdle() } }
      utterance.onerror = () => { if (speechRequest.current(signal)) { speechPending = false; setSpeaking(false); finishChatWhenIdle() } }
      synth.speak(utterance)
    } catch { speechPending = false; finishChatWhenIdle() }
  }

  const speakModel = async (text: string) => {
    const signal = speechRequest.start()
    try {
      const res = await fetch(VOICE_PATH, {
        signal,
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) {
        const failure = await res.json().catch(() => null)
        throw new Error(typeof failure?.error === 'string' ? failure.error : `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      if (!speechRequest.current(signal) || cfg.voice.enabled !== true) return
      if (blob.size === 0) throw new Error('empty audio')
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      currentAudio = audio
      const cleanup = () => { URL.revokeObjectURL(url); if (currentAudio === audio) currentAudio = null; if (releaseAudio === cleanup) releaseAudio = null }
      releaseAudio = cleanup
      audio.addEventListener('ended', () => { cleanup(); if (speechRequest.current(signal)) { speechPending = false; setSpeaking(false); maybeConversationListen(); finishChatWhenIdle() } }, { once: true })
      audio.addEventListener('error', () => { cleanup(); if (speechRequest.current(signal)) { speechPending = false; setSpeaking(false); finishChatWhenIdle() } }, { once: true })
      audio.addEventListener('playing', () => { if (speechRequest.current(signal)) setSpeaking(true) }, { once: true })
      await audio.play().catch(() => { cleanup(); if (speechRequest.current(signal)) setSpeaking(false); throw new Error('playback blocked') })
    } catch (error) {
      if (!speechRequest.current(signal)) return
      speechPending = false
      setSpeaking(false)
      const code = error instanceof Error ? error.message : ''
      showReply((code.startsWith('voice-') || code.startsWith('tts-')) ? voiceErrorMessage(code) : 'Не удалось озвучить ответ. Проверь настройки голоса и доступ к сервису.')
    }
  }

  const speak = (text: unknown) => {
    const voice = cfg.voice
    if (voice?.enabled !== true || typeof text !== 'string') return
    const clean = text.replace(/[«»"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 300)
    if (clean === '') return
    stopSpeaking()
    speechPending = true
    if (voice.provider !== 'browser') {
      void speakModel(clean)
      return
    }
    speakBrowser(clean)
  }

  const interact = async (action: 'feed' | 'play') => {
    stopWalk() // Interaction stops walking so eat/play remain stationary; an existing walk otherwise continues
    // after a click.
    releaseInteraction() // Interaction signals presence: reset idle timing so eat/play do not return directly to sleep.
    // Add wake when sleeping; eat/play then take precedence.
    transient = action === 'feed' ? 'eat' : 'play'
    transientUntil = Date.now() + TRANSIENT_MS
    try {
      const res = await fetch(INTERACT_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) return // 403/413/500 are not successful interactions; do not emit hearts.
      const body = await res.json().catch(() => null)
      if (body?.reply) { showReply(body.reply, { ms: chatBubbleMs(body.reply) }); speak(body.reply) }
      spawnHearts()
    } catch {
      // Transient network error: the next poll will recover.
    }
    await refresh()
  }

  // Serialize refreshes: out-of-order visibilitychange/timer responses can create false waking
  // edges.
  let refreshing = false
  // Show an offline status after three consecutive failures; clear it after success.
  let failStreak = 0
  // Hot settings use configRevision: fetch/apply only on changes instead of resetting wander timers
  // every 3 s. sizeConfigured records explicit size application and permits stageSize only before
  // that. lastConfigRevision===0 is not a safe guard because only refresh updates it: concurrent
  // manifest loading can overwrite boot's 160 px size with 110 px until the first /state response
  // (issue #12).
  let lastConfigRevision = 0
  let sizeConfigured = false
  // Deduplicate memory announcements by /state memory.at, refreshed on agent/created edges.
  // Announce each timestamp once; the Node MEMORY_WINDOW_MS independently bounds delivery.
  let lastMemoryAt = 0
  // /state polling timer; recreate when pollMs changes for immediate effect (applyClientConfig).
  let pollTimer: ReturnType<typeof setTimeout> | null = null
  const fetchConfig = async () => {
    try {
      const res = await fetch(CONFIG_PATH)
      if (!res.ok) return null
      const body = await res.json()
      return (body !== null && typeof body === 'object') ? body.config : null
    } catch {
      return null // Transient error: keep current settings and retry on the next cycle.
    }
  }
  // Apply client settings: CSS variables control size/opacity; cfg controls walking, sleeping, and
  // polling on the next behavior cycle.
  const applyClientConfig = (config: ClientConfig) => {
    if (config === null || typeof config !== 'object') return
    // Hot enabled=false immediately disposes the web pet, avoiding duplicates with the desktop
    // companion. Re-enabling requires a page reload because self-rendering has no remount path.
    // Missing enabled means enabled for compatibility.
    if (config.enabled === false) {
      disposePet()
      return
    }
    const prevPollMs = cfg.pollMs
    const previousVoiceProvider = cfg.voice.provider
    cfg = { ...CFG_DEFAULTS, ...config }
    if (typeof config.size === 'number') {
      sizeConfigured = true // Explicit size configuration disables subsequent stageSize overrides (issue #12).
      host.style.setProperty('--pet-size', `${config.size}px`)
      // Re-clamp the position after resizing so the pet stays on screen.
      if (host.style.left) {
        const x = Math.max(0, Math.min(parseFloat(host.style.left) || 0, window.innerWidth - host.offsetWidth))
        const y = Math.max(0, Math.min(parseFloat(host.style.top) || 0, window.innerHeight - host.offsetHeight))
        host.style.left = `${x}px`
        host.style.top = `${y}px`
      }
    }
    if (typeof config.opacity === 'number') host.style.setProperty('--pet-opacity', String(config.opacity))
    // Recreate polling on pollMs changes so they apply without a reload. Only recreate while
    // visible; keep it null during background suspension and let onVisibility restart with current
    // cfg.
    if (typeof config.pollMs === 'number' && config.pollMs !== prevPollMs && document.visibilityState === 'visible') {
      clearInterval(pollTimer ?? undefined)
      pollTimer = setInterval(refresh, cfg.pollMs)
    }
    scheduleWander() // Wander settings may change: reschedule the next walk. Voice/chat settings apply live:
    // disabled voice stops immediately; disabled chat hides its button and closes the open input.
    if (config.voice?.enabled === false || previousVoiceProvider !== cfg.voice.provider) { stopSpeaking(); cancelMicrophone() }
    if (config.voice?.conversation !== true) conversationResume.cancel()
    conversationMode = config.voice?.conversation === true
    if (chatOpen) positionChat() // Pet size may change; keep the input attached to its position.
    syncChatAvailability()
    finishChatWhenIdle()
  }
  const refresh = async () => {
    if (refreshing) return
    refreshing = true
    try {
      const res = await fetch(STATE_PATH)
      if (!res.ok) throw new Error(`state ${res.status}`)
      const body = await res.json()
      // Validate structure: missing or invalid pet/activity fields retain previous valid values
      // instead of breaking polling.
      if (body !== null && typeof body === 'object' && body.pet !== null && typeof body.pet === 'object') {
        const nextPet = body.pet as PetState
        pet = nextPet
        // Level up: one reply and hearts make the change visible without hovering.
        if (Number.isInteger(nextPet.level)) {
          if (lastLevel !== 0 && nextPet.level > lastLevel) {
            const phrase = pickPhrase(cfg.replies?.levelUp, { avoid: lastChatterPhrase })
            if (phrase !== null) {
              lastChatterPhrase = phrase
              showReply(phrase)
              speak(phrase)
            }
            spawnHearts()
          }
          lastLevel = nextPet.level
        }
      }
      const act = body?.activity
      if (act !== null && typeof act === 'object' && typeof act.name === 'string') {
        activity = act
        // Event changes (welcome/celebration/fright/disappointment) select a phrase from their
        // event pool.
        const name = act.name
        if (lastActivityName !== null && name !== lastActivityName
          && (name === 'welcome' || name === 'celebrate' || name === 'error' || name === 'disappointed')) {
          const phrase = pickPhrase(cfg.replies?.[name], { avoid: lastChatterPhrase })
          if (phrase !== null) {
            lastChatterPhrase = phrase
            showReply(phrase)
            speak(phrase)
          }
        }
        lastActivityName = name
      }
      // Node aggregates sessionThink/sessionWait/turn-completion windows into /state. Absolute
      // deadlines support simultaneous web/desktop consumers; booleans remain compatible with older
      // Node halves.
      if (act !== null && typeof act === 'object') {
        sessionMood = {
          thinking: act.sessionThink === true,
          waiting: act.sessionWait === true,
          titles: [],
        }
        if (Number.isFinite(act.turnCompletedUntil) && act.turnCompletedUntil > Date.now()) {
          celebrateUntil = Math.max(celebrateUntil, act.turnCompletedUntil)
        } else if (act.turnCompleted === true) {
          celebrateUntil = Math.max(celebrateUntil, Date.now() + ROUND_CELEBRATE_MS)
        }
        armWorking() // Session activity changes arm/disarm working interludes; guards preserve already scheduled
        // decisions.
      }
      // Sleep measures sustained idle from entry into idle, not the last activity timestamp, which
      // can predate ongoing work and cause instant sleep after it ends. releaseInteraction resets
      // idleSince for dragging/feeding/playing/menu interaction; this branch consumes only Node
      // activity.
      const isActive = activity.name !== 'idle' || activity.until > Date.now()
      if (isActive) {
        idleSince = 0
      } else if (idleSince === 0) {
        idleSince = Date.now()
      }
      sleeping = activity.name === 'idle' && idleSince !== 0 && Date.now() - idleSince > cfg.sleepAfterMs
      // Hot settings: a changed /state configRevision fetches /config and applies
      // size/opacity/walking/sleep.
      if (typeof body?.configRevision === 'number' && body.configRevision !== lastConfigRevision) {
        lastConfigRevision = body.configRevision
        const config = await fetchConfig()
        if (config !== null) applyClientConfig(config)
    syncChatAvailability()
      }
      // The /state companionOnline heartbeat window hides the web pet while the desktop companion
      // is present, avoiding duplicates. It automatically returns when the heartbeat expires.
      const nextCompanion = body?.companionOnline === true
      if (nextCompanion !== companionOnline) {
        companionOnline = nextCompanion
        syncInert()
      }
      // Memory recall arrives in /state during the Node window. Deduplicate by at and greet with
      // the previous completed work. memoryLine is pure; null means no announcement.
      const memory = body?.memory
      if (memory !== null && typeof memory === 'object'
        && Number.isFinite(memory.at) && memory.at !== lastMemoryAt) {
        lastMemoryAt = memory.at
        const line = memoryLine(memory)
        if (line !== null) showReply(line)
      }
      // tick triggers wake on the visual edge leaving sleep. Do not infer it here from sleeping,
      // which remains unchanged during active sessions; see the decision record.
      failStreak = 0
      renderStatus()
    } catch {
      // Transient network failures retain prior state; repeated failures show offline status so a
      // frozen pet is visible to the user.
      failStreak += 1
      if (failStreak >= 3) metaNote.textContent = '📡 Не в сети…'
    } finally {
      refreshing = false
    }
  }

  // Dragging uses pointer events; movement below 6 px is treated as a click that toggles the menu.
  let startX = 0
  let startY = 0
  let lastPointerX = 0
  let offsetX = 0
  let offsetY = 0

  // Persist position in localStorage. Ignore corrupt data and use the default bottom-right anchor.
  const POS_KEY = 'whale-girl:pos'
  const savePos = () => {
    try {
      if (host.style.left && host.style.top) {
        localStorage.setItem(POS_KEY, JSON.stringify({ x: parseFloat(host.style.left), y: parseFloat(host.style.top) }))
      }
    } catch {
      // Ignore unavailable localStorage in private mode.
    }
  }
  try {
    const raw = JSON.parse(localStorage.getItem(POS_KEY) ?? 'null')
    if (raw && Number.isFinite(raw.x) && Number.isFinite(raw.y)) {
      // Clamp restored positions immediately: a smaller window may otherwise leave old coordinates
      // permanently off-screen without a resize event.
      const x = Math.max(0, Math.min(raw.x, window.innerWidth - host.offsetWidth))
      const y = Math.max(0, Math.min(raw.y, window.innerHeight - host.offsetHeight))
      host.style.left = `${x}px`
      host.style.top = `${y}px`
      host.style.right = 'auto'
      host.style.bottom = 'auto'
    }
  } catch {
    // Ignore corrupt saved data.
  }

  // Capture only after crossing the drag threshold, preserving ordinary button clicks. Bind
  // dragging/click toggling to the 110x110 stage hit area, excluding status/menu regions to avoid
  // accidental interception.
  hitarea.addEventListener('pointerdown', (e) => {
    pressed = true
    dragging = false
    moved = false
    interactFromSleep = animState === 'sleep' // Visual state at interaction start determines waking.
    stopWalk() // Dragging stops wandering immediately.
    startX = e.clientX
    startY = e.clientY
    lastPointerX = e.clientX
    offsetX = e.clientX - host.offsetLeft
    offsetY = e.clientY - host.offsetTop
  })
  hitarea.addEventListener('pointermove', (e) => {
    if (!pressed) return
    if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) > 6) {
      if (!moved) hitarea.setPointerCapture(e.pointerId)
      moved = true
      dragging = true
      // Dragging interrupts eat/play/wake and interaction joy. Release restores the underlying
      // pre-drag state (idle/think), rather than resuming the interrupted play action.
      transient = null
      transientUntil = 0
      joyUntil = 0
      layoutStatus() // Hide status during dragging to avoid a flickering card. Assets face left: flip=1 faces
      // left, flip=-1 mirrors right. Follow horizontal drag direction: left drag faces left and
      // right drag faces right.
      const nextFlip = facingFromDrag(e.clientX - lastPointerX, flip)
      if (nextFlip !== flip) {
        flip = nextFlip
        const dragCfg = stateOf(character, 'drag')
        if (animState === 'drag' && dragCfg && loaded.has(sheetKey(dragCfg.sheet))) showSprite('drag', dragCfg)
        applyHitArea() // Mirror hit bounds when drag direction changes.
      }
    }
    lastPointerX = e.clientX
    if (!moved) return
    const x = Math.max(0, Math.min(e.clientX - offsetX, window.innerWidth - host.offsetWidth))
    const y = Math.max(0, Math.min(e.clientY - offsetY, window.innerHeight - host.offsetHeight))
    host.style.left = `${x}px`
    host.style.top = `${y}px`
    host.style.right = 'auto'
    host.style.bottom = 'auto'
    if (menu.classList.contains('open')) layoutMenu() // The menu follows the pet; re-clamp after movement.
  })
  hitarea.addEventListener('pointerup', (e) => {
    pressed = false
    dragging = false
    const wasMoved = moved // Snapshot moved before this handler resets it; use the snapshot for menu decisions.
    if (hitarea.hasPointerCapture(e.pointerId)) hitarea.releasePointerCapture(e.pointerId)
    if (wasMoved) {
      savePos() // Persist position when dragging ends.
      dragReleaseUntil = Date.now() + DRAG_RELEASE_MS // Release buffer: briefly return to idle.
      releaseInteraction() // Release signals user presence: reset idle timing and wake a sleeping pet instead of
      // immediately sleeping again.
      moved = false // Cleanup is complete: releasePointerCapture triggers lostpointercapture; reset moved to
      // prevent duplicate cleanup.
    }
    layoutStatus() // Restore the status card after dragging when still hovered.
    if (chatOpen) positionChat() // Keep the chat input attached after moving the pet. Menu-button clicks run their action
    // without toggling the menu.
    if (!wasMoved && !(e.target instanceof Element && e.target.closest('button'))) toggleMenu()
  })
  // System-interrupted dragging (pointercancel, stolen capture, removed element) uses the same
  // release cleanup: idle buffer and reset presence timing prevent stuck drag state and instant
  // sleeping.
  const onDragAbort = () => {
    pressed = false
    dragging = false
    if (moved) {
      dragReleaseUntil = Date.now() + DRAG_RELEASE_MS
      releaseInteraction()
      moved = false
    }
    layoutStatus()
    if (chatOpen) positionChat()
  }
  hitarea.addEventListener('pointercancel', onDragAbort)
  // Reset when the system forcibly releases capture, such as element removal or another element
  // taking capture, to avoid a stuck drag state.
  hitarea.addEventListener('lostpointercapture', onDragAbort)
  // Keyboard accessibility: Enter/Space toggle the menu, Escape closes it, and outside clicks
  // dismiss it.
  stage.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault()
      interactFromSleep = animState === 'sleep' // Keyboard menu opening uses the visual state at interaction start for waking too.
      toggleMenu(true, { focus: true })
    }
  })
  const onDocPointerDown = (e: PointerEvent) => {
    if (host.contains(e.target as Node) || (chatEl !== null && chatEl.contains(e.target as Node))) return
    toggleMenu(false)
    if (composerVisible()) closeChat()
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    const menuOpen = menu.classList.contains('open')
    toggleMenu(false, { restoreFocus: menuOpen })
    closeChat()
  }
  document.addEventListener('pointerdown', onDocPointerDown)
  document.addEventListener('keydown', onKeyDown)
  // Close the menu on interaction: both it (offsetY 12) and reply bubbles (offsetY 8) sit above the
  // pet and would overlap. Closing first keeps action-to-animation feedback clear.
  statusBtn.addEventListener('click', askSessionStatus)
  settingsBtn.addEventListener('click', () => {
    toggleMenu(false)
    closeChat()
    try {
      if (ctx.pluginNavigation === undefined) throw new Error('Plugin navigation unavailable')
      ctx.pluginNavigation.openBundle(SETTINGS_NAMESPACE)
    } catch {
      showReply('⚙️ Не удалось открыть настройки. Открой «Плагины» → «Кит-девочка».')
    }
  })
  hitarea.addEventListener('contextmenu', (event) => { event.preventDefault(); toggleMenu(true, { focus: true }) })
  feedBtn.addEventListener('click', () => { toggleMenu(false); void interact('feed') })
  playBtn.addEventListener('click', () => { toggleMenu(false); void interact('play') })
  chatBtn.addEventListener('click', () => { toggleMenu(false); toggleChat() })
  newsBtn.addEventListener('click', () => {
    toggleMenu(false)
    if (!chatEnabled()) return
    if (!chatOpen) openChat()
    if (chatInput === null) return
    chatInput.value = 'Расскажи свежие новости'
    void sendChat()
  })

  // Public CustomEvent contract for third-party display integrations; detail schemas are in
  // docs/architecture-evolution.md. whale-girl:say { text } displays a bubble; whale-girl:fx {
  // type: 'hearts' } emits hearts; whale-girl:status { text } temporarily overrides the status
  // note, restoring it after 2.5 s. Dispatch via window.dispatchEvent(new
  // CustomEvent('whale-girl:say', { detail: { text } })). Events bubble through document without
  // third-party imports of whale-girl; validate detail before consumption.
  const onPetSay = (e: Event) => {
    if (!(e instanceof CustomEvent)) return
    if (e.detail && typeof e.detail.text === 'string' && e.detail.text.length > 0) showReply(e.detail.text)
  }
  const onPetFx = (e: Event) => {
    if (!(e instanceof CustomEvent)) return
    if (e.detail?.type === 'hearts') spawnHearts()
  }
  const onPetStatus = (e: Event) => {
    if (!(e instanceof CustomEvent)) return
    if (e.detail && typeof e.detail.text === 'string') {
      metaNote.textContent = e.detail.text
      // Overridden text changes measured width; re-clamp visible cards so longer notes cannot
      // overflow viewport edges.
      if (status.style.visibility === 'visible') layoutStatus()
      setTimeout(() => {
        if (metaNote.textContent === e.detail.text) renderStatus()
      }, 2500)
    }
  }
  document.addEventListener('whale-girl:say', onPetSay)
  document.addEventListener('whale-girl:fx', onPetFx)
  document.addEventListener('whale-girl:status', onPetStatus)

  // Walking: periodically stroll along the bottom of the viewport.
  const stopWalk = () => {
    walking = false
    if (walkRaf !== null) {
      cancelAnimationFrame(walkRaf)
      walkRaf = null
    }
    scheduleWander()
  }
  const scheduleWander = () => {
    clearTimeout(wanderTimer ?? undefined)
    if (!host.isConnected) return // Do not create a new timer after the pet is disposed.
    if (!cfg.walk.enabled) return // walk.enabled=false disables scheduling.
    const wait = cfg.walk.minWaitMs + Math.random() * (cfg.walk.maxWaitMs - cfg.walk.minWaitMs)
    wanderTimer = setTimeout(() => {
      if (sleeping || sessionMood.thinking || sessionMood.waiting || chatOpen || dragging) {
        scheduleWander() // Do not walk while sleeping, sessions are active, chatting, or dragging; reschedule
        // instead.
        return
      }
      wander()
    }, wait)
  }
  const wander = () => {
    // Chat/dragging cancel a walk before its first coordinate write; clearing right/bottom without
    // left/top would jump to the upper-left corner. Never move a disposed host: timers can fire
    // after host.remove().
    if (!host.isConnected || chatOpen || dragging) return
    walking = true
    walkDir = Math.random() < 0.5 ? 1 : -1
    // Assets face left. Walking right (walkDir=1) requires flip=-1; walking left uses flip=1.
    flip = -walkDir
    // walk may already be active, so setState can short-circuit. Refresh the sprite transform
    // explicitly or it retains the previous walk's facing direction.
    const walkCfg = stateOf(character, 'walk')
    if (animState === 'walk' && walkCfg && loaded.has(sheetKey(walkCfg.sheet))) showSprite('walk', walkCfg)
    applyHitArea() // Mirror the hit area when walk direction changes.
    const duration = cfg.walk.minMs + Math.random() * (cfg.walk.maxMs - cfg.walk.minMs)
    const start = performance.now()
    const maxX = Math.max(0, window.innerWidth - host.offsetWidth)
    const maxY = Math.max(0, window.innerHeight - host.offsetHeight)
    // Start from the current position without jumping: preserve top and start at left.
    // getBoundingClientRect supplies actual coordinates for the default right/bottom anchor too.
    const rect = host.getBoundingClientRect()
    const startLeft = Math.min(Math.max(rect.left, 0), maxX)
    const startTop = Math.min(Math.max(rect.top, 0), maxY)
    // Set pixel coordinates before the first frame so walking cannot jump even if stopped
    // immediately.
    host.style.left = `${startLeft}px`
    host.style.top = `${startTop}px`
    host.style.right = 'auto'
    host.style.bottom = 'auto'
    const step = (t: number) => {
      if (sleeping || dragging || sessionMood.thinking || sessionMood.waiting || chatOpen) {
        stopWalk()
        return
      }
      const x = startLeft + walkDir * cfg.walk.speedPxPerSec * ((t - start) / 1000)
      if (x <= 0 || x >= maxX || t - start >= duration) {
        host.style.left = `${Math.min(maxX, Math.max(0, x))}px`
        host.style.top = `${startTop}px`
        stopWalk()
        return
      }
      host.style.left = `${x}px`
      host.style.top = `${startTop}px`
      walkRaf = requestAnimationFrame(step)
    }
    walkRaf = requestAnimationFrame(step)
  }

  // Working interlude scheduler (v3): think is normal companionship; occasional working poses have
  // random delays and durations. Pure nextWorkingRhythm accepts randomness and is unit-testable;
  // this layer executes each scheduled transition, then chooses the next. Inactive sessions disarm
  // it, return to think, and wait for refresh to arm it again. Preserve pending decisions: refresh
  // runs every pollMs, and continually rescheduling the 12-30 s delay would postpone working
  // forever (observed in manual testing).
  const armWorking = () => {
    if (!sessionMood.thinking) {
      if (workingTimer !== null) clearTimeout(workingTimer)
      workingTimer = null
      working = { active: false, until: 0 } // Inactive session: disarm the interlude.
      return
    }
    if (workingTimer !== null) return // A decision is pending: preserve it so refresh cannot postpone activation.
    const decision = nextWorkingRhythm({ now: Date.now(), sessionThink: true, working, random: Math.random })
    const delay = Math.max(0, decision.until - Date.now())
    workingTimer = setTimeout(() => {
      workingTimer = null
      working = { active: decision.active, until: 0 } // Enter the decision's target state.
      armWorking() // Choose the next decision from the new state: think->working->think.
    }, delay)
  }

  // Startup first reads enabled before starting timers; disabled web rendering disposes
  // immediately. Users can disable the web pet while an external HTTP desktop companion runs. Mount
  // remains hidden to avoid flashing; applyClientConfig handles live changes.
  let animTimer: ReturnType<typeof setTimeout> | null = null
  let sse: EventSource | null = null
  const boot = async () => {
    const config = await fetchConfig()
    if (config !== null && config.enabled === false) {
      disposePet()
      return
    }
    if (config !== null) applyClientConfig(config)
    host.style.display = ''
    loadAssets()
    refresh()
    pollTimer = setInterval(refresh, cfg.pollMs)
    animTimer = setInterval(tick, TICK_MS)
    scheduleWander()
    armWorking()
    // SSE (v9): Node events trigger immediate refresh(), reducing celebration/welcome/thinking
    // latency from pollMs (default 3 s) to one /state round trip. EventSource reconnects
    // automatically with 3 s retries; polling remains a fallback when SSE is unavailable.
    try {
      sse = new EventSource(EVENTS_PATH)
      sse.onmessage = () => refresh()
      // EventSource reconnects automatically; polling maintains pet updates during reconnection.
    } catch {
      // If EventSource is unavailable, polling keeps the pet running.
    }
  }
  boot()

  // Test seam for scripts/verify-client-behavior.mjs chat-inline. Real wandering waits 18-40 s and
  // active sessions suppress it, so probes need deterministic walk-now/stop controls. Expose this
  // global only with the whale-girl-test=1 URL flag, never during normal operation.
  let testFlag = false
  try {
    testFlag = new URLSearchParams(window.location.search).has('whale-girl-test')
      || window.sessionStorage.getItem('whale-girl-test') === '1'
  } catch { /* Private mode without sessionStorage simply disables the test flag. */ }
  if (testFlag) {
    window.__whaleGirlTest = {
      walkNow: () => {
        sleeping = false
        sessionMood = { thinking: false, waiting: false, titles: [] }
        wander()
      },
      stopWalk,
      position: () => {
        const rect = host.getBoundingClientRect()
        return { left: Math.round(rect.left), top: Math.round(rect.top) }
      },
      isChatOpen: () => chatOpen,
      isWalking: () => walking,
    }
  }

  // Session awareness (v8): Node aggregates think/wait/turn completion into /state
  // (act.sessionThink/sessionWait/turnCompleted). The old root-local session subscription had no
  // usable ctx in self-rendered mode and is retired. The selected conversation identity now comes
  // from sessions.list.
  armWorking() // Initially arm working interludes; refresh subsequently responds to sessionMood changes.

  // Refresh immediately on returning to the foreground because background polling is throttled.
  // Suspend JS polling/animation timers while hidden, alongside browser-suspended rAF, avoiding
  // CPU/battery waste. Recreate timers and refresh immediately on return.
  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      if (pollTimer === null) pollTimer = setInterval(refresh, cfg.pollMs)
      if (animTimer === null) animTimer = setInterval(tick, TICK_MS)
      refresh()
    } else {
      if (pollTimer !== null) { clearInterval(pollTimer ?? undefined); pollTimer = null }
      if (animTimer !== null) { clearInterval(animTimer); animTimer = null }
    }
  }
  document.addEventListener('visibilitychange', onVisibility)

  // On resize, clamp dragged positions into the viewport and recalculate status-card layout for the
  // new boundaries.
  const onResize = () => {
    if (host.style.left) {
      // Clamp dragged positions; the default bottom-right anchor needs no adjustment.
      const x = Math.max(0, Math.min(parseFloat(host.style.left) || 0, window.innerWidth - host.offsetWidth))
      const y = Math.max(0, Math.min(parseFloat(host.style.top) || 0, window.innerHeight - host.offsetHeight))
      host.style.left = `${x}px`
      host.style.top = `${y}px`
    }
    layoutStatus()
    if (menu.classList.contains('open')) layoutMenu()
    if (chatOpen) positionChat()
  }
  window.addEventListener('resize', onResize)

  // Hide the pet during DSH onboarding or desktop-companion presence using display:none, avoiding
  // obstruction/duplicates. Visible dialogs make it inert and translucent. Detect onboarding by the
  // exact deepseek-onboarding-title ID, not broad class-name substring matching that could hide
  // unrelated elements. companionOnline comes from the /state heartbeat window and expires
  // automatically.
  let pageHidden: 'onboarding' | 'companion' | 'dialog' | null = null
  let companionOnline = false
  // Pet-owned dialogs, including chat, do not dim the pet. Treating its chat as a foreign
  // role=dialog previously reduced opacity to .25. Only other visible dialogs make it inert.
  const ownDialogs = () => Array.from(document.querySelectorAll('[role="dialog"]')).map((element) => ({
    ownedByPet: element.closest('[data-whale-girl-chat],[data-whale-girl]') !== null,
    visible: element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true',
  }))
  const syncInert = () => {
    const dialog = shouldDimForDialogs(ownDialogs())
    const onboarding = document.getElementById('deepseek-onboarding-title') !== null
      || document.querySelector('[aria-labelledby="deepseek-onboarding-title"]') !== null
    const next = onboarding ? 'onboarding' : companionOnline ? 'companion' : dialog ? 'dialog' : null
    if (next !== pageHidden) {
      pageHidden = next
      if (next === 'onboarding' || next === 'companion') {
        if (chatOpen) closeChat()
        host.setAttribute('data-whale-girl-hidden', '')
        host.removeAttribute('data-whale-girl-inert')
        // Inline styles are authoritative; the host may remove CSS rules while leaving attributes
        // present without visual effect.
        host.style.display = 'none'
        host.style.opacity = ''
      } else if (next === 'dialog') {
        host.removeAttribute('data-whale-girl-hidden')
        host.style.display = ''
        host.setAttribute('data-whale-girl-inert', '')
        host.style.opacity = '.6' // Use .6 opacity for inert state, preserving visibility even if injected CSS is removed.
      } else {
        host.removeAttribute('data-whale-girl-inert')
        host.removeAttribute('data-whale-girl-hidden')
        host.style.display = ''
        host.style.opacity = ''
      }
    }
  }
  const dialogObserver = new MutationObserver(syncInert)
  dialogObserver.observe(document.body, { childList: true, subtree: true })
  syncInert()

  // Idempotent web-pet disposal for enabled=false: timers, listeners, and nodes can be cleaned
  // repeatedly. Keep the settings card mounted: it is the only UI for enabled, and removing it
  // would make disabled state impossible to reverse even after reload (see the defect review).
  const disposePet = () => {
    clearInterval(pollTimer ?? undefined)
    if (animTimer !== null) clearInterval(animTimer)
    if (sse !== null) sse.close()
    clearTimeout(wanderTimer ?? undefined)
    if (workingTimer !== null) clearTimeout(workingTimer)
    if (walkRaf !== null) cancelAnimationFrame(walkRaf)
    for (const t of bubbleTimers) clearTimeout(t) // Clear leftover bubble timers too.
    bubbleTimers.clear()
    clearBubble() // Clear the active bubble reference; host.remove() removes its DOM.
    dialogObserver.disconnect()
    offMenuKeyboard()
    document.removeEventListener('pointerdown', onDocPointerDown)
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('visibilitychange', onVisibility)
    document.removeEventListener('whale-girl:say', onPetSay)
    document.removeEventListener('whale-girl:fx', onPetFx)
    document.removeEventListener('whale-girl:status', onPetStatus)
    host.removeEventListener('mouseenter', onHostEnter)
    host.removeEventListener('mouseleave', onHostLeave)
    window.removeEventListener('resize', onResize)
    closeChat()
    clearTimeout(wanderTimer ?? undefined) // closeChat reschedules walking; disposal must clear that new timer.
    wanderTimer = null
    stopSpeaking()
    if (chatEl !== null) {
      chatEl.remove()
      chatEl = null
      chatInput = null
      chatMic = null
    }
    host.remove()
    style.remove()
  }
  // Whole-plugin unload/rebuild removes both pet and settings card.
  const dispose = () => {
    disposePet()
    if (offSettings !== null) { offSettings(); offSettings = null }
  }
  return dispose
}

// Standard bundle client (0811): exports { name, apply } register via __ModuleLoader__.load; the
// client kernel calls apply(ctx) on mount, using these exports as its Cordis entry. The pet itself
// uses only DOM. Declared injected settings-card services are slots/locale for
// plugins.bundle.config and configForms for scope transport, always available in the web
// composition. apply guards optional registration so a failed card does not stop the pet.
export const name = 'whale-girl'
export const inject = ['slots', 'locale', 'configForms', 'sessions', 'pluginNavigation']
