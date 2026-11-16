// Контекст активной сессии для беседы: что питомец знает о текущей работе.
//归属 lib/src/session-context.mjs：меняется текст/оценка остатка — правь этот файл.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  activityLabel, describeSessions, formatDuration, median,
} from '../lib/src/session-context.mjs'

const view = (patch = {}) => ({
  id: 's1',
  title: 'рефакторинг',
  activity: 'thinking',
  since: 1000,
  turnStartedAt: 1000,
  toolCalls: 0,
  recentTurnMs: [],
  ...patch,
})

test('activityLabel: activity 账本 → русская подпись', () => {
  assert.equal(activityLabel('thinking'), 'думает')
  assert.equal(activityLabel('waiting'), 'ждёт подтверждения')
  assert.equal(activityLabel('tool:bash'), 'выполняет bash')
  assert.equal(activityLabel('done'), 'свободен')
  assert.equal(activityLabel(undefined), 'свободен')
})

test('formatDuration/median', () => {
  assert.equal(formatDuration(0), '1 с')
  assert.equal(formatDuration(59000), '59 с')
  assert.equal(formatDuration(60000), '1 мин')
  assert.equal(formatDuration(90 * 60000), '90 мин')
  assert.equal(median([1, 3, 2]), 2)
  assert.equal(median([4, 1]), 2.5)
  assert.equal(median([]), null)
})

test('describeSessions: без сессий — «агент свободен»', () => {
  assert.equal(describeSessions([]), 'Сейчас агент свободен.')
  assert.equal(describeSessions(null), 'Сейчас агент свободен.')
})

test('describeSessions: заголовок, активность, время, инструменты', () => {
  const text = describeSessions([view({ toolCalls: 3, lastTool: 'bash' })], { now: 61 * 60000 })
  assert.match(text, /«рефакторинг»/)
  assert.match(text, /думает/)
  assert.match(text, /идёт 61 мин/)
  assert.match(text, /инструментов: 3 \(последний: bash\)/)
})

test('describeSessions: вид без заголовка берёт id; нет инструментов — честная строка', () => {
  const text = describeSessions([view({ title: null })], { now: 1000 })
  assert.match(text, /«s1»/)
  assert.match(text, /инструментов пока не было/)
})

test('описание остатка: <2 замеров — «не могу оценить»', () => {
  assert.match(describeSessions([view({ recentTurnMs: [60000] })], { now: 2000 }), /остаток: не могу оценить/)
})

test('описание остатка: медиана замеров минус прошедшее, оценка в минутах', () => {
  const text = describeSessions([view({
    turnStartedAt: 0,
    since: 1000,
    recentTurnMs: [5 * 60000, 7 * 60000],
  })], { now: 2 * 60000 + 1000 })
  assert.match(text, /примерно ещё ~4 мин \(оценка\)/, text)
})

test('описание остатка: время вышло — «скоро должны закончить»', () => {
  const text = describeSessions([view({ since: 1000, turnStartedAt: 0, recentTurnMs: [60000, 60000] })], { now: 10 * 60000 })
  assert.match(text, /остаток: скоро должны закончить/)
})

test('describeSessions: не больше 5 сессий и мусорные виды отбрасываются', () => {
  const views = Array.from({ length: 8 }, (_, index) => view({ id: `s${index}`, title: `t${index}` }))
  const text = describeSessions([null, ...views], { now: 1000 })
  assert.equal(text.split('\n').length, 1 + 5)
  assert.match(text, /«t4»/)
  assert.doesNotMatch(text, /«t5»/)
})
