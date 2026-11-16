export interface AnimationSet { sheet: string; frames: number; fps: number; playback?: string; motion?: string; frameMs?: number[] }
export interface Character { id: string; name?: string; credit?: string; meta?: { stageSize?: number }; states: Record<string, AnimationSet> }
export interface Manifest { default?: string; characters?: Record<string, Omit<Character, 'id'>>; states?: Record<string, AnimationSet> }
export interface SessionRow { running?: boolean; displayTitle?: string; pendingInteraction?: string; retainedBy?: Record<string, number> }
export interface SessionCatalog { byId?: Record<string, SessionRow | null>; current?: string }
export interface MemoryRecall { distance?: number; tasks?: Array<{ label?: string; ok?: boolean }> }
export interface SpeechRecognitionLike { lang: string; interimResults: boolean; maxAlternatives: number; onstart: (() => void) | null; onresult: ((event: { results?: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null; onerror: ((event: { error?: string }) => void) | null; onend: (() => void) | null; start(): void; stop(): void }
export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

declare global {
 interface Window { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor;
 __whaleGirlTest?: { walkNow(): void; stopWalk(): void; position(): { left: number; top: number }; isChatOpen(): boolean; isWalking(): boolean } }
}
