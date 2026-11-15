<p align="center"><a href="README.en.md">English</a> | <a href="README.zh.md">中文</a> | Русский</p>

<h1 align="center">Кит-девочка</h1>

<p align="center">
  <strong>Домашний питомец в web-интерфейсе DSH (в духе QQ-питомца)</strong><br/>
  Живёт в правом нижнем углу: его можно тянуть, кормить и играть с ним —
  выполненные задачи, сессии и совместное время копятся в стаж, звания и воспоминания.
</p>

<p align="center">
  <img src="https://badgen.net/badge/license/MIT/green" alt="license" />
  <img src="https://badgen.net/badge/format/official%20bundle/8257D0" alt="official bundle" />
</p>

> Русская версия форка [vlln/whale-girl](https://github.com/vlln/whale-girl). Механики и код оригинальные;
> переведены интерфейс питомца, его фразы, карточка настроек, метаданные плагина и эта документация.
> Оригинал распространяется по лицензии MIT.

---

## Установка

Официальный **bundle-плагин** (`dsh.bundle` + `dsh.client` в корневом `package.json`), ставится через официальный профиль:

```sh
# из локального каталога (режим разработки)
dsh plugin --profile web add <путь-к-каталогу-whale-girl-ru>
# или с GitHub-форка, следя за веткой main
dsh plugin --profile web add "github:bondiano/whale-girl-ru#main"
```

**Перезапустите web** после установки (слои bundle собираются при старте). Питомец появится в правом нижнем углу: клик — меню (🍗 покормить / 🎾 поиграть), перетаскивание — перемещение, наведение — строка статуса (звание / число задач / последние воспоминания). На страницах онбординга питомец скрыт.

Обновление — `dsh plugin --profile web update whale-girl` (или смена git-ref), затем перезапуск.

## Поведение

| Вы / событие | Поведение питомца |
|---|---|
| Перетаскивание | Растягивается по диагонали (`drag`) |
| Меню 🍗 покормить / 🎾 поиграть | Жуёт / кидает мяч (`eat`/`play`) → радость (`joy`) |
| Простой ≥60 с | Дремлет (`sleep`); просыпается от взаимодействия (`wake`) |
| Задача выполнена / новый уровень / звание / ход завершён | Радуется (`celebrate`) |
| Задача провалилась / ошибка запроса | Испуг (`error`) → расстройство (`disappointed`) |
| Новая сессия | Приветствует (`welcome`) |
| Сессия работает / думает | Задумчиво составляет компанию (`think`, иногда `working`) |
| Ожидание подтверждения | Ждёт (`wait`) |
| Периодические прогулки | Гуляет (`walk`) |
| По умолчанию | Ожидает (`idle`, случайные моргания / повороты) |

Полная машина состояний (приоритеты / переходы / триггеры): [docs/state-machine.md](docs/state-machine.md).

## Настольный компаньон (опционально)

`desktop/` — **самостоятельное приложение-компаньон** (движок Node + оболочка Tauri, без runtime-зависимостей), которое держит кита на рабочем столе ОС. **Ставится не через `dsh plugin`** — запускается вручную:

```sh
# Требования: Node ≥18; для оболочки рендера нужен Rust (cargo)
npm install -g whale-girl-desktop   # npm install (движок + исходники оболочки Tauri)
whale-girl-desktop --headless       # headless: heartbeat присутствия + опрос состояния + SSE
cd "$(npm root -g)/whale-girl-desktop/src-tauri" && cargo build --release  # первая сборка ~5–15 мин; артефакт target/release/whale-girl-desktop (~12 МБ)
./target/release/whale-girl-desktop   # прозрачный питомец поверх всех окон (по умолчанию локальный DSH на 3080)
# WHALE_GIRL_BASE_URL=http://IP:PORT указывает на внешний DSH
# или из исходников: cd desktop && npm install && cd src-tauri && cargo build --release
```

- Использует публичные эндпоинты whale-girl (`/state`, `/events`, `/presence`, `/interact`, `/config`, `/assets`) **не трогая плагин**; питомец на странице скрывается, пока компаньон работает (контракт присутствия), и возвращается после выхода/падения (TTL 45 с).
- Оболочка: Tauri v2 (рекомендуется, ~12 МБ); устаревшая оболочка Electron сохранена (`npm i -D electron`).
- Дизайн и контракты: `desktop/DESIGN.md`, `desktop/BUILD-RUN.md`.

## Предпросмотр состояний

| Состояние | Триггер | Превью |
|---|---|---|
| `idle` | Ожидание по умолчанию | ![idle](docs/preview/idle.gif) |
| `working` | Случайный рабочий эпизод, пока сессия думает | ![working](docs/preview/working.gif) |
| `celebrate` | Задача выполнена / новый уровень / звание / ход завершён | ![celebrate](docs/preview/celebrate.gif) |
| `error` | Задача провалилась / ошибка запроса | ![error](docs/preview/error.gif) |
| `disappointed` | Краткое уныние после провала | ![disappointed](docs/preview/disappointed.gif) |
| `joy` | Радость после кормления / игры | ![joy](docs/preview/joy.gif) |
| `eat` | Клик — покормить | ![eat](docs/preview/eat.gif) |
| `play` | Клик — поиграть | ![play](docs/preview/play.gif) |
| `drag` | Во время перетаскивания | ![drag](docs/preview/drag.gif) |
| `walk` | Периодические прогулки | ![walk](docs/preview/walk.gif) |
| `sleep` | Простой ≥60 с | ![sleep](docs/preview/sleep.gif) |
| `wake` | Переход пробуждения | ![wake](docs/preview/wake.gif) |
| `welcome` | Новая сессия | ![welcome](docs/preview/welcome.gif) |
| `think` | Компания, пока сессия думает | ![think](docs/preview/think.gif) |
| `wait` | Ожидание подтверждения | ![wait](docs/preview/wait.gif) |

## Настройки

**Plugins → Installed → страница bundle whale-girl** (карточка настроек): часто используемый набор — показывать на странице, память сессий, размер, прозрачность, прогулки, задержка сна и пулы фраз на кормление/игру (по одной на строку). **Память сессий** (по умолчанию выключена) записывает вехи выполненных задач в локальный файл и при возобновлении/форке сессии приветствует вас прогрессом прошлого раза — только локально, никогда в контекст модели, никогда не отправляется; выключение останавливает все чтения и записи (файл остаётся). Изменения **применяются сразу, без перезапуска** (переключатель пишется по клику; числа и пулы фраз — по потере фокуса или Enter).

Первая строка карточки — **строка обновления**: при открытии она один раз проверяет источник (для git-установок — по коммиту, для registry — по версии) и показывает вердикт и установленный короткий коммит; при более новой ревизии кнопка становится «Обновить до <цель>…», а обновление переустанавливает плагин через профильный пакетный менеджер DSH, не трогая ваши настройки. Полный контракт (эндпоинты, payload, двухшаговая переустановка, причины ошибок, требования к версии хоста): [docs/update-row.md](docs/update-row.md).

Полный список опций живёт в `config` записи плагина в патче профиля (`<dshHome>/profiles/<profile>/cordis.patch.yml`); секция `whale-girl:` в `<dshHome>/settings.yaml` один раз импортируется в эту запись:

```yaml
whale-girl:
  enabled: true      # рендер в web (false отключает питомца на странице, пока работает настольный компаньон)
  sessionMemory: false # память сессий (локальный файл; см. карточку настроек)
  size: 110          # размер питомца, px (64–160)
  opacity: 1         # обычная прозрачность (0.2–1)
  walk:
    enabled: true    # прогулки
  sleepAfterMs: 60000
```

Полный список опций и почему семантический слой (XP / звания) закрыт: `lib/src/config.mjs`. **Не настраивается** (изменение порогов XP / званий сломало бы бухгалтерию накопления).

## Персонажи

🎭 «Сменить» переключает персонажей (или задайте `whale-girl:character` в localStorage); кнопка **неактивна, если в manifest один персонаж** («Других персонажей нет»). У каждого персонажа есть **все 15 состояний** (полный контракт: [docs/sprites-spec.md](docs/sprites-spec.md)); новые персонажи: [docs/adding-a-character.md](docs/adding-a-character.md).

## Эталонная реализация

whale-girl — полный образец **формата bundle-плагина** (`dsh.bundle` + `cordis.patch.yml` + `lib/`, развивается вместе с официальным механизмом) — делайте новые плагины по его образцу:

- **Структура**: `lib/` (entry / логика / client / assets) отдельно от docs, decisions, scripts — корневой [AGENTS.md](AGENTS.md)
- **Соглашения**: гейты (`scripts/gates/run.mjs`) + записи о решениях + полные контракты ресурсов; руководство: [make-dsh-plugin skill](https://github.com/vlln/plugin-registry/tree/main/skills/make-dsh-plugin), [cookbook](https://github.com/vlln/plugin-registry/blob/main/docs/cookbook/creating-a-plugin.md), [gotchas](https://github.com/vlln/plugin-registry/blob/main/skills/make-dsh-plugin/references/gotchas.md)

## Участие

**Issues и предложения приветствуются** — обратная связь определяет следующие шаги питомца:

- 🐛 **Баг**: заведите issue с шагами воспроизведения, версиями браузера и dsh; для клиентских проблем — ошибки из консоли
- 💡 **Идеи**: см. [docs/state-machine.md](docs/state-machine.md) и [docs/growth-system.md](docs/growth-system.md), опишите ожидаемый эффект
- 🎨 **Новые персонажи**: [docs/adding-a-character.md](docs/adding-a-character.md) §краткое руководство — read-only контракт, 15 sheet + записи manifest, проверяется `verify-assets`
- 🔧 **Код**: каждое нетривиальное изменение требует записи о решении (`decisions/`), самопроверок гейтов, одноцелевых коммитов ([docs/AGENTS.md](docs/AGENTS.md), корневой [AGENTS.md](AGENTS.md))

## Благодарности

Персонаж — [ZipZipPipe](https://space.bilibili.com/4168597) (стикер-персонаж «Whale Girl»); спрайты сгенерированы по их дизайну.

## Лицензия

MIT License
