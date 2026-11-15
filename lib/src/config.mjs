// 配置系统：体验层配置 schema + 默认值（单一来源）。
// 契约：
// - 只含 L1 体验层项（用户可感知并有意愿调整的视觉/行为参数）；语义层
//   （XP/称号阈值/等级曲线/MEMORY_MAX/ACTIVE_CAP）与安全层（路由/CSRF/上限）
//   是代码级封闭集合，禁止出现在本 schema（verify-settings-schema 门禁守护）。
// - DEFAULTS 是消费端的唯一权威默认值来源；消费端（index.mjs/client 逻辑）
//   不得再写第二份默认值字面量（verify-config-sync 门禁守护）。
// - schema 即插件条目的 Config（index.mjs `export const Config`）：设置命名空间 =
//   条目 id（= NAMESPACE = bundle 包名，verify-config-sync 门禁守护同一性）。
//   宿主按 `~standard` 校验条目 config，并把标了 `.volatile()` 的叶子替换为实时
//   引用（`createVolatile`，形如 `{ get() }`）；改这些字段经 profile patch 提交时
//   宿主原地换值、**不重挂载**，并发 `loader/volatile-update`（index.mjs 订阅）。
// - readConfig 是消费端唯一读取面：解引用 volatile 叶子、与 DEFAULTS 合并补缺、
//   归一化成对区间。零宿主依赖、可单测。

// 注意：本文件不 import 任何语义常量（src/pet-state.mjs 等）——语义层封闭，
// 配置面不得读取/覆盖它们（引用门禁守护）。
import z from '@deepseek-ai/schemastery'

export const NAMESPACE = 'whale-girl'

/** 体验层默认值（消费端唯一权威）。数值已 clamp 到安全域。 */
export const DEFAULTS = Object.freeze({
  enabled: true,          // 网页端渲染开关（桌面伴侣并存时设 false 关闭网页端宠物，避免双宠物）
  sessionMemory: false,   // 会话记忆开关（本机记录任务摘要并在恢复/fork 会话时读回；见 src/session-memory.mjs）
  size: 110,              // 宠物尺寸 px（stage 盒 + sprite 上限）
  opacity: 1,             // 常态透明度 0.2–1（inert 0.25 是交互态，不在此配）
  walk: {
    enabled: true,        // 游走开关
    minWaitMs: 18000,     // 游走间隔下限
    maxWaitMs: 40000,     // 游走间隔上限
    minMs: 3000,          // 单次游走时长下限
    maxMs: 6000,          // 单次游走时长上限
    speedPxPerSec: 45,    // 游走速度
  },
  sleepAfterMs: 60000,    // 空闲多久进入睡眠
  pollMs: 3000,           // /state 轮询间隔
  bubbleMs: 2500,         // 回话气泡时长
  welcomeMs: 6000,        // 欢迎窗口
  celebrateMs: 6000,      // 庆祝窗口
  errorMs: 4000,          // 惊吓窗口
  disappointedMs: 6000,   // 失落尾窗
  // 宠物台词池（用户可自定义追加；空池回退内置兜底）。idle/think/wait/celebrate/
  // error/welcome/levelUp 是氛围与事件台词（client 按状态/边沿取用），feed/play 是
  // /interact 的互动回话（Node half 取用）。
  replies: {
    feed: [
      '«Ам-ам — спасибо за угощение!»',
      '«Как вкусно, полна энергии!»',
      '«Хи-хи, угощение принято!»',
      '«М-м-м, ещё кусочек?»',
      '«Ням-ням… записала это в свои воспоминания.»',
      '«Спасибо! Теперь я могу вилять хвостом целый день.»',
      '«Вкусняшка! Ты лучший шеф-повар.»',
      '«Жуёшь тут, а задачи сами себя не сделают… но ладно!»',
    ],
    play: [
      '«Хе-хе, ещё разок!»',
      '«Как весело играть~»',
      '«Я выиграла! Ещё!»',
      '«Лови мячик! Ой… не поймала.»',
      '«Давай наперегонки до правого края?»',
      '«Ты видел, как я прыгнула?»',
      '«Мне так нравится с тобой играть!»',
      '«Ещё один раунд — и я чемпион.»',
    ],
    idle: [
      '«Интересно, а задачи сегодня будут?»',
      '«Я тут, если что.»',
      '«Хвостик чешется…»',
      '«Плыву по волнам твоего рабочего стола.»',
      '«Тишина… но приятная.»',
      '«Может, чаю? Я за компанию.»',
      '«Скучно немного. Покормишь?»',
      '«Гляжу на твой код и ничего не понимаю, но поддерживаю.»',
      '«Пузырьки! Видел пузырьки?»',
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
  // Голос: «browser» = системный SpeechSynthesis (без сети/ключей); «openai» —
  // OpenAI-совместимый POST {baseUrl}/audio/speech (локальные TTS-сервера тоже).
  voice: {
    enabled: false,                     // озвучивание включено
    provider: 'browser',                // browser | openai
    baseUrl: '',                        // OpenAI-совместимый базовый URL (для openai)
    model: '',                          // модель TTS (для openai), напр. tts-1 / gpt-4o-mini-tts
    voice: '',                          // имя/ид голоса; пусто = авто (browser: русский голос)
    format: 'mp3',                      // формат ответа TTS
    apiKeyEnv: 'WHALE_GIRL_TTS_API_KEY', // имя переменной окружения с ключом
    apiKey: '',                         // ключ прямо в настройках (env предпочтительнее)
    rate: 1,                            // скорость для browser-голоса 0.5–2
  },
  // Беседа: сообщение → ответ модели (llm-сервис хоста), история — в памяти процесса.
  chat: {
    enabled: true,                      // кнопка «Поговорить» и POST /chat
    provider: '',                       // пусто = модель по умолчанию хоста (agentDefaultModel)
    model: '',
    systemPrompt: '',                   // пусто = встроенный характер (src/chat.mjs)
    maxTokens: 300,                     // предел ответа
    historyTurns: 8,                    // сколько последних реплик помнить
  },
})

/** 条目 Config schema：默认值= DEFAULTS（防双源漂移）；可 live 调参的叶子标 volatile。 */
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
      bubbleMs: z.number().min(500).max(10000).default(DEFAULTS.bubbleMs).volatile(),
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
      }),
      chat: z.object({
        enabled: z.boolean().default(DEFAULTS.chat.enabled).volatile(),
        provider: z.string().default(DEFAULTS.chat.provider).volatile(),
        model: z.string().default(DEFAULTS.chat.model).volatile(),
        systemPrompt: z.string().default(DEFAULTS.chat.systemPrompt).volatile(),
        maxTokens: z.number().min(50).max(2000).default(DEFAULTS.chat.maxTokens).volatile(),
        historyTurns: z.number().min(0).max(32).default(DEFAULTS.chat.historyTurns).volatile(),
      }),
    })
}

/** volatile 叶子引用（宿主 createVolatile 注入：冻结对象、唯一自有键 get）。 */
function isConfigRef(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && typeof value.get === 'function' && Object.keys(value).length === 1
}

/** 解引用：volatile 叶子取当前值；数组/普通对象递归。 */
function unwrap(value) {
  if (isConfigRef(value)) return unwrap(value.get())
  if (Array.isArray(value)) return value.map(unwrap)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, unwrap(child)]))
}

/** 成对区间归一：min > max 时交换（写面只剩 schema 校验，值仍须可解释）。 */
function orderedPair(min, max) {
  return min > max ? [max, min] : [min, max]
}

/** 读配置快照：解引用 + 与 DEFAULTS 合并补缺 + 成对区间归一。 */
export function readConfig(config) {
  const next = unwrap(config ?? {})
  const src = next !== null && typeof next === 'object' ? next : {}
  const objectOf = (value) => (value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {})
  const walk = { ...DEFAULTS.walk, ...objectOf(src.walk) }
  const [minWaitMs, maxWaitMs] = orderedPair(walk.minWaitMs, walk.maxWaitMs)
  const [minMs, maxMs] = orderedPair(walk.minMs, walk.maxMs)
  const replies = { ...DEFAULTS.replies, ...objectOf(src.replies) }
  const voice = { ...DEFAULTS.voice, ...objectOf(src.voice) }
  const chat = { ...DEFAULTS.chat, ...objectOf(src.chat) }
  return {
    ...DEFAULTS, ...src,
    walk: { ...walk, minWaitMs, maxWaitMs, minMs, maxMs },
    replies,
    voice,
    chat,
  }
}
