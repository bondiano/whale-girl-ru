import type { SettingsClientContext } from './settings-card.js'
import type { SessionCatalog } from './types.js'
/** Public DSH services used by the self-rendered pet. */
export interface ClientContext extends SettingsClientContext {
 sessions?: { list?: { getSnapshot(): SessionCatalog } }
 pluginNavigation?: { openBundle(packageName: string): void }
}
