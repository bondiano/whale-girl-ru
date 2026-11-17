// whale-girl React settings card in the official keyed plugins.bundle.config slot, declared by
// dsh-client-ui-plugin-manager, with key equal to the bundle package name. It appears between the
// package description and entry list. plugins.item belongs to built-in official settings;
// third-party use incorrectly places the card in the official group
// (decisions/implemented/bug-fix/2026-10-04-settings-card-bundle-slot.md). The page requests only
// the page view and owns icon/title/description chrome; this component renders fields. Register
// through ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({ name, key, locale,
// inject }, Card)). Missing keys throw at startup; key must match whale-girl and the Node settings
// namespace. configForms.whileServed([namespace]) registers only while the host serves that
// namespace, avoiding empty cards. Read via ctx.configForms.get(namespace); writes use deep-path
// mutate and revision-fenced CAS (settings-fields.mjs). Changes save immediately without
// Save/Discard: toggles commit on click; numbers/phrase pools buffer locally and commit on
// blur/Enter, not each keystroke. Official controls follow accepted changes immediately and block
// duplicate writes while settling; footer-save SettingsForm behavior belongs to other pages.
// Rejected writes show a notice and reset to host-authoritative values. Controls come from
// @deepseek-ai/dsh-client-ui-primitives: Switch opts out of global superellipse styling with
// corner-shape:round, and numbers use Input. Rows use 0.5px border-l2 separators; textareas match
// 0.5px border-l4, radius-md, bg-layer-1, 14px input styling. The package page owns card
// background/border. Only field-row layout (like official ui-theme FontSizeRow) and multi-line
// phrase textareas are custom: primitives lacks Enter-for-newline controls, while InlineEditor
// submits Enter. Pure field derivation is in settings-fields.mjs with
// tests/settings-fields.test.mjs. The React SlotOutlet requires React components, so a pure-DOM
// card is unsuitable. React/primitives come from platform seeds and remain esbuild externals
// required by the bundle.

import React from 'react'
import { Button, Input, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import { CARD_FIELDS, deriveState, modelKey, parseLines, serializeLines, splitModelKey, writeField, writeFields } from './settings-fields.js'
import { ROW_INITIAL, deriveUpdateRow, outcomeOf, reduceRow } from './update-state.js'
import { MODELS_PATH, UPDATE_PATH } from '../core/routes.js'

import type { CardField, ConfigScope, ConfigSnapshot, SettingsState, SettingsValues } from './settings-fields.js'
import type { Translate, UpdateRowEvent } from './update-state.js'

interface ValueFieldProps<T> {
  value: unknown; disabled: boolean; label: string; resetToken?: number; onChange: (value: T) => void;
}
interface ModelOption { provider: string; model: string; label?: string }
interface CardProps {
  useWhaleSettings: (selector: (state: SettingsState) => SettingsState) => SettingsState;
  t: Translate; view?: string;
  write: (path: string, value: unknown) => Promise<void>;
  writeMany: (pairs: [string, unknown][]) => Promise<void>;
}
export interface SettingsClientContext {
  configForms: { get(namespace: string): ConfigScope; whileServed(namespaces: string[], callback: () => (() => void)): () => void };
  locale: { register(namespace: string, translations: Record<string, Record<string, string>>): () => void };
  slots: {
    inject(name: string, callback: () => (() => void)): () => void;
    register(definition: { name: string; key: string; locale: string; inject: () => {
      hooks: { whaleSettings: { getSnapshot: () => SettingsState; subscribe: (listener: () => void) => () => void } };
      write: CardProps['write']; writeMany: CardProps['writeMany'];
    } }, component: React.ComponentType<CardProps>): () => void;
  };
}

/** Card locale namespace, separate from the whale-girl settings namespace. */
export const SETTINGS_NS = 'settings.whale-girl'

/**
 * Card copy (zh/en); keep behavioral descriptions synchronized with README configuration
 * documentation.
 */
export const zh = {

  voiceBrowserOption: '系统语音',
  voiceApiOption: 'OpenAI API（单独计费）',
  voiceSubscriptionOption: 'ChatGPT 订阅：不支持音频',

  description: '尺寸、透明度、游走、会话记忆与回话文案（改动即时生效）',
  writeFailed: '刚才的改动未被接受，已回读当前值。',
  readOnly: '当前部署只读，无法修改。',
  update: '更新',
  check: '检查更新…',
  checking: '检查中…',
  latest: '已是最新',
  latestAt: '已是最新（当前 {current}）',
  updateTo: '更新到 {target}…',
  updateToRef: '改跟 {ref}…',
  availableLocal: '有新版本 {target}（当前 {current}）；更新会改成跟 {ref}',
  checkRateLimited: '上游请求受限（GitHub 限流），稍后再试。',
  updateFailedEnabled: '更新失败：读不到当前启停状态，未做任何改动。',
  updateFailedSource: '更新失败：认不出这个安装来源。',
  updateFailedTracking: '更新失败，稍后再试。profile 现在固定在 {spec}——要恢复跟踪某条分支，需手动改回该分支。',
  updating: '更新中…',
  updated: '已更新。',
  updatedRestart: '已更新，改动将在下次启动生效。',
  updatedOverridden: '已更新，但被更高优先级的配置覆盖，当前未生效。',
  updateFailed: '更新失败，稍后再试。',
  updateFailedDetail: '更新失败，稍后再试。（{reason}）',
  checkFailed: '检查失败，稍后再试。',
  reasonSeparator: '：',
  updateUnsupported: '此部署不支持应用内更新。',
  updateUnknown: '无法确认上游版本。',
  hostOutdated: '宿主版本过旧，无法检查更新（请升级 DSH）。',
  localSource: '本地路径安装，无法检查更新。',
  available: '有新版本 {target}',
  availableAt: '有新版本 {target}（当前 {current}）',
  availableUnsupported: '有新版本 {target}，但此部署不支持应用内更新。',
  enabled: '网页端显示',
  'enabled.hint': '关闭后网页端宠物不渲染（桌面伴侣并存时用）。',
  sessionMemory: '会话记忆',
  'sessionMemory.hint': '宠物把任务完成等里程碑写进本机 data/whale-girl/sessions.json（几字节/条），会话恢复或分支（fork）时沿会话血缘读回，重逢时说一句上次完成了什么。\n只写本机文件：不进模型上下文、不上传网络；关闭即停止读写（文件保留在本机，可自行删除）。',
  size: '尺寸',
  'size.hint': '宠物绘制尺寸（64–160 px）。',
  opacity: '透明度',
  'opacity.hint': '常态透明度（0.2–1）。',
  walk: '游走',
  'walk.hint': '关闭后宠物不再四处游走。',
  sleep: '睡眠等待',
  'sleep.hint': '空闲多久进入睡眠（毫秒）。',
  feed: '投喂回话',
  'feed.hint': '每行一条，空行忽略；清空回退内置文案。',
  play: '玩耍回话',
  'play.hint': '每行一条，空行忽略；清空回退内置文案。',
  idle: '闲聊',
  'idle.hint': '每行一条，空行忽略；空则使用内置文案。宠物空闲时会随机说一句。',
  voice: '语音',
  'voice.hint': '打开后宠物把回答说出来。',
  voiceProvider: '语音引擎',
  'voiceProvider.hint': 'browser = 系统语音；openai = 通过 /audio/speech 调用的 TTS 模型。',
  voiceSttModel: '语音识别模型',
  'voiceSttModel.hint': '麦克风转文字用的模型（默认 whisper-1），走 /audio/transcriptions。',
  voiceBaseUrl: 'TTS 地址',
  'voiceBaseUrl.hint': '例如 https://api.openai.com/v1 或 http://localhost:8880/v1。',
  voiceModel: 'TTS 模型',
  'voiceModel.hint': '例如 tts-1 / gpt-4o-mini-tts 或本地模型。',
  voiceName: '音色',
  'voiceName.hint': '音色名/ID；留空 = 自动（browser 用俄语语音）。',
  voiceApiKeyEnv: '密钥变量',
  'voiceApiKeyEnv.hint': '存放 TTS 密钥的环境变量名；留空 = 不带鉴权。',
  voiceRate: '语速',
  'voiceRate.hint': '0.5–2（系统语音）。',
  voiceAutoSpeak: '朗读长回答',
  'voiceAutoSpeak.hint': '只朗读对话中的长回答；短句和事件提示不出声。默认关闭。',
  voiceMinSpeakChars: '朗读阈值',
  'voiceMinSpeakChars.hint': '回答至少多少字符才朗读（0 = 任何非空回答）。',
  voiceConversation: '连续对话',
  'voiceConversation.hint': '回答后继续听麦克风，不用每次重按。',
  chat: '对话',
  'chat.hint': '显示「Поговорить」按钮并允许与宠物对话。',
  chatModel: '对话模型',
  'chatModel.hint': '宠物回复所用的提供方/模型；留空 = 宿主的默认模型。',
  chatModelDefault: '默认（宿主模型）',
  chatPersona: '人设',
  'chatPersona.hint': '对话的系统提示词；留空 = 内置人设。',
  news: '新闻',
  'news.hint': '允许宠物在聊天里用新鲜的 RSS/Atom 新闻回答。',
  newsMaxItems: '新闻条数',
  'newsMaxItems.hint': '每次取几条头条（1–10）。',
  newsFeeds: '新闻源',
  'newsFeeds.hint': '每行一个 RSS/Atom 地址；空行忽略。',
}

export const en = {
  "chatModel": "Chat model",
  "chatModel.hint": "Model for pet replies; empty uses the DSH default.",
  "chatModelDefault": "DSH default",
  "news": "News",
  "news.hint": "Fetch RSS/Atom headlines when asked.",
  "newsMaxItems": "Headline count",
  "newsMaxItems.hint": "Headlines to include in a reply (1–10).",
  "newsFeeds": "News feeds",
  "newsFeeds.hint": "RSS/Atom URLs, one per line.",

  voiceBrowserOption: 'System voice',
  voiceApiOption: 'OpenAI API (billed separately)',
  voiceSubscriptionOption: 'ChatGPT subscription: audio unavailable',

  description: 'Size, opacity, wandering, session memory and reply copy — applied live',
  writeFailed: 'The deployment did not accept that change; the current value was read back.',
  readOnly: 'This deployment is read-only.',
  update: 'Update',
  check: 'Check for Updates…',
  checking: 'Checking…',
  latest: 'Up to date',
  latestAt: 'Up to date (currently {current})',
  updateTo: 'Update to {target}…',
  updateToRef: 'Track {ref}…',
  availableLocal: 'New version {target} (currently {current}); updating switches to {ref}',
  checkRateLimited: 'Upstream request is rate limited (GitHub); try again later.',
  updateFailedEnabled: 'Update failed: the enabled state could not be read, so nothing changed.',
  updateFailedSource: 'Update failed: this install source is not recognised.',
  updateFailedTracking: 'Update failed; try again later. The profile is now pinned to {spec} — switch it back to a branch to keep tracking.',
  updating: 'Updating…',
  updated: 'Updated.',
  updatedRestart: 'Updated; the change takes effect on next start.',
  updatedOverridden: 'Updated, but a higher-priority configuration overrides it for now.',
  updateFailed: 'Update failed; try again later.',
  updateFailedDetail: 'Update failed; try again later. ({reason})',
  checkFailed: 'Could not run the check; try again later.',
  reasonSeparator: ': ',
  updateUnsupported: 'In-app update is unavailable on this deployment.',
  updateUnknown: 'Could not reach the source.',
  hostOutdated: 'This host is too old to check for updates (upgrade DSH).',
  localSource: 'Installed from a local path; update check unavailable.',
  available: 'New version {target}',
  availableAt: 'New version {target} (currently {current})',
  availableUnsupported: 'New version {target}, but this deployment cannot update plugins.',
  enabled: 'Show on page',
  'enabled.hint': 'Off hides the in-page pet (e.g. while a desktop companion runs).',
  sessionMemory: 'Session memory',
  'sessionMemory.hint': 'The pet writes milestones such as completed tasks to the local data/whale-girl/sessions.json (a few bytes each) and reads them back along the session lineage when a session resumes or forks, greeting you with what you finished last time.\nLocal file only: never sent to the model context, never uploaded; turning it off stops all reads and writes (the file stays on this machine and can be deleted).',
  size: 'Size',
  'size.hint': 'Pet render size (64–160 px).',
  opacity: 'Opacity',
  'opacity.hint': 'Default opacity (0.2–1).',
  walk: 'Wander',
  'walk.hint': 'Off stops the pet wandering.',
  sleep: 'Sleep delay',
  'sleep.hint': 'Idle time before sleeping (ms).',
  feed: 'Feed replies',
  'feed.hint': 'One per line, empty lines ignored; empty falls back to built-in copy.',
  play: 'Play replies',
  'play.hint': 'One per line, empty lines ignored; empty falls back to built-in copy.',
  idle: 'Chit-chat',
  'idle.hint': 'One per line, empty lines ignored; empty falls back to built-in copy. Spoken at random while idle.',
  voice: 'Voice',
  'voice.hint': 'Speak answers out loud.',
  voiceProvider: 'Voice engine',
  'voiceProvider.hint': 'browser = system speech; openai = a TTS model via /audio/speech.',
  voiceSttModel: 'Speech-to-text model',
  'voiceSttModel.hint': 'Model used for the microphone (default gpt-transcribe), via /audio/transcriptions.',
  voiceBaseUrl: 'TTS endpoint',
  'voiceBaseUrl.hint': 'For example https://api.openai.com/v1 or http://localhost:8880/v1.',
  voiceModel: 'TTS model',
  'voiceModel.hint': 'For example tts-1 / gpt-4o-mini-tts / a local model.',
  voiceName: 'Voice',
  'voiceName.hint': 'Voice name/ID; empty = auto (Russian voice for browser).',
  voiceApiKeyEnv: 'Key variable',
  'voiceApiKeyEnv.hint': 'Name of the environment variable holding the TTS key; empty = no auth.',
  voiceRate: 'Speech rate',
  'voiceRate.hint': '0.5–2 (system voice).',
  voiceAutoSpeak: 'Read long answers',
  'voiceAutoSpeak.hint': 'Read only long chat answers aloud; short replies and event lines stay silent. Off by default.',
  voiceMinSpeakChars: 'Reading threshold',
  'voiceMinSpeakChars.hint': 'Minimum reply length to read aloud (0 = any non-empty reply).',
  voiceConversation: 'Conversation mode',
  'voiceConversation.hint': 'Keep listening after each answer instead of pressing the mic again.',
  chat: 'Chat',
  'chat.hint': 'Show the chat button and let you talk to the pet.',
  chatPersona: 'Persona',
  'chatPersona.hint': 'System prompt for the chat; empty = built-in persona.',
}

// Russian is this branch's primary language; retain upstream Chinese/English translations.
export const ru = {
  "chatModel": "Модель беседы",
  "chatModel.hint": "Модель для ответов питомца; по умолчанию используется модель DSH.",
  "chatModelDefault": "По умолчанию DSH",
  "news": "Новости",
  "news.hint": "Разрешить питомцу читать RSS/Atom по запросу.",
  "newsMaxItems": "Число новостей",
  "newsMaxItems.hint": "Сколько заголовков использовать в ответе (1–10).",
  "newsFeeds": "Ленты новостей",
  "newsFeeds.hint": "Адреса RSS/Atom, по одному на строку.",

  voiceBrowserOption: 'Системный голос',
  voiceApiOption: 'OpenAI API (отдельная оплата)',
  voiceSubscriptionOption: 'Подписка ChatGPT — аудио недоступно',

  description: 'Размер, прозрачность, прогулки, память сессий и фразы — изменения применяются сразу',
  writeFailed: 'Изменение не принято; прочитано текущее значение.',
  readOnly: 'Эта установка доступна только для чтения.',
  update: 'Обновление',
  check: 'Проверить обновления…',
  checking: 'Проверка…',
  latest: 'Актуальная версия',
  latestAt: 'Актуальная версия (сейчас {current})',
  updateTo: 'Обновить до {target}…',
  updateToRef: 'Перейти на {ref}…',
  availableLocal: 'Доступна новая версия {target} (сейчас {current}); обновление переключит на {ref}',
  checkRateLimited: 'Запрос к источнику ограничен (GitHub); попробуйте позже.',
  updateFailedEnabled: 'Обновление не удалось: не удалось прочитать состояние включения, ничего не изменено.',
  updateFailedSource: 'Обновление не удалось: источник установки не распознан.',
  updateFailedTracking: 'Обновление не удалось; попробуйте позже. Профиль закреплён на {spec} — чтобы снова отслеживать ветку, верните её вручную.',
  updating: 'Обновление…',
  updated: 'Обновлено.',
  updatedRestart: 'Обновлено; изменения вступят в силу при следующем запуске.',
  updatedOverridden: 'Обновлено, но сейчас перекрыто конфигурацией с более высоким приоритетом.',
  updateFailed: 'Обновление не удалось; попробуйте позже.',
  updateFailedDetail: 'Обновление не удалось; попробуйте позже. ({reason})',
  checkFailed: 'Не удалось проверить; попробуйте позже.',
  reasonSeparator: ': ',
  updateUnsupported: 'Встроенное обновление недоступно в этой установке.',
  updateUnknown: 'Не удалось получить данные об источнике.',
  hostOutdated: 'Версия хоста слишком стара для проверки обновлений (обновите DSH).',
  localSource: 'Установлено из локального пути; проверка обновлений недоступна.',
  available: 'Доступна новая версия {target}',
  availableAt: 'Доступна новая версия {target} (сейчас {current})',
  availableUnsupported: 'Доступна новая версия {target}, но эта установка не умеет обновлять плагины.',
  enabled: 'Показывать на странице',
  'enabled.hint': 'Выкл. скрывает питомца в веб-интерфейсе (например, пока работает настольный компаньон).',
  sessionMemory: 'Память сессий',
  'sessionMemory.hint': 'Питомец записывает вехи (выполненные задачи) в локальный data/whale-girl/sessions.json (несколько байт на запись) и при возобновлении или форке сессии читает их по цепочке сессий, приветствуя вас тем, что было сделано в прошлый раз.\nТолько локальный файл: не попадает в контекст модели и не отправляется в сеть; выключение останавливает чтение и запись (файл остаётся на машине, его можно удалить).',
  size: 'Размер',
  'size.hint': 'Размер питомца в пикселях (64–160).',
  opacity: 'Прозрачность',
  'opacity.hint': 'Обычная прозрачность (0.2–1).',
  walk: 'Прогулки',
  'walk.hint': 'Выкл. — питомец перестаёт гулять.',
  sleep: 'Задержка сна',
  'sleep.hint': 'Сколько простоя до сна (мс).',
  feed: 'Фразы на кормление',
  'feed.hint': 'По одной на строку; пустые строки игнорируются; пусто — встроенные фразы.',
  play: 'Фразы на игру',
  'play.hint': 'По одной на строку; пустые строки игнорируются; пусто — встроенные фразы.',
  idle: 'Болтовня',
  'idle.hint': 'По одной на строку; пустые строки игнорируются; пусто — встроенные фразы. Питомец говорит их сам, когда скучает.',
  voice: 'Голос',
  'voice.hint': 'Озвучивать ответы вслух.',
  voiceProvider: 'Движок голоса',
  'voiceProvider.hint': 'Системный голос или отдельно оплачиваемый OpenAI API. Подписка ChatGPT не включает голосовой API.',
  voiceSttModel: 'Модель распознавания',
  'voiceSttModel.hint': 'Модель «микрофон → текст» через /audio/transcriptions; по умолчанию gpt-transcribe. Для OpenAI нужен API-ключ.',
  voiceBaseUrl: 'Адрес TTS',
  'voiceBaseUrl.hint': 'Например https://api.openai.com/v1 или http://localhost:8880/v1.',
  voiceModel: 'Модель TTS',
  'voiceModel.hint': 'Realtime: gpt-realtime-2.1-mini; совместимый TTS: gpt-4o-mini-tts или локальная модель.',
  voiceName: 'Голос',
  'voiceName.hint': 'Имя/ид голоса; пусто — авто (для browser — русский голос).',
  voiceApiKeyEnv: 'Переменная ключа',
  'voiceApiKeyEnv.hint': 'Переменная окружения DSH с API-ключом для TTS и распознавания. Подписочный токен не подходит.',
  voiceRate: 'Скорость речи',
  'voiceRate.hint': '0.5–2 (системный голос).',
  voiceAutoSpeak: 'Читать длинные ответы',
  'voiceAutoSpeak.hint': 'Озвучивать только длинные ответы в беседе; короткие реплики и события остаются без голоса. По умолчанию выключено.',
  voiceMinSpeakChars: 'Порог чтения',
  'voiceMinSpeakChars.hint': 'Минимум символов в ответе, чтобы зачитать его вслух (0 — любой непустой ответ).',
  voiceConversation: 'Режим разговора',
  'voiceConversation.hint': 'После ответа снова слушать микрофон — не нужно каждый раз нажимать.',
  chat: 'Беседа',
  'chat.hint': 'Показать кнопку «Поговорить» и разрешить беседу с питомцем.',
  chatPersona: 'Характер',
  'chatPersona.hint': 'Системный промпт беседы; пусто — встроенный характер.',
}

const el = React.createElement

/**
 * Numeric input buffers local text and commits parsed values on blur/Enter; invalid parsing
 * restores the current value.
 */
function NumberField({ value, min, max, disabled, label, onChange, resetToken }: ValueFieldProps<number> & { min: number; max: number; step: number }) {
  const initial = value === undefined || value === null ? '' : String(value)
  const [text, setText] = React.useState(initial)
  const [lastKey, setLastKey] = React.useState(initial)
  const [lastReset, setLastReset] = React.useState(resetToken)
  // Synchronize during rendering when external values change (accepted writes/other clients) or
  // resetToken advances after rejection. Rejection leaves the host value unchanged, so only
  // resetToken can reset the rejected local input.
  if (initial !== lastKey || resetToken !== lastReset) {
    setLastKey(initial)
    setLastReset(resetToken)
    setText(initial)
  }
  const commit = () => {
    const parsed = Number(text)
    if (text.trim() === '' || !Number.isFinite(parsed)) {
      setText(initial)
      return
    }
    const clamped = Math.min(max, Math.max(min, parsed))
    onChange(clamped)
    if (clamped !== parsed) setText(String(clamped))
  }
  // Official Input owns the outer appearance (32 px height, 0.5px border-l4, radius-md,
  // bg-layer-1). style targets its inner input, so specify width/right alignment here. commit above
  // still validates range.
  return el(Input, {
    type: 'text',
    inputMode: 'numeric',
    value: text,
    disabled,
    'aria-label': label,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setText(e.currentTarget.value) },
    onBlur: commit,
    onKeyDown: (e) => { if (e.key === 'Enter') e.currentTarget.blur() },
    style: { width: 88, textAlign: 'right' },
  })
}

/** Phrase-pool textarea: one entry per line; commit parseLines on blur. */
function LinesField({ value, disabled, label, onChange, resetToken }: ValueFieldProps<string[]>) {
  const initial = serializeLines(value)
  const [text, setText] = React.useState(initial)
  const [lastKey, setLastKey] = React.useState(initial)
  const [lastReset, setLastReset] = React.useState(resetToken)
  // Like NumberField, rejected writes leave the host value unchanged; resetToken restores input
  // from it.
  if (initial !== lastKey || resetToken !== lastReset) {
    setLastKey(initial)
    setLastReset(resetToken)
    setText(initial)
  }
  return el('textarea', {
    rows: 3,
    value: text,
    disabled,
    'aria-label': label,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setText(e.currentTarget.value) },
    onBlur: () => { onChange(parseLines(text)) },
    style: {
      flex: 'none', width: 240, padding: '6px 8px', resize: 'vertical',
      border: '0.5px solid var(--dsw-alias-border-l4)', borderRadius: 'var(--dsw-radius-md)',
      background: 'var(--dsw-alias-bg-layer-1)',
      color: 'var(--dsw-alias-label-primary)', font: 'inherit', fontSize: 14,
      lineHeight: 1.5, boxSizing: 'border-box', opacity: disabled ? 0.4 : 1,
    },
  })
}

/** Single-line local text buffer; commit on blur/Enter. */
function TextField({ value, disabled, label, onChange, resetToken }: ValueFieldProps<string>) {
  const initial = typeof value === 'string' ? value : ''
  const [text, setText] = React.useState(initial)
  const [lastKey, setLastKey] = React.useState(initial)
  const [lastReset, setLastReset] = React.useState(resetToken)
  if (initial !== lastKey || resetToken !== lastReset) {
    setLastKey(initial)
    setLastReset(resetToken)
    setText(initial)
  }
  const commit = () => {
    const next = text.trim()
    if (next !== initial) onChange(next)
  }
  return el(Input, {
    type: 'text',
    value: text,
    disabled,
    'aria-label': label,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setText(e.currentTarget.value) },
    onBlur: commit,
    onKeyDown: (e) => { if (e.key === 'Enter') e.currentTarget.blur() },
    style: { width: 220 },
  })
}

/** Multi-line persona text; commit the complete string on blur. */
function MultilineField({ value, disabled, label, onChange, resetToken }: ValueFieldProps<string>) {
  const initial = typeof value === 'string' ? value : ''
  const [text, setText] = React.useState(initial)
  const [lastKey, setLastKey] = React.useState(initial)
  const [lastReset, setLastReset] = React.useState(resetToken)
  if (initial !== lastKey || resetToken !== lastReset) {
    setLastKey(initial)
    setLastReset(resetToken)
    setText(initial)
  }
  return el('textarea', {
    rows: 3,
    value: text,
    disabled,
    'aria-label': label,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setText(e.currentTarget.value) },
    onBlur: () => { if (text.trim() !== initial) onChange(text.trim()) },
    style: {
      flex: 'none', width: 240, padding: '6px 8px', resize: 'vertical',
      border: '0.5px solid var(--dsw-alias-border-l4)', borderRadius: 'var(--dsw-radius-md)',
      background: 'var(--dsw-alias-bg-layer-1)',
      color: 'var(--dsw-alias-label-primary)', font: 'inherit', fontSize: 14,
      lineHeight: 1.5, boxSizing: 'border-box', opacity: disabled ? 0.4 : 1,
    },
  })
}

/**
 * The first settings row shows update status/actions: check upstream and apply available updates.
 * Do not duplicate current version/source, already shown by package-page source information. Show
 * the target as short git commit or registry version. Node delegates updates to the host profile
 * package manager, which locks the profile, runs pnpm, and rolls back manifest/lock on failure;
 * this UI only requests and displays results. Follow macOS Check for Updates... wording: verb plus
 * ellipsis denotes a pending operation. Display versions unchanged, without adding v.
 */
function UpdateRow({ t }: { t: Translate }) {
  // Pure reduceRow owns transitions. The component dispatches events rather than manually
  // synchronizing useState values that could otherwise diverge in status/color.
  const [row, setRow] = React.useState(ROW_INITIAL)
  const dispatch = (event: UpdateRowEvent) => { setRow((state) => reduceRow(state, event)) }
  const labelId = React.useId()
  const statusId = React.useId()

  const load = React.useCallback(async () => {
    setRow((state) => reduceRow(state, { type: 'check-started' }))
    try {
      const response = await fetch(UPDATE_PATH, { headers: { accept: 'application/json' } })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const info = await response.json()
      setRow((state) => reduceRow(state, { type: 'checked', info }))
    } catch {
      setRow((state) => reduceRow(state, { type: 'check-failed' }))
    }
  }, [])

  React.useEffect(() => { void load() }, [load])

  const run = async () => {
    dispatch({ type: 'update-started' })
    try {
      const response = await fetch(UPDATE_PATH, { method: 'POST', headers: { accept: 'application/json' } })
      const payload = await response.json().catch(() => undefined)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      // Host application results are authoritative: failures/cancellations must not say updated,
      // and hot application must not request restart.
      dispatch({ type: 'settled', ...outcomeOf(payload, t) })
    } catch {
      // Represent request failures as failures too, including error tone.
      dispatch({ type: 'settled', phase: 'ready', notice: t('updateFailed'), tone: 'error' })
    }
  }

  const { status, tone, action } = deriveUpdateRow({ ...row, translate: t, onCheck: load, onUpdate: run })

  return el('div', {
    'data-whale-girl-update': '',
    role: 'group',
    'aria-labelledby': labelId,
    'aria-describedby': statusId,
    style: {
      display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0',
      borderBottom: '0.5px solid var(--dsw-alias-border-l2)',
    },
  },
  el('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 } },
    el('span', { id: labelId, style: { fontSize: 13, fontWeight: 500, lineHeight: 1.5, color: 'var(--dsw-alias-label-primary)' } }, t('update')),
    el('span', {
      id: statusId,
      role: 'status',
      style: {
        fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-line',
        color: tone === 'error' ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-label-tertiary)',
      },
    }, status),
  ),
  el('span', { style: { flex: 'none', display: 'flex', alignItems: 'center', gap: 8 } },
    el(Button, {
      variant: action.primary === true ? 'primary' : 'outline',
      size: 'sm',
      disabled: action.disabled,
      'aria-describedby': statusId,
      onClick: () => { void action.run() },
    }, action.label),
  ))
}

/** Native select styled like the official Input; primitives has no Select component. */
function SelectField({ value, options, disabled, label, onChange, t }: ValueFieldProps<string> & { options: string[]; t: Translate }) {
  const current = typeof value === 'string' ? value : ''
  return el('select', {
    value: current,
    disabled,
    'aria-label': label,
    onChange: (event: React.ChangeEvent<HTMLSelectElement>) => onChange(event.currentTarget.value),
    style: {
      width: 220, padding: '6px 8px', fontSize: 14, font: 'inherit',
      border: '0.5px solid var(--dsw-alias-border-l4)', borderRadius: 'var(--dsw-radius-md)',
      background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)',
      boxSizing: 'border-box', opacity: disabled ? 0.4 : 1,
    },
  }, (Array.isArray(options) ? options : []).map((option) => el('option', {
    key: option, value: option,
  }, option === 'openai' ? t('voiceApiOption') : option === 'subscription' ? t('voiceSubscriptionOption') : option === 'browser' ? t('voiceBrowserOption') : option)))
}

/** Chat model selector loads GET /models; on failure expose provider/model text fields. */
function ModelField({ value, disabled, label, hintDefault, resetToken, onSelect, onWritePair }: Omit<ValueFieldProps<string>, 'onChange'> & { hintDefault: string; onSelect: (key: string) => void; onWritePair: (path: string, text: string) => void }) {
  const [options, setOptions] = React.useState<ModelOption[] | null>(null)
  const [failed, setFailed] = React.useState(false)
  React.useEffect(() => {
    let alive = true
    fetch(MODELS_PATH, { headers: { accept: 'application/json' } })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((body) => {
        if (!alive) return
        const list = Array.isArray(body?.options) ? body.options : []
        setOptions(list.filter((option: ModelOption | null) => option !== null && typeof option === 'object'
          && typeof option.provider === 'string' && typeof option.model === 'string'))
        setFailed(false)
      })
      .catch(() => {
        if (alive) { setOptions([]); setFailed(true) }
      })
    return () => { alive = false }
  }, [])
  const route = splitModelKey(value)
  if (failed) {
    // If model enumeration is unavailable because of missing llm service/network, edit the same
    // provider/model leaves directly.
    return el('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
      el(TextField, { value: route?.provider ?? '', disabled, label: `${label}: provider`, resetToken, onChange: (text) => onWritePair('chat.provider', text) }),
      el(TextField, { value: route?.model ?? '', disabled, label: `${label}: model`, resetToken, onChange: (text) => onWritePair('chat.model', text) }),
    )
  }
  const current = route === null ? '' : modelKey(route.provider, route.model)
  const known = options ?? []
  const rows = [{ key: '', label: hintDefault }]
  if (current !== '' && !known.some((option) => modelKey(option.provider, option.model) === current)) {
    rows.push({ key: current, label: `${route?.provider} / ${route?.model}` })
  }
  for (const option of known) {
    const key = modelKey(option.provider, option.model)
    const text = typeof option.label === 'string' && option.label !== ''
      ? option.label
      : `${option.provider} / ${option.model}`
    rows.push({ key, label: text })
  }
  return el('select', {
    value: current,
    disabled: disabled || options === null,
    'aria-label': label,
    onChange: (event: React.ChangeEvent<HTMLSelectElement>) => onSelect(event.currentTarget.value),
    style: {
      width: 220, padding: '6px 8px', fontSize: 14, font: 'inherit',
      border: '0.5px solid var(--dsw-alias-border-l4)', borderRadius: 'var(--dsw-radius-md)',
      background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)',
      boxSizing: 'border-box', opacity: disabled || options === null ? 0.4 : 1,
    },
  }, rows.map((row) => el('option', { key: row.key === '' ? '__default' : row.key, value: row.key }, row.label)))
}

/**
 * Package-page form in plugins.bundle.config: the page owns icon/title/description; this component
 * renders page fields with immediate saving and no save footer.
 */
export function WhaleSettingsCard(props: CardProps) {
  // Call hooks before view branches to preserve React hook order. The package page requests page;
  // retain a one-line summary fallback if another host surface renders the same registration as
  // summary.
  const state = props.useWhaleSettings((s) => s)
  const [failed, setFailed] = React.useState(false)
  const [resetToken, setResetToken] = React.useState(0)
  const t = props.t
  if (props.view === 'summary') return t('description')
  if (!state.available) return null
  const disabled = !state.writable

  // Immediate writes: rejection shows one notice below fields and advances resetToken to restore
  // text buffers. Snapshot-derived switches reset automatically.
  const commit = (def: CardField, value: unknown) => {
    setFailed(false)
    Promise.resolve(props.write(def.path, value)).catch(() => {
      setFailed(true)
      setResetToken((n) => n + 1)
    })
  }
  // writeFields changes provider and model together in one transaction.
  const commitPaths = (pairs: [string, unknown][]) => {
    setFailed(false)
    Promise.resolve(props.writeMany(pairs)).catch(() => {
      setFailed(true)
      setResetToken((n) => n + 1)
    })
  }
  const commitRoute = (key: string) => {
    const route = splitModelKey(key)
    commitPaths(route === null
      ? [['chat.provider', ''], ['chat.model', '']]
      : [['chat.provider', route.provider], ['chat.model', route.model]])
  }

  const row = (def: CardField, index: number) => {
    const control = def.kind === 'toggle'
      ? el(Switch, { checked: state.fields[def.path] === true, disabled, label: t(def.labelKey), onChange: (checked) => { commit(def, checked) } })
      : def.kind === 'number'
        ? el(NumberField, { value: state.fields[def.path], min: def.min, max: def.max, step: def.step, disabled, label: t(def.labelKey), onChange: (value) => { commit(def, value) }, resetToken })
        : def.kind === 'lines'
          ? el(LinesField, { value: state.fields[def.path], disabled, label: t(def.labelKey), onChange: (lines) => { commit(def, lines) }, resetToken })
          : def.kind === 'multiline'
            ? el(MultilineField, { value: state.fields[def.path], disabled, label: t(def.labelKey), onChange: (text) => { commit(def, text) }, resetToken })
            : def.kind === 'model'
              ? el(ModelField, {
                value: state.fields[def.path], disabled, label: t(def.labelKey),
                hintDefault: t('chatModelDefault'), resetToken, onSelect: commitRoute,
                onWritePair: (path, text) => commitPaths([[path, text]]),
              })
              : def.kind === 'select'
                ? el(SelectField, { t, value: state.fields[def.path], options: def.options, disabled, label: t(def.labelKey), onChange: (value) => { commit(def, value) } })
                : el(TextField, { value: state.fields[def.path], disabled, label: t(def.labelKey), onChange: (text) => { commit(def, text) }, resetToken })
    return el('div', {
      key: def.path,
      style: {
        display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0',
        borderBottom: index < CARD_FIELDS.length - 1 ? '0.5px solid var(--dsw-alias-border-l2)' : 'none',
      },
    }, el('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 } },
      el('span', { style: { fontSize: 13, fontWeight: 500, lineHeight: 1.5, color: 'var(--dsw-alias-label-primary)' } }, t(def.labelKey)),
      el('span', { style: { fontSize: 12, lineHeight: 1.5, color: 'var(--dsw-alias-label-tertiary)', whiteSpace: 'pre-line' } }, t(`${def.labelKey}.hint`)),
    ), control)
  }

  return el('div', {
    'data-whale-girl-settings-card': '',
    style: { display: 'flex', flexDirection: 'column', boxSizing: 'border-box' },
  },
  disabled ? el('p', { role: 'status', style: { margin: '0 0 8px', fontSize: 12, lineHeight: 1.5, color: 'var(--dsw-alias-label-tertiary)' } }, t('readOnly')) : null,
  el('div', { style: { display: 'flex', flexDirection: 'column', gap: 0 } },
    el(UpdateRow, { key: 'update', t }),
    CARD_FIELDS.map((def, index) => row(def, index)),
  ),
  failed ? el('p', { role: 'status', style: { margin: '12px 0 0', fontSize: 12, lineHeight: 1.5, color: 'var(--dsw-alias-state-error-primary)' } }, t('writeFailed')) : null,
  )
}

/**
 * Register the keyed plugins.bundle.config card and locale; return its apply-owned disposer.
 * @param {object} ctx Browser context declaring slots/locale/configForms in inject.
 * @param {string} namespace Settings namespace/entry ID used for reads and writes.
 * @param {object} defaults Leaf defaults supplied as CFG_DEFAULTS by index.mjs.
 */
export function registerWhaleSettingsCard(ctx: SettingsClientContext, namespace: string, defaults: SettingsValues) {
  const scope = ctx.configForms.get(namespace)
  const offLocale = ctx.locale.register(SETTINGS_NS, { zh, en, ru })
  // useSyncExternalStore requires stable snapshot references: return the same object for unchanged
  // content to avoid infinite React rendering (#185). The host replaces snapshot objects on
  // changes, so cache by identity.
  let cache: { snap: ConfigSnapshot; state: SettingsState } | undefined
  const getSnapshot = () => {
    const snap = scope.getSnapshot()
    if (cache !== undefined && cache.snap === snap) return cache.state
    cache = { snap, state: deriveState(snap, defaults) }
    return cache.state
  }
  // whileServed registers after the namespace enters the host describe mirror and removes the card
  // when it leaves. slots.inject waits for slot declaration when the plugin-manager page mounts.
  // Use keyed plugins.bundle.config with the package-name key; plugins.item is reserved for
  // built-in official settings and would incorrectly classify this third-party card.
  const offServed = ctx.configForms.whileServed([namespace], () =>
    ctx.slots.inject('plugins.bundle.config', () =>
      ctx.slots.register({
        name: 'plugins.bundle.config',
        key: namespace, // Keyed slot: the key must match the bundle package name to render on its package page.
        locale: SETTINGS_NS,
        inject: () => ({
          hooks: { whaleSettings: { getSnapshot, subscribe: (listener) => scope.subscribe(listener) } },
          write: (path, value) => writeField(scope, path, value),
          writeMany: (pairs) => writeFields(scope, pairs),
        }),
      }, WhaleSettingsCard)))
  return () => { offServed(); offLocale() }
}
