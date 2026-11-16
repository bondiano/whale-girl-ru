// Pure client logic regressions: emotions derive from event bursts and interaction joy,
// without hunger or persistent negative-mood state.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickState, TRANSIENT_MS, WAKE_MS, JOY_MS, ROUND_CELEBRATE_MS, STATE_NAMES, PLAYBACK_MODES, PLAYBACK_MIN_FRAMES, deriveSessionMood, STATE_TABLE, nextWorkingRhythm, detectTurnCompleted, shouldWake, nextBlinkAt, nextFacingAt, facingFromDrag, wakeFromInteraction, memoryLine, pickPhrase, nextChatterAt, CHATTER_MIN_MS, CHATTER_MAX_MS, shouldDimForDialogs, voiceErrorMessage, chatBubbleDuration } from '../dist/client/logic.js'

const IDLE = { activity: { name: 'idle', until: 0 }, dragging: false, transient: null, sleeping: false, joyUntil: 0, now: 1000 }

test('拖拽优先于一切', () => {
  assert.equal(pickState({ ...IDLE, dragging: true, transient: 'eat' }), 'drag')
})

test('临时状态结束后回到当前底层状态', () => {
  assert.equal(pickState({ ...IDLE, activity: { name: 'working', until: 0 }, transient: 'wake' }), 'wake')
  assert.equal(pickState({ ...IDLE, activity: { name: 'celebrate', until: 5000 }, transient: 'wake' }), 'celebrate')
  assert.equal(pickState({ ...IDLE, workingActive: true, transient: null }), 'working')
  assert.equal(pickState({ ...IDLE, transient: null, sleeping: true }), 'sleep')
})

test('walk 游走只在无事件反馈时生效', () => {
  assert.equal(pickState({ ...IDLE, walking: true }), 'walk')
  assert.equal(pickState({ ...IDLE, walking: true, transient: 'eat' }), 'eat')
})

test('任务事件与互动优先于 walk，游走不遮住反馈动画', () => {
  assert.equal(pickState({ ...IDLE, activity: { name: 'celebrate', until: 5000 }, walking: true }), 'celebrate')
  assert.equal(pickState({ ...IDLE, workingActive: true, walking: true }), 'working')
  assert.equal(pickState({ ...IDLE, transient: 'play', walking: true }), 'play')
  assert.equal(pickState({ ...IDLE, walking: true }), 'walk')
})

test('瞬发 transient 覆盖派生状态（eat/play/wake）', () => {
  assert.equal(pickState({ ...IDLE, transient: 'eat' }), 'eat')
  assert.equal(pickState({ ...IDLE, transient: 'play' }), 'play')
  assert.equal(pickState({ ...IDLE, transient: 'wake' }), 'wake')
})

test('wake 使用独立的较长过渡时长', () => {
  assert.equal(TRANSIENT_MS, 1500)
  assert.equal(WAKE_MS, 3000)
  assert.ok(WAKE_MS > TRANSIENT_MS)
})

test('burst 在窗口内生效、过期后回退（welcome/celebrate/error/disappointed）', () => {
  assert.equal(pickState({ ...IDLE, activity: { name: 'welcome', until: 2000 } }), 'welcome')
  assert.equal(pickState({ ...IDLE, activity: { name: 'celebrate', until: 2000 } }), 'celebrate')
  assert.equal(pickState({ ...IDLE, activity: { name: 'error', until: 2000 } }), 'error')
  assert.equal(pickState({ ...IDLE, activity: { name: 'disappointed', until: 2000 } }), 'disappointed')
  assert.notEqual(pickState({ ...IDLE, activity: { name: 'celebrate', until: 500 } }), 'celebrate')
})

test('working 与 sleeping', () => {
  assert.equal(pickState({ ...IDLE, workingActive: true }), 'working')
  assert.equal(pickState({ ...IDLE, sleeping: true }), 'sleep')
})

test('joy 在互动后窗口内生效、过期回 idle', () => {
  assert.equal(pickState({ ...IDLE, joyUntil: 1500 }), 'joy')
  assert.notEqual(pickState({ ...IDLE, joyUntil: 800 }), 'joy')
  assert.equal(pickState(IDLE), 'idle')
})

test('零负反馈：pet 不再驱动状态（无 hunger/mood 分支）', () => {
  assert.equal(pickState({ ...IDLE, pet: { hunger: 90, mood: 0 } }), 'idle')
})

test('确定性：显式 now 时相同输入相同输出', () => {
  assert.deepEqual(pickState(IDLE), pickState(IDLE))
})

test('TRANSIENT_MS/JOY_MS 与 STATE_NAMES 完整性（15 状态全量契约）', () => {
  assert.equal(TRANSIENT_MS, 1500)
  assert.equal(JOY_MS, 1600)
  assert.equal(ROUND_CELEBRATE_MS, 4000) // Turn-completion celebration window.
  assert.deepEqual(
    [...STATE_NAMES].sort(),
    ['idle', 'working', 'celebrate', 'error', 'disappointed', 'joy', 'eat', 'play', 'drag', 'walk', 'sleep', 'wake', 'welcome', 'think', 'wait'].sort(),
  )
})

test('PLAYBACK_MODES：封闭枚举 + 帧数下限（播放器数据驱动契约）', () => {
  assert.deepEqual([...PLAYBACK_MODES].sort(), ['blink', 'loop', 'once', 'pingpong'].sort())
  // Minimum frames: loop>=1, pingpong>=2, once>=1, blink>=2.
  assert.equal(PLAYBACK_MIN_FRAMES.loop, 1)
  assert.equal(PLAYBACK_MIN_FRAMES.pingpong, 2)
  assert.equal(PLAYBACK_MIN_FRAMES.once, 1)
  assert.equal(PLAYBACK_MIN_FRAMES.blink, 2)
})

test('会话感知：等待批准 wait 优先于思考陪伴 think（都需要用户注意）', () => {
  // At now=2500, the thinking phase provides session companionship.
  assert.equal(pickState({ ...IDLE, sessionThink: true, now: 2500 }), 'think')
  assert.equal(pickState({ ...IDLE, sessionWait: true }), 'wait')
  assert.equal(pickState({ ...IDLE, sessionThink: true, sessionWait: true }), 'wait')
})

test('会话感知：思考陪伴覆盖 sleep/walk/joy（会话活跃时保持清醒陪伴）', () => {
  // Use the thinking phase to verify companionship outranks sleep, wandering, and joy.
  assert.equal(pickState({ ...IDLE, sessionThink: true, sleeping: true, now: 2500 }), 'think')
  assert.equal(pickState({ ...IDLE, sessionThink: true, walking: true, now: 2500 }), 'think')
  assert.equal(pickState({ ...IDLE, sessionThink: true, joyUntil: 1500, now: 2500 }), 'think')
})

test('工作陪伴（v3）：workingActive 插曲 > think 常态，不依赖 activity', () => {
  // think is the normal session-thinking state, independent of idle server activity.
  assert.equal(pickState({ ...IDLE, sessionThink: true, activity: { name: 'idle', until: 0 } }), 'think')
  // An active working interlude outranks think.
  assert.equal(pickState({ ...IDLE, sessionThink: true, workingActive: true }), 'working')
  // Without sessionThink, disable working interludes; tasks alone do not activate them.
  assert.equal(pickState({ ...IDLE, workingActive: true, sessionThink: false }), 'working')
  assert.equal(pickState({ ...IDLE, activity: { name: 'working', until: 0 } }), 'idle')
})

test('回合完成庆祝（v3）：celebrateUntil 窗口内播 celebrate，且不抢互动/等待', () => {
  // Turn completion celebrates above think and working companionship.
  assert.equal(pickState({ ...IDLE, sessionThink: true, celebrateUntil: 2000, now: 1000 }), 'celebrate')
  assert.equal(pickState({ ...IDLE, celebrateUntil: 2000, now: 1000 }), 'celebrate')
  // After the celebration window, return to the underlying thinking state.
  assert.equal(pickState({ ...IDLE, sessionThink: true, celebrateUntil: 500, now: 1000 }), 'think')
  // User feeding plays eat before turn-completion celebration.
  assert.equal(pickState({ ...IDLE, transient: 'eat', celebrateUntil: 2000, now: 1000 }), 'eat')
  // Approval waiting retains priority because it needs user attention.
  assert.equal(pickState({ ...IDLE, sessionWait: true, celebrateUntil: 2000, now: 1000 }), 'wait')
})

test('会话感知：事件反馈与用户互动仍优先于陪伴状态（不抢戏）', () => {
  assert.equal(pickState({ ...IDLE, sessionThink: true, transient: 'eat' }), 'eat')
  assert.equal(pickState({ ...IDLE, sessionWait: true, transient: 'wake' }), 'wake')
  assert.equal(pickState({ ...IDLE, sessionThink: true, activity: { name: 'celebrate', until: 5000 } }), 'celebrate')
  assert.equal(pickState({ ...IDLE, sessionWait: true, dragging: true }), 'drag')
})

test('deriveSessionMood：多会话聚合——任一 running 即思考、任一 pending 即等待、标题收集', () => {
  const snap = {
    current: 's2',
    byId: {
      s1: { displayTitle: '甲', running: true },
      s2: { displayTitle: '乙', running: false, pendingInteraction: 'approval' },
      s3: { displayTitle: '丙', running: false },
    },
  }
  const mood = deriveSessionMood(snap)
  assert.equal(mood.thinking, true)
  assert.equal(mood.waiting, true)
  assert.deepEqual(mood.titles, ['甲'])
})

test('deriveSessionMood：空/未就绪快照与缺字段行安全（服务不可用降级）', () => {
  assert.deepEqual(deriveSessionMood(undefined), { thinking: false, waiting: false, titles: [] })
  assert.deepEqual(deriveSessionMood({ byId: {} }), { thinking: false, waiting: false, titles: [] })
  const mood = deriveSessionMood({ byId: { s1: { running: false }, s2: null } })
  assert.equal(mood.thinking, false)
  assert.equal(mood.waiting, false)
  assert.deepEqual(mood.titles, [])
  // Any approval, plan-review, or question pending value counts as waiting.
  for (const p of ['approval', 'plan-review', 'question']) {
    assert.equal(deriveSessionMood({ byId: { s1: { pendingInteraction: p } } }).waiting, true)
  }
})

test('STATE_TABLE 文法单源：表内状态全部在 STATE_NAMES，idle 兜底在末行', () => {
  const last = STATE_TABLE[STATE_TABLE.length - 1]
  assert.equal(last.state, 'idle') // The fallback row must remain last.
  assert.equal(last.when({}), true) // Always matches.
  for (const row of STATE_TABLE) {
    // Dynamic burst resolutions must also belong to STATE_NAMES.
    for (const s of ['welcome', 'celebrate', 'error', 'disappointed']) assert.ok(STATE_NAMES.includes(s))
    if (row.state !== 'burst') assert.ok(STATE_NAMES.includes(row.state), `STATE_TABLE 状态 ${row.state} 不在 STATE_NAMES`)
  }
})

test('STATE_TABLE 行序即优先级：手动验证关键竞争', () => {
  // drag wins even when every other condition matches.
  assert.equal(pickState({ ...IDLE, dragging: true, transient: 'eat', sessionWait: true, sleeping: true, walking: true }), 'drag')
  // An active welcome burst outranks an eat transient.
  assert.equal(pickState({ ...IDLE, activity: { name: 'welcome', until: 5000 }, transient: 'eat' }), 'welcome')
  // wait > think > working
  assert.equal(pickState({ ...IDLE, sessionWait: true, sessionThink: true, activity: { name: 'working', until: 0 } }), 'wait')
  // Active-session thinking outranks sleep; use the thinking phase.
  assert.equal(pickState({ ...IDLE, sessionThink: true, sleeping: true, now: 2500 }), 'think')
  // Turn-completion celebration ranks below wait and above think.
  assert.equal(pickState({ ...IDLE, sessionThink: true, celebrateUntil: 2000, now: 1000 }), 'celebrate')
})

test('STATE_TABLE 全序由 verify-spec-states 门禁守护（state-machine.md 优先级列表 ↔ 行序）', () => {
  // The gate checks documented priority against STATE_TABLE, avoiding a third
  // copy of the order here. Assert only a nonempty table, dynamic burst row, and final idle fallback.
  assert.ok(STATE_TABLE.length >= 10)
  assert.equal(STATE_TABLE.some((r) => r.state === 'burst' && typeof r.resolve === 'function'), true)
  const last = STATE_TABLE[STATE_TABLE.length - 1]
  assert.equal(last.state, 'idle')
  assert.equal(last.when({}), true)
})

test('拖拽放下缓冲：dragReleaseUntil 内短暂回 idle，再进入底层状态', () => {
  // The release buffer holds idle even when thinking or working companionship is active.
  assert.equal(pickState({ ...IDLE, dragReleaseUntil: 2500, now: 1000, sessionThink: true, workingActive: true }), 'idle')
  // After the buffer expires, working interludes outrank think.
  assert.equal(pickState({ ...IDLE, dragReleaseUntil: 2500, now: 3000, sessionThink: true, workingActive: true }), 'working')
  assert.equal(pickState({ ...IDLE, dragReleaseUntil: 2500, now: 3000, sessionThink: true, workingActive: false }), 'think')
})

// Deterministic scheduling functions receive explicit time and random sources.

test('nextWorkingRhythm：会话不活跃时插曲撤防', () => {
  assert.deepEqual(
    nextWorkingRhythm({ now: 1000, sessionThink: false, working: { active: true, until: 2000 } }),
    { active: false, until: 0 },
  )
})

test('nextWorkingRhythm：think 常态 → 随机间隔后插 working（区间边界用注入随机源）', () => {
  const base = { now: 1000, sessionThink: true, working: { active: false, until: 0 } }
  // r=0 selects the shortest wait; r approaching 1 approaches the longest, independent of rounding.
  const min = nextWorkingRhythm({ ...base, random: () => 0 })
  assert.equal(min.active, true)
  assert.equal(min.until, 1000 + 12000) // WORKING_MIN_WAIT_MS
  const max = nextWorkingRhythm({ ...base, random: () => 0.999 })
  assert.equal(max.active, true)
  assert.ok(max.until >= 1000 + 12000 && max.until <= 1000 + 30000) // WORKING_MAX_WAIT_MS interval.
})

test('nextWorkingRhythm：working 中 → 随机时长后回 think', () => {
  const base = { now: 5000, sessionThink: true, working: { active: true, until: 6000 } }
  const short = nextWorkingRhythm({ ...base, random: () => 0 })
  assert.equal(short.active, false)
  assert.equal(short.until, 5000 + 2500) // WORKING_MIN_DUR_MS
  const long = nextWorkingRhythm({ ...base, random: () => 0.999 })
  assert.equal(long.active, false)
  assert.ok(long.until >= 5000 + 2500 && long.until <= 5000 + 6000) // WORKING_MAX_DUR_MS interval.
})

test('detectTurnCompleted：running true→false 边沿 → flips（含当前/子会话）', () => {
  const snap1 = { byId: { s1: { displayTitle: '甲', running: true }, s2: { running: false } } }
  const first = detectTurnCompleted(snap1, new Map())
  assert.deepEqual(first.flips, []) // The initial snapshot seeds the state map without triggering edges.
  assert.equal(first.prevRunning.get('s1'), true)
  assert.equal(first.prevRunning.get('s2'), false)
  // Only s1's running-to-idle transition emits an edge; unchanged s2 does not.
  const snap2 = { byId: { s1: { displayTitle: '甲', running: false }, s2: { running: false } } }
  const second = detectTurnCompleted(snap2, first.prevRunning)
  assert.deepEqual(second.flips.map((f) => f.id), ['s1'])
  // A repeated idle snapshot has no new edge.
  const third = detectTurnCompleted(snap2, second.prevRunning)
  assert.deepEqual(third.flips, [])
  // A new running/completed cycle emits another turn edge.
  const snap3 = { byId: { s1: { displayTitle: '甲', running: true } } }
  const fourth = detectTurnCompleted(snap3, third.prevRunning)
  assert.deepEqual(fourth.flips, [])
  const fifth = detectTurnCompleted({ byId: { s1: { running: false } } }, fourth.prevRunning)
  assert.deepEqual(fifth.flips.map((f) => f.id), ['s1'])
})

test('detectTurnCompleted：空/损坏快照安全 + 缺行清理', () => {
  assert.deepEqual(detectTurnCompleted(undefined, new Map()).flips, [])
  assert.deepEqual(detectTurnCompleted({ byId: {} }, new Map()).flips, [])
  const r = detectTurnCompleted({ byId: { s1: null } }, new Map())
  assert.deepEqual(r.flips, [])
  // Remove deleted sessions from the state map so reopening cannot reuse stale bits.
  const prev = new Map([['s1', true], ['s2', false]])
  const after = detectTurnCompleted({ byId: { s2: { running: false } } }, prev)
  assert.equal(after.prevRunning.has('s1'), false)
  assert.equal(after.prevRunning.get('s2'), false)
})

test('shouldWake：sleep→非 sleep 且非拖拽/无瞬发 → 播 wake', () => {
  assert.equal(shouldWake('sleep', 'think', {}), true)
  assert.equal(shouldWake('sleep', 'working', {}), true)
  // Do not wake while still sleeping or when the previous state was not sleep.
  assert.equal(shouldWake('sleep', 'sleep', {}), false)
  assert.equal(shouldWake('think', 'idle', {}), false)
  // Dragging or an occupied transient suppresses wake playback.
  assert.equal(shouldWake('sleep', 'think', { dragging: true }), false)
  assert.equal(shouldWake('sleep', 'think', { transient: 'eat' }), false)
})

test('nextBlinkAt：随机间隔内返回下次眨眼时刻（区间边界用注入随机源）', () => {
  // r=0 selects the shortest interval; r approaching 1 approaches the longest.
  const min = nextBlinkAt({ now: 1000, random: () => 0 })
  assert.equal(min, 1000 + 3000) // BLINK_MIN_INTERVAL_MS
  const max = nextBlinkAt({ now: 1000, random: () => 0.999 })
  assert.ok(max >= 1000 + 3000 && max <= 1000 + 9000) // BLINK_MAX_INTERVAL_MS range; each call uses its own injected random value.
  const a = nextBlinkAt({ now: 0, random: () => 0.2 })
  const b = nextBlinkAt({ now: 0, random: () => 0.8 })
  assert.notEqual(a, b)
})

test('nextFacingAt：随机转身间隔（区间边界用注入随机源）', () => {
  const min = nextFacingAt({ now: 1000, random: () => 0 })
  assert.equal(min, 1000 + 10000) // FACING_MIN_INTERVAL_MS
  const max = nextFacingAt({ now: 1000, random: () => 0.999 })
  assert.ok(max >= 1000 + 10000 && max <= 1000 + 25000) // FACING_MAX_INTERVAL_MS range.
  const a = nextFacingAt({ now: 0, random: () => 0.2 })
  const b = nextFacingAt({ now: 0, random: () => 0.8 })
  assert.notEqual(a, b)
})

test('facingFromDrag：横向移动朝向随方向切换（素材朝左基准）', () => {
  for (const currentFlip of [1, -1]) {
    assert.equal(facingFromDrag(-20, currentFlip), 1)
    assert.equal(facingFromDrag(20, currentFlip), -1)
  }
})

test('facingFromDrag：纯纵向或重复坐标保持当前朝向', () => {
  for (const currentFlip of [1, -1]) {
    assert.equal(facingFromDrag(0, currentFlip), currentFlip)
    assert.equal(facingFromDrag(-0, currentFlip), currentFlip)
  }
})

test('facingFromDrag：左拖后纵移不转身，横向反转仍即时生效', () => {
  let flip = -1
  const actual = [-20, 0, 0, 10, 0, -5].map((deltaX) => {
    flip = facingFromDrag(deltaX, flip)
    return flip
  })
  assert.deepEqual(actual, [1, 1, 1, -1, -1, 1])
})

// Interaction wakefulness regressions prevent immediate sleep after release.

test('wakeFromInteraction：视觉非 sleep 交互 → 重置空闲、不播 wake', () => {
  // If the visible state is not sleep, an idle-time sleeping flag must not trigger wake.
  assert.deepEqual(wakeFromInteraction({ visuallySleeping: false }), { sleeping: false, wake: false })
})

test('wakeFromInteraction：视觉 sleep 动画中交互 → 重置空闲、附加 wake 醒觉过渡', () => {
  assert.deepEqual(wakeFromInteraction({ visuallySleeping: true }), { sleeping: false, wake: true })
})

test('醒觉判定绑定视觉 sleep 动画：sleeping 派生变量不参与（回归：非 sleep 动画拖拽不播 wake）', () => {
  // Wake eligibility uses the visual state at interaction start, not the derived
  // sleeping flag, which may remain true during visible session-thinking companionship.
  assert.equal(wakeFromInteraction({ visuallySleeping: false }).wake, false)
  assert.equal(wakeFromInteraction({ visuallySleeping: true }).wake, true)
})

test('交互醒觉集成：sleep → drag → 放下（sleeping 归零）→ 缓冲过期后不回 sleep', () => {
  // Releasing a pet picked up while visibly asleep clears sleeping and starts wake.
  const afterRelease = wakeFromInteraction({ visuallySleeping: true })
  assert.equal(afterRelease.sleeping, false)
  assert.equal(afterRelease.wake, true)
  // Wake overrides the release idle buffer for a pet picked up while sleeping.
  assert.equal(pickState({ ...IDLE, dragReleaseUntil: 2500, now: 1000, sleeping: afterRelease.sleeping, transient: 'wake' }), 'wake')
  // Dragging an awake pet still uses the idle release buffer.
  assert.equal(pickState({ ...IDLE, dragReleaseUntil: 2500, now: 1000, sleeping: false, transient: null }), 'idle')
  // Once buffer and wake finish, the cleared sleeping flag yields the underlying state.
  assert.equal(pickState({ ...IDLE, dragReleaseUntil: 2500, now: 3000, sleeping: afterRelease.sleeping, transient: null }), 'idle')
  assert.equal(pickState({ ...IDLE, dragReleaseUntil: 2500, now: 3000, sleeping: afterRelease.sleeping, transient: null, sessionThink: true }), 'think')
  // Regression control: an uncleared sleeping flag would immediately return to sleep.
  assert.equal(pickState({ ...IDLE, dragReleaseUntil: 2500, now: 3000, sleeping: true, transient: null }), 'sleep')
})

test('交互醒觉：feed/play 结束后同样不回 sleep（sleeping 已归零）', () => {
  // Interaction while visibly asleep resets idle time; eat and joy finish into the underlying state.
  const afterRelease = wakeFromInteraction({ visuallySleeping: true })
  assert.equal(pickState({ ...IDLE, sleeping: afterRelease.sleeping, joyUntil: 1500 }), 'joy')
  assert.equal(pickState({ ...IDLE, sleeping: afterRelease.sleeping, joyUntil: 800 }), 'idle')
  // Regression control: leaving sleeping set returns to sleep as soon as joy ends.
  assert.equal(pickState({ ...IDLE, sleeping: true, joyUntil: 800 }), 'sleep')
})

test('memoryLine：最近 2 条完成任务 + 超出条数报总数', () => {
  const line = memoryLine({
    distance: 0,
    tasks: [
      { label: '写测试', ok: true },
      { label: '修复路由', ok: true },
      { label: '重构', ok: true },
    ],
  })
  assert.equal(line, 'В прошлый раз вы выполнили «修复路由», «重构» — всего 3')
})

test('memoryLine：失败任务不进气泡；无可展示任务 → null', () => {
  assert.equal(memoryLine({ distance: 0, tasks: [{ label: 'X', ok: false }] }), null)
  assert.equal(memoryLine({ distance: 0, tasks: [] }), null)
  assert.equal(memoryLine(null), null)
  assert.equal(memoryLine(undefined), null)
  assert.equal(memoryLine({ distance: 0, tasks: 'junk' }), null)
})

test('memoryLine：fork 回读（distance>0）点明分支前；长标签截 16 字', () => {
  const line = memoryLine({ distance: 2, tasks: [{ label: '一二三四五六七八九十一二三四五六七八九', ok: true }] })
  assert.equal(line, 'В прошлой ветке вы выполнили «一二三四五六七八九十一二三四五六…»')
  assert.ok(!line.includes('一二三四五六七八九十一二三四五六七八九'), '完整长标签被截断')
})


test('pickPhrase: пустой/битый пул → null, иначе фраза из пула', () => {
  assert.equal(pickPhrase(null), null)
  assert.equal(pickPhrase([]), null)
  assert.equal(pickPhrase(['', '  ']), null)
  assert.equal(pickPhrase(['a']), 'a')
  const pool = ['a', 'b', 'c']
  assert.equal(pickPhrase(pool, { random: () => 0 }), 'a')
  assert.equal(pickPhrase(pool, { random: () => 0.99 }), 'c')
})

test('pickPhrase: не повторяет предыдущую фразу подряд', () => {
  const pool = ['a', 'b']
  assert.equal(pickPhrase(pool, { random: () => 0, avoid: 'a' }), 'b')
  assert.equal(pickPhrase(['a'], { random: () => 0, avoid: 'a' }), 'a', 'одна фраза — повтор допустим')
})

test('nextChatterAt: интервал в диапазоне CHATTER_MIN_MS..CHATTER_MAX_MS', () => {
  assert.equal(nextChatterAt({ now: 1000, random: () => 0 }), 1000 + CHATTER_MIN_MS)
  assert.equal(nextChatterAt({ now: 1000, random: () => 1 }), 1000 + CHATTER_MAX_MS)
})

test('shouldDimForDialogs: свой чат не гасит питомца, чужой видимый диалог — гасит', () => {
  assert.equal(shouldDimForDialogs([]), false)
  assert.equal(shouldDimForDialogs(null), false)
  assert.equal(shouldDimForDialogs([{ ownedByPet: true, visible: true }]), false, 'панель беседы принадлежит питомцу')
  assert.equal(shouldDimForDialogs([{ ownedByPet: false, visible: false }]), false, 'скрытый диалог не считается')
  assert.equal(shouldDimForDialogs([{ ownedByPet: false, visible: true }]), true)
  assert.equal(shouldDimForDialogs([
    { ownedByPet: true, visible: true },
    { ownedByPet: false, visible: false },
    { ownedByPet: false, visible: true },
  ]), true, 'хватает одного чужого видимого')
  assert.equal(shouldDimForDialogs([null, { ownedByPet: false, visible: true }]), true, 'null пропускается')
})

test('voiceErrorMessage：коды распознавания → понятный русский текст', () => {
  const codes = [
    'voice-disabled', 'voice-provider-browser', 'voice-config-missing', 'voice-base-url-invalid',
    'voice-audio-empty', 'stt-failed', 'not-allowed', 'service-not-allowed', 'no-speech',
    'audio-capture', 'network', 'aborted',
  ]
  for (const code of codes) {
    const message = voiceErrorMessage(code)
    assert.equal(typeof message, 'string', `${code}: строка`)
    assert.ok(message.length > 10, `${code}: не заглушка`)
    assert.notEqual(message, voiceErrorMessage('unknown'), `${code}: не общий дефолт`)
  }
  // Both not-allowed and service-not-allowed indicate microphone permission failure.
  assert.equal(voiceErrorMessage('not-allowed'), voiceErrorMessage('service-not-allowed'))
  assert.match(voiceErrorMessage('not-allowed'), /микрофон/i)
  // Unknown or empty error codes still produce actionable feedback.
  for (const code of ['', null, undefined, 'что-то']) assert.equal(voiceErrorMessage(code), voiceErrorMessage('unknown'))
})


test('subscription audio failure explains product boundary and separate API billing', () => {
  const message = voiceErrorMessage('voice-subscription-unsupported')
  assert.match(message, /Подписка ChatGPT/)
  assert.match(message, /отдельно оплачиваемый OpenAI API/)
})


test('model voice failure names the recovery instead of silently changing engines', () => {
  assert.match(voiceErrorMessage('voice-api-key-required'), /API-ключ/)
  assert.match(voiceErrorMessage('tts-timeout'), /не ответил вовремя/)
  assert.match(voiceErrorMessage('tts-connection-failed'), /подключиться/)
  assert.match(voiceErrorMessage('tts-invalid-audio'), /некорректное аудио/)
})


test('chat replies allow at least thirty seconds and scale reading time up to two minutes', () => {
  assert.equal(chatBubbleDuration('Привет 🐳', 15000), 30000)
  assert.equal(chatBubbleDuration('x'.repeat(200), 15000), 53000)
  assert.equal(chatBubbleDuration('x'.repeat(700), 15000), 120000)
  assert.equal(chatBubbleDuration('x', 45000), 45000)
})
