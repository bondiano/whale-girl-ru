// Experience settings schema and defaults, with one authoritative source.
// Only user-adjustable visual and behavioral settings belong here. Semantic constants
// (XP/title thresholds, level curve, memory/activity caps) and security limits stay in code;
// verify-settings-schema enforces this boundary.
// DEFAULTS is authoritative for backend and client consumers; verify-config-sync prevents duplicated defaults.
// The exported Config schema uses the bundle entry ID as its namespace, matching NAMESPACE and the package name.
// The host validates through ~standard and replaces .volatile() leaves with live { get() } references.
// Profile-patch updates replace their values without remounting and emit loader/volatile-update.
// readConfig is the sole read boundary: unwrap references, merge missing defaults, and normalize min/max pairs.
// This module must not import semantic constants or expose them as settings.
import z from '@deepseek-ai/schemastery'

export const NAMESPACE = 'whale-girl'

/** Authoritative experience defaults, clamped to their safe ranges. */
export const DEFAULTS = Object.freeze({
  enabled: true,          // Web pet visibility; disable it when a desktop companion would otherwise duplicate the pet.
  sessionMemory: false,   // Local session-task memory, recalled on resume/fork; see session-memory.ts.
  size: 110,              // Pet size in pixels, bounding the stage and sprite.
  opacity: 1,             // Normal opacity; the transient inert-state opacity is separate.
  walk: {
    enabled: true,        // Enable wandering.
    minWaitMs: 18000,     // Minimum wait between walks.
    maxWaitMs: 40000,     // Maximum wait between walks.
    minMs: 3000,          // Minimum walk duration.
    maxMs: 6000,          // Maximum walk duration.
    speedPxPerSec: 45,    // Walking speed.
  },
  sleepAfterMs: 60000,    // Idle time before sleeping.
  pollMs: 3000,           // /state polling interval.
  bubbleMs: 15000,        // Event-bubble duration; chat replies have a longer reading window.
  welcomeMs: 6000,        // Welcome window.
  celebrateMs: 6000,      // Celebration window.
  errorMs: 4000,          // Error/startle window.
  disappointedMs: 6000,   // Disappointment tail window.
  // Customizable reply pools use built-in fallbacks when empty.
  // The client consumes idle/think/wait/celebrate/error/welcome/levelUp atmosphere and event replies;
  // the backend uses feed/play replies for /interact.
  replies: {
    feed: [
      '«Подкрепились — выбери один маленький шаг по задаче 🐳»',
      '«Перед правкой кода запиши, какое поведение хочешь получить.»',
      '«Поймал баг? Сначала сохрани короткий сценарий воспроизведения.»',
      '«Дай AI цель, ограничения и пример нужного результата.»',
      '«Не отправляй AI ключи и токены — замени их заглушками.»',
      '«После ответа AI проверь код и запусти подходящий тест.»',
      '«Если задача расплывается, разбей её на проверяемые шаги.»',
      '«Я рядом: один законченный шаг полезнее пяти начатых задач.»',
    ],
    play: [
      '«Мини-разминка: придумай граничный случай для текущей функции 🎾»',
      '«Сыграем в отладку: проверь одну гипотезу о баге за раз.»',
      '«Попроси AI найти слабое место решения, а затем проверь замечание.»',
      '«Перед рефакторингом закрепи нужное поведение тестом.»',
      '«Маленький diff проще проверить — вынеси несвязанные правки отдельно.»',
      '«Сравни ожидаемый результат с фактическим: где расходятся данные?»',
      '«Для задачи с AI заранее опиши, как проверишь результат.»',
      '«Рабочая разминка: объясни сложный участок кода простыми словами.»',
    ],
    idle: [
      '«Интересно, а задачи сегодня будут?»',
      '«Я тут, если что.»',
      '«AI легче помочь, когда есть цель, ограничения и пример результата.»',
      '«Плыву по волнам твоего рабочего стола.»',
      '«Тишина… но приятная.»',
      '«Может, чаю? Я за компанию.»',
      '«Скучно немного. Покормишь?»',
      '«Застрял в коде? Сравни ожидаемый результат с фактическим на одном примере.»',
      '«Перед большой правкой полезно сохранить маленький тест на нужное поведение.»',
      '«Ты не забыл про перерыв?»',
      '«Я всегда рядом.»',
      '«Уже почти… ладно, просто сижу.»',
    ],
    think: [
      '«Думай-думай, я подожду.»',
      '«Смотрю на тебя внимательно.»',
      '«Тихо, у нас тут мысли.»',
      '«Я рядом, не отвлекаю.»',
      '«Ещё чуть-чуть, я верю.»',
      '«Плыву рядом с твоими мыслями.»',
      '«Мозговой штурм? Я за.»',
      '«Умный взгляд — это я умею.»',
    ],
    wait: [
      '«Жду-жду…»',
      '«Кто-то должен нажать «да»?»',
      '«Я за тебя болею!»',
      '«Терпение — моё любимое занятие.»',
      '«Ты только не пропусти!»',
      '«Уже скоро, да?»',
    ],
    celebrate: [
      '«Ура! Мы справились!»',
      '«Победа! Дай пять… ластой!»',
      '«Ещё одна задача в копилку!»',
      '«Я так горжусь тобой!»',
      '«Праздничный фонтан брызг!»',
      '«Отличная работа!»',
      '«Хвост сам собой виляет!»',
      '«Так держать, напарник!»',
    ],
    error: [
      '«Ой… что-то пошло не так.»',
      '«Не переживай, попробуем ещё.»',
      '«Я подпрыгнула от неожиданности.»',
      '«Ошибка — не приговор.»',
      '«Спокойно, я рядом.»',
      '«Ну и ладно, главное — не сдаваться.»',
    ],
    welcome: [
      '«Привет-привет! Я тут.»',
      '«Новая сессия — новые приключения!»',
      '«О, ты пришёл! А я как раз жду.»',
      '«Помашу плавником!»',
      '«Снова вместе — так лучше.»',
      '«Привет! Я соскучилась.»',
      '«Начинаем! Я готова.»',
      '«Здравствуй! Чем займёмся?»',
    ],
    levelUp: [
      '«Новый уровень! Я расту!»',
      '«Мы стали ещё опытнее!»',
      '«Уровень выше — пузырьки больше!»',
      '«Спасибо, что помогаешь мне расти!»',
      '«Ещё чуть-чуть — и я чемпион.»',
      '«Ура, повышение!»',
      '«Я чувствую себя большой китихой!»',
      '«Новый уровень — новая я.»',
    ],
  },
  // browser uses system speech; explicit openai API mode uses Realtime or a
  // configured compatible speech model. Subscription audio is unavailable.
  voice: {
    enabled: false,                     // Enable speech output.
    provider: 'browser',                // browser | openai (separate API billing) | subscription (unavailable)
    baseUrl: 'https://api.openai.com/v1', // explicit API mode only; subscription auth is never used
    model: 'gpt-realtime-2.1-mini',      // Realtime API; explicit legacy models use /audio/speech
    voice: 'marin',                     // API voice; browser falls back to a Russian system voice
    format: 'mp3',                      // TTS response format.
    apiKeyEnv: 'WHALE_GIRL_TTS_API_KEY', // Environment variable containing the API key.
    apiKey: '',                         // Inline settings key; an environment variable is preferred.
    rate: 1,                            // Browser speech rate, from 0.5 to 2.
    sttModel: 'gpt-transcribe',          // current file-transcription model
    instructions: 'Говори как милая игривая девочка-кит', // Speaking-style instructions for supported TTS models.
    conversation: false,                // Conversation mode: listen again after each reply.
    autoSpeakChat: true,                // Automatically speak chat replies.
  },
  // Chat uses the host LLM service; history stays in process memory.
  chat: {
    enabled: true,                      // Chat action and POST /chat.
    provider: '',                       // Empty selects the host default model through agentDefaultModel.
    model: '',
    systemPrompt: '',                   // Empty uses the built-in persona in chat.ts.
    maxTokens: 300,                     // Reply token limit.
    historyTurns: 8,                    // Number of recent history turns to retain.
    sessionContext: true,               // Include facts about the selected session.
  },
  // Fetch fresh news feeds when the user asks; see news.ts.
  news: {
    enabled: true,                      // Fetch feeds on news requests.
    feeds: ['https://lenta.ru/rss/news', 'https://habr.com/ru/rss/news/?fl=ru', 'https://hnrss.org/frontpage'], // RSS/Atom feeds, restricted to HTTP(S).
    maxItems: 5,                        // Number of headlines to include, from 1 to 10.
  },
})

/** Default news feeds reference the same array as DEFAULTS. */
export const DEFAULT_FEEDS = DEFAULTS.news.feeds

type Widen<T> = T extends boolean ? boolean : T extends string ? string : T extends number ? number
  : T extends Array<infer U> ? Widen<U>[] : { -readonly [K in keyof T]: Widen<T[K]> }

/** Values after host schema validation and volatile-reference unwrapping. */
export type WhaleConfig = Widen<typeof DEFAULTS>
export type VoiceConfig = WhaleConfig['voice']

/** Entry Config schema: use DEFAULTS and mark live-adjustable leaves volatile to prevent drift. */
export function buildSchema() {
  return z.object({
    enabled: z.boolean().default(DEFAULTS.enabled).volatile(),
    sessionMemory: z.boolean().default(DEFAULTS.sessionMemory).volatile(),
    size: z.number().min(64).max(160).default(DEFAULTS.size).volatile(),
      opacity: z.number().min(0.2).max(1).default(DEFAULTS.opacity).volatile(),
      walk: z.object({
        enabled: z.boolean().default(DEFAULTS.walk.enabled).volatile(),
        minWaitMs: z.number().min(0).max(300000).default(DEFAULTS.walk.minWaitMs).volatile(),
        maxWaitMs: z.number().min(0).max(300000).default(DEFAULTS.walk.maxWaitMs).volatile(),
        minMs: z.number().min(0).max(60000).default(DEFAULTS.walk.minMs).volatile(),
        maxMs: z.number().min(0).max(60000).default(DEFAULTS.walk.maxMs).volatile(),
        speedPxPerSec: z.number().min(10).max(300).default(DEFAULTS.walk.speedPxPerSec).volatile(),
      }),
      sleepAfterMs: z.number().min(5000).max(600000).default(DEFAULTS.sleepAfterMs).volatile(),
      pollMs: z.number().min(1000).max(30000).default(DEFAULTS.pollMs).volatile(),
      bubbleMs: z.number().min(500).max(30000).default(DEFAULTS.bubbleMs).volatile(),
      welcomeMs: z.number().min(0).max(30000).default(DEFAULTS.welcomeMs).volatile(),
      celebrateMs: z.number().min(0).max(30000).default(DEFAULTS.celebrateMs).volatile(),
      errorMs: z.number().min(0).max(15000).default(DEFAULTS.errorMs).volatile(),
      disappointedMs: z.number().min(0).max(15000).default(DEFAULTS.disappointedMs).volatile(),
      replies: z.object({
        feed: z.array(z.string()).default(DEFAULTS.replies.feed).volatile(),
        play: z.array(z.string()).default(DEFAULTS.replies.play).volatile(),
        idle: z.array(z.string()).default(DEFAULTS.replies.idle).volatile(),
        think: z.array(z.string()).default(DEFAULTS.replies.think).volatile(),
        wait: z.array(z.string()).default(DEFAULTS.replies.wait).volatile(),
        celebrate: z.array(z.string()).default(DEFAULTS.replies.celebrate).volatile(),
        error: z.array(z.string()).default(DEFAULTS.replies.error).volatile(),
        welcome: z.array(z.string()).default(DEFAULTS.replies.welcome).volatile(),
        levelUp: z.array(z.string()).default(DEFAULTS.replies.levelUp).volatile(),
      }),
      voice: z.object({
        enabled: z.boolean().default(DEFAULTS.voice.enabled).volatile(),
        provider: z.string().default(DEFAULTS.voice.provider).volatile(),
        baseUrl: z.string().default(DEFAULTS.voice.baseUrl).volatile(),
        model: z.string().default(DEFAULTS.voice.model).volatile(),
        voice: z.string().default(DEFAULTS.voice.voice).volatile(),
        format: z.string().default(DEFAULTS.voice.format).volatile(),
        apiKeyEnv: z.string().default(DEFAULTS.voice.apiKeyEnv).volatile(),
        apiKey: z.string().default(DEFAULTS.voice.apiKey).volatile(),
        rate: z.number().min(0.5).max(2).default(DEFAULTS.voice.rate).volatile(),
        sttModel: z.string().default(DEFAULTS.voice.sttModel).volatile(),
        instructions: z.string().default(DEFAULTS.voice.instructions).volatile(),
        conversation: z.boolean().default(DEFAULTS.voice.conversation).volatile(),
        autoSpeakChat: z.boolean().default(DEFAULTS.voice.autoSpeakChat).volatile(),
      }),
      chat: z.object({
        enabled: z.boolean().default(DEFAULTS.chat.enabled).volatile(),
        provider: z.string().default(DEFAULTS.chat.provider).volatile(),
        model: z.string().default(DEFAULTS.chat.model).volatile(),
        systemPrompt: z.string().default(DEFAULTS.chat.systemPrompt).volatile(),
        maxTokens: z.number().min(50).max(2000).default(DEFAULTS.chat.maxTokens).volatile(),
        historyTurns: z.number().min(0).max(32).default(DEFAULTS.chat.historyTurns).volatile(),
        sessionContext: z.boolean().default(DEFAULTS.chat.sessionContext).volatile(),
      }),
      news: z.object({
        enabled: z.boolean().default(DEFAULTS.news.enabled).volatile(),
        feeds: z.array(z.string()).default(DEFAULTS.news.feeds).volatile(),
        maxItems: z.number().min(1).max(10).default(DEFAULTS.news.maxItems).volatile(),
      }),
    })
}

/** Host-injected volatile reference: a frozen object with get as its only own key. */
function isConfigRef(value: unknown): value is { get(): unknown } {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && 'get' in value && typeof value.get === 'function' && Object.keys(value).length === 1
}

/** Unwrap live leaves recursively through arrays and ordinary objects. */
function unwrap(value: unknown): unknown {
  if (isConfigRef(value)) return unwrap(value.get())
  if (Array.isArray(value)) return value.map(unwrap)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, unwrap(child)]))
}

/** Normalize paired bounds by swapping min/max when reversed; schema validation owns writes. */
function orderedPair(min: number, max: number): [number, number] {
  return min > max ? [max, min] : [min, max]
}

/** Read a configuration snapshot: unwrap references, fill missing defaults, and normalize paired bounds. */
export function readConfig(config: unknown): WhaleConfig {
  const next = unwrap(config ?? {})
  const objectOf = (value: unknown): Record<string, unknown> => (value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {})
  const src = objectOf(next)
  const walk = { ...DEFAULTS.walk, ...objectOf(src.walk) }
  const [minWaitMs, maxWaitMs] = orderedPair(walk.minWaitMs, walk.maxWaitMs)
  const [minMs, maxMs] = orderedPair(walk.minMs, walk.maxMs)
  const replies = { ...DEFAULTS.replies, ...objectOf(src.replies) }
  const voice = { ...DEFAULTS.voice, ...objectOf(src.voice) }
  const chat = { ...DEFAULTS.chat, ...objectOf(src.chat) }
  const news = { ...DEFAULTS.news, ...objectOf(src.news) }
  return {
    ...DEFAULTS, ...src,
    walk: { ...walk, minWaitMs, maxWaitMs, minMs, maxMs },
    replies,
    voice,
    chat,
    news,
  }
}
