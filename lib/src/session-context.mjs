// Контекст активной сессии для беседы: чистые функции (ноль зависимостей, без DOM/сети).
// Контракт:
// - Вход —视图会话 (см. src/sessions.mjs: { id, title, activity, since, turnStartedAt,
//   toolCalls, lastTool, recentTurnMs }), собранные Node half из `session/event`.
// - describeSessions 返回 русский текст фактов: заголовок, активность, прошедшее время,
//   число инструментов и оценка остатка (медиана последних ходов). Оценка появляется
//   только при >= 2 замерах, иначе честное «не могу оценить».
// - Пустой список — «Сейчас агент свободен.».

const MAX_SESSIONS = 5

/** Человеческая метка активности (закрытый набор activity из src/sessions.mjs). */
export function activityLabel(activity) {
  if (typeof activity !== 'string' || activity === '' || activity === 'done') return 'свободен'
  if (activity === 'thinking') return 'думает'
  if (activity === 'waiting') return 'ждёт подтверждения'
  if (activity.startsWith('tool:')) {
    const name = activity.slice('tool:'.length)
    return name === '' ? 'работает с инструментом' : `выполняет ${name}`
  }
  return 'работает'
}

/** Длительность словами: секунды до минуты, дальше минуты (округление вниз, минимум 1). */
export function formatDuration(ms) {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0
  if (safe < 60000) return `${Math.max(1, Math.round(safe / 1000))} с`
  const minutes = Math.max(1, Math.round(safe / 60000))
  return `${minutes} мин`
}

/** Медиана числового массива (пустой → null). */
export function median(values) {
  const nums = (Array.isArray(values) ? values : []).filter((v) => Number.isFinite(v))
  if (nums.length === 0) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Строка оценки остатка для одного вида. */
function etaLine(view, now) {
  const samples = Array.isArray(view.recentTurnMs) ? view.recentTurnMs.filter((v) => Number.isFinite(v)) : []
  if (samples.length < 2) return 'остаток: не могу оценить'
  const started = Number.isFinite(view.turnStartedAt) && view.turnStartedAt > 0 ? view.turnStartedAt : view.since
  if (!Number.isFinite(started) || started <= 0) return 'остаток: не могу оценить'
  const elapsed = Math.max(0, now - started)
  const avg = median(samples)
  const left = avg - elapsed
  if (!Number.isFinite(left) || left <= 0) return 'остаток: скоро должны закончить'
  const minutes = Math.max(1, Math.round(left / 60000))
  return `примерно ещё ~${minutes} мин (оценка)`
}

/**
 * Описать активные сессии для системного промпта.
 * @param {ReadonlyArray<object>} views виды сессий
 * @param {{ now?: number }} [options]
 * @returns {string}
 */
export function describeSessions(views, { now = Date.now() } = {}) {
  const list = (Array.isArray(views) ? views : [])
    .filter((view) => view !== null && typeof view === 'object')
    .slice(0, MAX_SESSIONS)
  if (list.length === 0) return 'Сейчас агент свободен.'
  const lines = list.map((view) => {
    const title = typeof view.title === 'string' && view.title.trim() !== '' ? view.title.trim() : view.id
    const started = Number.isFinite(view.turnStartedAt) && view.turnStartedAt > 0 ? view.turnStartedAt : view.since
    const elapsed = Number.isFinite(started) && started > 0 ? Math.max(0, now - started) : 0
    const tools = Number.isInteger(view.toolCalls) && view.toolCalls > 0 ? view.toolCalls : 0
    const toolPart = tools > 0
      ? `инструментов: ${tools}${typeof view.lastTool === 'string' && view.lastTool !== '' ? ` (последний: ${view.lastTool})` : ''}`
      : 'инструментов пока не было'
    return `- «${title}»: ${activityLabel(view.activity)}, идёт ${formatDuration(elapsed)}; ${toolPart}; ${etaLine(view, now)}`
  })
  return ['Активные сессии:', ...lines].join('\n')
}
