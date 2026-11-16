import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'
import type { ChatMessage, ModelSelection } from './core/chat.js'
import type { PetState } from './core/pet-state.js'
import type { UpdateManager } from './core/update-host.js'

export type Disposer = () => unknown
export interface HostSession {
  id: string
  header?: { createdAt?: number; parentSession?: string; origin?: string }
  events?: readonly unknown[]
  deriveMessages?: () => unknown
}
export interface HostAgent { id: string; session?: HostSession }
export interface JobSnapshot { id: string; status: string; label?: string; owner?: string }
export interface ModelFailure { code?: string; message?: string; finishKind?: string }
export interface LlmChunk { type: string; text?: string; reason?: { kind?: string; failure?: ModelFailure } }
export interface LlmRequest extends ModelSelection {
  system: string
  messages: ChatMessage[]
  maxTokens: number
  temperature: number
  sessionId?: string
  signal: AbortSignal
}
export interface LlmService {
  stream: (options: LlmRequest) => AsyncIterable<LlmChunk>
  listProviders?: () => unknown
  listModels?: (provider: string) => unknown | Promise<unknown>
}
export interface WebRoute {
  kind: 'exact' | 'prefix'
  path: string
  handler?: (request: IncomingMessage, response: ServerResponse, ...args: unknown[]) => unknown
  resource?: (request: Request, ...args: unknown[]) => Response | Promise<Response>
}
export interface WebServer {
  host?: string
  getOrigin: () => string
  register: (route: WebRoute) => Disposer
}
export interface ConnectionService {
  allowsRemoteAuthorities?: boolean
  requestRejection?: (request: { headers: IncomingHttpHeaders }) => number | undefined
}
export interface HostServices {
  sessions: { list: () => HostSession[]; get?: (id: string) => HostSession | undefined }
  sessionTitle: { get?: (session: HostSession) => { title?: string } | undefined }
  webServer: WebServer
  connection: ConnectionService
  llm: LlmService
  agentDefaultModel: { currentSelection?: () => ModelSelection | null }
  pluginManager: UpdateManager
  profileContext: { dir?: string }
}
interface HostEvents {
  'loader/volatile-update': []
  'agent/request-error': []
  'agent/created': [{ source?: string; agent?: HostAgent }]
  'session/event': [HostSession, unknown]
}
interface PetService {
  snapshot: () => { pet: PetState; activity: { name: string; until: number; sessionThink: boolean; sessionWait: boolean; turnCompleted: boolean; turnCompletedUntil: number } }
  onSignal: (fn: (signal: string, payload: Record<string, unknown>) => void) => Disposer
}
export interface HostContext {
  get?: <K extends keyof HostServices>(name: K) => HostServices[K] | undefined
  connection?: ConnectionService
  agents: { list: () => HostAgent[] }
  jobs: {
    list: (owner?: string) => JobSnapshot[]
    events: { subscribe: (options: { owners: 'all' }, fn: (event: { type: string; job: JobSnapshot }) => void) => Disposer }
  }
  on: <K extends keyof HostEvents>(event: K, fn: (...args: HostEvents[K]) => void) => Disposer
  effect: (fn: () => Disposer | void, label?: string) => unknown
  provide: (name: 'whale-girl.pet', value: PetService) => Disposer
  logger?: { warn?: (message: string) => void }
}
