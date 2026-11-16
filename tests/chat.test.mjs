// Беседа (src/chat.mjs) — чистые функции: нормализация реплик, история, характер.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CHAT_HISTORY_MAX, CHAT_PERSONA, CHAT_REPLY_MAX, CHAT_TEXT_MAX,
  appendHistory, bubbleText, buildChatMessages, fallbackReply, normalizeChatText, normalizeReply, personaFor, speechText,
} from '../lib/src/chat.mjs'

test('normalizeChatText: схлопывает пробелы, обрезает, пустое → null', () => {
  assert.equal(normalizeChatText('  привет \n мир  '), 'привет мир')
  assert.equal(normalizeChatText(''), null)
  assert.equal(normalizeChatText('   '), null)
  assert.equal(normalizeChatText(undefined), null)
  assert.equal(normalizeChatText(42), null)
  const long = 'а'.repeat(CHAT_TEXT_MAX + 20)
  assert.equal(normalizeChatText(long).length, CHAT_TEXT_MAX)
})

test('buildChatMessages: история + текущая реплика, битые записи пропускаются', () => {
  const messages = buildChatMessages({
    history: [
      { role: 'user', text: 'как дела?' },
      { role: 'assistant', text: 'хорошо!' },
      null,
      { role: 'user', text: '   ' },
    ],
    text: 'а у тебя?',
    assistant: { provider: 'mock-provider', model: 'mock-model' },
  })
  assert.deepEqual(messages.map((m) => m.role), ['user', 'assistant', 'user'])
  assert.deepEqual(messages[0].content, [{ type: 'text', text: 'как дела?' }])
  assert.deepEqual(messages[1].content, [{ type: 'text', text: 'хорошо!' }])
  assert.deepEqual(messages[1].source, { kind: 'model', provider: 'mock-provider', model: 'mock-model' }, 'ответы питомца — durable-сообщения')
  assert.equal(typeof messages[1].id, 'string')
  assert.deepEqual(messages[2].content, [{ type: 'text', text: 'а у тебя?' }])
})

test('buildChatMessages: без provider/model ответы истории пропускаются (не ломаем запрос)', () => {
  const messages = buildChatMessages({
    history: [{ role: 'user', text: 'вопрос' }, { role: 'assistant', text: 'ответ' }],
    text: 'ещё вопрос',
  })
  assert.deepEqual(messages.map((m) => m.role), ['user', 'user'])
})

test('appendHistory: кольцо по лимиту, не мутирует вход', () => {
  const base = []
  const one = appendHistory(base, 'user', 'a', 4)
  assert.deepEqual(base, [], 'вход не меняется')
  const full = appendHistory(appendHistory(appendHistory(one, 'assistant', 'b', 4), 'user', 'c', 4), 'assistant', 'd', 4)
  assert.deepEqual(full.map((t) => t.text), ['a', 'b', 'c', 'd'])
  const ring = appendHistory(full, 'user', 'e', 4)
  assert.deepEqual(ring.map((t) => t.text), ['b', 'c', 'd', 'e'])
  assert.deepEqual(appendHistory(full, 'user', 'e', 0), [], 'лимит 0 — пустая история')
  assert.ok(appendHistory([], 'user', 'x', 999).length === 1)
})

test('normalizeReply: markdown/переводы строк → одна строка, обрезка', () => {
  assert.equal(normalizeReply('**Привет!**\n\nЯ тут.'), 'Привет! Я тут.')
  assert.equal(normalizeReply('- пункт один\n- пункт два'), 'пункт один пункт два')
  assert.equal(normalizeReply('```js\nconst x = 1\n```\nГотово'), 'Готово')
  assert.equal(normalizeReply('  '), '')
  assert.equal(normalizeReply(null), '')
  const long = normalizeReply('я'.repeat(CHAT_REPLY_MAX + 50))
  assert.equal(long.length, CHAT_REPLY_MAX)
  assert.ok(long.endsWith('…'))
})

test('personaFor: встроенный характер + факты стажа; свой промпт заменяет базу', () => {
  assert.ok(personaFor(null).includes(CHAT_PERSONA))
  const pet = { level: 3, stats: { tasksDone: 12, sessions: 5 }, titles: ['Первое сотрудничество'] }
  const text = personaFor(pet)
  assert.ok(text.includes('уровень 3'))
  assert.ok(text.includes('выполнено задач: 12'))
  assert.ok(text.includes('звания: Первое сотрудничество'))
  const custom = personaFor(pet, 'говори как пират')
  assert.ok(custom.startsWith('говори как пират'))
  assert.ok(!custom.includes(CHAT_PERSONA), 'свой промпт заменяет встроенный')
})

test('personaFor: битый pet не ломает характер', () => {
  assert.equal(personaFor('nope'), CHAT_PERSONA)
  assert.equal(personaFor({ level: 'x', stats: null, titles: 'x' }), CHAT_PERSONA)
})

test('fallbackReply: всегда непустая фраза из резервного пула', () => {
  for (const random of [() => 0, () => 0.5, () => 0.99]) {
    const line = fallbackReply(random)
    assert.equal(typeof line, 'string')
    assert.ok(line.length > 0)
  }
  assert.ok(fallbackReply(() => 0).startsWith('«'))
})

test('CHAT_HISTORY_MAX: конфиг не может превысить жёсткий предел', () => {
  let history = []
  for (let i = 0; i < CHAT_HISTORY_MAX + 10; i += 1) {
    history = appendHistory(history, i % 2 === 0 ? 'user' : 'assistant', `t${i}`, 999)
  }
  assert.equal(history.length, CHAT_HISTORY_MAX)
})

test('bubbleText: одна строка, обрезка по концу предложения или по слову + …', () => {
  assert.equal(bubbleText('Привет! Как дела?'), 'Привет! Как дела?')
  const long = 'Первое предложение. Второе предложение. Третье предложение.'
  assert.equal(bubbleText(long, 20), 'Первое предложение…')
  assert.ok(bubbleText('слово '.repeat(40), 30).endsWith('…'))
  assert.ok(bubbleText('слово '.repeat(40), 30).length <= 31)
  assert.equal(bubbleText('', 10), '')
  assert.equal(bubbleText(null, 10), '')
})

test('speechText: убирает эмодзи и «», сохраняя слова', () => {
  assert.equal(speechText('Привет! 🐳 Я «кит» — и это классно 😊'), 'Привет! Я кит — и это классно')
  assert.equal(speechText(''), '')
  assert.equal(speechText(undefined), '')
})

test('personaFor: контекст сессии и новости попадают в факты с запретом выдумывать', () => {
  const ctx = personaFor({}, '', { sessionContext: 'Активные сессии:\n- «x»: думает' })
  assert.match(ctx, /Активные сессии/)
  assert.match(ctx, /только по этим фактам/)
  const news = personaFor({}, '', { headlines: ['Заголовок — https://a'] })
  assert.match(news, /Свежие новости/)
  assert.match(news, /2–3 новости/)
  const down = personaFor({}, '', { newsUnavailable: true })
  assert.match(down, /недоступны/)
})
