import type { SessionCatalog } from './types.js'
/** Context menu keyboard contract; hidden/disabled actions never receive focus. */
export function menuFocusIndex(key: string, current: number, count: number) {
  if (count === 0) return -1
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  if (key === 'ArrowDown') return (current + 1 + count) % count
  if (key === 'ArrowUp') return current <= 0 ? count - 1 : current - 1
  return -1
}

/** Public Session catalog exposes the main conversation through its retainedBy source. */
export function currentSessionId(snapshot: SessionCatalog | null | undefined) {
  if (snapshot?.byId === null || typeof snapshot?.byId !== 'object') return undefined
  const selected = Object.entries(snapshot.byId)
    .filter(([, row]) => typeof row?.retainedBy?.mainView === 'number' && row.retainedBy.mainView > 0)
    .map(([id]) => id)
  return selected.length === 1 ? selected[0] : undefined
}

export const SESSION_STATUS_QUESTION = 'Как дела? Расскажи, что происходит в текущей сессии: над чем работаем, что уже сделано и что ещё осталось. Если данных нет, скажи об этом.'

/** Roving focus is local to the menu; Tab leaves it through normal browser navigation. */
export function bindMenuKeyboard(menu: HTMLElement, close: (restoreFocus: boolean) => void) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close(true)
      return
    }
    if (event.key === 'Tab') { close(false); return }
    const items = [...menu.querySelectorAll('button')]
      .filter((item) => !item.disabled && item.style.display !== 'none')
    const next = menuFocusIndex(event.key, items.indexOf(menu.ownerDocument.activeElement as HTMLButtonElement), items.length)
    if (next < 0) return
    event.preventDefault()
    items[next]?.focus()
  }
  menu.addEventListener('keydown', onKeyDown)
  return () => menu.removeEventListener('keydown', onKeyDown)
}
