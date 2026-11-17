<p align="center">中文 | <a href="README.md">English</a></p>

<h1 align="center">whale-girl</h1>

<p align="center">
  <strong>DSH Web GUI 内的桌面宠物（QQ 宠物形态）</strong><br/>
  右下角悬浮的积累型伙伴：可拖拽、可投喂/玩耍，陪伴你的工作台脉搏——
  完成任务/会话/活跃陪伴时长积累成资历等级、称号与回忆。
</p>

<p align="center">
  <img src="https://badgen.net/badge/license/MIT/green" alt="license" />
  <img src="https://badgen.net/badge/format/official%20bundle/8257D0" alt="official bundle" />
</p>

---

## 安装

官方 **bundle 插件** 格式（仓库根 `package.json` 的 `dsh.bundle` + `dsh.client`）。经官方 profile 管理：

```sh
dsh plugin --profile web add whale-girl                        # npm package, including built assets
# Track main: dsh plugin --profile web add "github:vlln/whale-girl#main"
# Local source: dsh plugin --profile web add <local-whale-girl-path>
```

装完 **重启 web**（bundle 层在启动时合成），右下角出现宠物：点击弹出菜单（🍗 喂食 / 🎾 玩耍），拖拽可移动；hover 显示状态条（资历等级/任务数/最近共同回忆）。初始配置/欢迎页（onboarding）宠物隐藏。

更新插件时 `dsh plugin --profile web update whale-girl`（或换 git 源 ref），重启生效。

## 使用

| 你做什么 / 发生什么 | 宠物表现 |
|---|---|
| 拖拽宠物 | 被斜向拉扯（`drag`） |
| 点击菜单 🍗 喂食 / 🎾 玩耍 | 啃咬/抛接球（`eat`/`play`）→ 开心（`joy`） |
| 空闲 ≥60s | 打盹（`sleep`）；互动时醒过来（`wake`） |
| 任务完成 / 升级 / 称号 / 回合完成 | 举手欢呼（`celebrate`） |
| 任务失败 / 请求出错 | 惊吓（`error`）→ 失落（`disappointed`） |
| 新会话开始 | 挥手欢迎（`welcome`） |
| 任一会话运行/思考中 | 沉思陪伴（`think`，偶尔 `working` 工作姿态） |
| 等待批准 | 期待等待（`wait`） |
| 周期游走 | 散步（`walk`） |
| 常态 | 待机（`idle`，随机眨眼/转身） |

完整状态机（优先级/转换语义/触发源）见 [docs/state-machine.md](docs/state-machine.md)。

## 对话与语音

菜单 **⚙️ Настройки** 打开插件设置。菜单中的 **🐳 «Как дела?»** 查询 DSH 当前选中的会话。`chat.sessionContext` 控制是否发送活动状态及最多六条可见用户/助手消息（每条 400 字符）；不发送工具输出、推理或系统提示。聊天历史按模型与会话隔离，只留在进程内存。

语音默认关闭。`browser` 使用系统语音及浏览器识别；`openai` 明确选择**单独计费的 API**，默认 `gpt-transcribe` 识别、Realtime `gpt-realtime-2.1-mini` 配 `marin` 合成，密钥只留在服务端。显式兼容模型保留 `/audio/speech`。错误会显示，不自动换提供方。麦克风录音最多 30 秒；对话模式在回复后继续听，Esc/关闭停止。任何文本框获得焦点（包括主聊天）或宠物输入框有草稿时，麦克风不会开启，打字不会被当成随机语音消息。

**ChatGPT 订阅不支持此音频接口**，见 [SIWC 限制](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)；`subscription` 在联网前拒绝。新闻按需读取 RSS/Atom。

源码为 `src/` TypeScript，输出 `dist/` 和 `lib/client.js`。Node ≥24：`npm ci`、`npm test`、`npm run typecheck`、`node scripts/gates/run.mjs`。macOS 与 WSL 安装器均先构建；后端变更需在活跃会话结束后重启 DSH。

## 桌面伴侣（可选）

`desktop/` 是**独立桌面伴侣应用**（Node 引擎 + Tauri 渲染壳，零运行时依赖），把鲸鱼娘渲染到操作系统桌面常驻。**不随 `dsh plugin` 安装**——想要桌宠的用户自行启用：

```sh
# Requires Node >=18 and Rust (cargo) for the desktop shell
npm install -g whale-girl-desktop   # Install from npm
whale-girl-desktop --headless       # Headless: presence heartbeat, polling and SSE
cd "$(npm root -g)/whale-girl-desktop/src-tauri" && cargo build --release  # First build: 5-15 min; target/release/whale-girl-desktop (~12 MB)
./target/release/whale-girl-desktop   # Transparent, always-on-top pet; local DSH port 3080
# WHALE_GIRL_BASE_URL=http://IP:PORT selects a remote DSH
# From source: cd desktop && npm install && cd src-tauri && cargo build --release
```

- 消费 whale-girl 既有公开端点（`/state`、`/events`、`/presence`、`/interact`、`/config`、`/assets`），**不改动插件本体**；运行期间网页端宠物自动隐藏（presence 契约），退出后恢复。
- 渲染壳：Tauri v2（推荐）；Electron 遗留壳保留。
- 设计与契约见 `desktop/DESIGN.md`、`desktop/BUILD-RUN.md`。

## 状态预览

| 状态 | 触发 | 预览 |
|---|---|---|
| `idle` | 常态待机 | ![idle](docs/preview/idle.gif) |
| `working` | 会话思考期随机工作插曲 | ![working](docs/preview/working.gif) |
| `celebrate` | 任务完成/升级/称号/回合完成 | ![celebrate](docs/preview/celebrate.gif) |
| `error` | 任务失败/请求出错 | ![error](docs/preview/error.gif) |
| `disappointed` | 失败后短时失落 | ![disappointed](docs/preview/disappointed.gif) |
| `joy` | 投喂/玩耍后开心 | ![joy](docs/preview/joy.gif) |
| `eat` | 点击投喂 | ![eat](docs/preview/eat.gif) |
| `play` | 点击玩耍 | ![play](docs/preview/play.gif) |
| `drag` | 拖拽中 | ![drag](docs/preview/drag.gif) |
| `walk` | 周期游走 | ![walk](docs/preview/walk.gif) |
| `sleep` | 空闲 ≥60s | ![sleep](docs/preview/sleep.gif) |
| `wake` | 睡醒过渡 | ![wake](docs/preview/wake.gif) |
| `welcome` | 新会话 | ![welcome](docs/preview/welcome.gif) |
| `think` | 会话思考陪伴 | ![think](docs/preview/think.gif) |
| `wait` | 等待批准 | ![wait](docs/preview/wait.gif) |

## 配置

**插件 → 已安装 → whale-girl 包页**（配置卡片）：高频子集——网页端显示、会话记忆、尺寸、透明度、游走、睡眠等待、投喂/玩耍回话文案池（每行一条）、语音（引擎、识别模型、地址、TTS 模型、音色、密钥变量、语速）、对话（开关、**模型**、人设）与新闻（开关、条数、订阅源）。对话模型列表来自宿主（`GET /whale-girl/models`）；目录不可用时卡片退回两个 `provider`/`model` 文本框。**会话记忆**默认关闭：开启后宠物把任务完成等里程碑写进本机 `data/whale-girl/sessions.json`（几字节/条），会话恢复或分支（fork）时沿会话血缘读回、重逢时说一句上次完成了什么——只写本机文件，不进模型上下文、不上传网络；关闭即停止读写（文件保留，可自行删除）。**改动即时生效、免重启**（开关点击即写；数字与文案池失焦或回车即写）。
卡片首行是**更新行**：挂载时自动查一次上游（git 安装按提交、registry 安装按版本），状态行给出结论与当前短提交，有新版时按钮变成「更新到 <版本/提交>…」；更新经 DSH 的 profile 包管理服务重装，不碰你的设置。完整契约（端点、载荷、两步重装、失败原因、宿主版本要求）见 [docs/update-row.md](docs/update-row.md)。

全量与高级项（如各窗口时长）在 profile patch 的条目 `config:`（`<dshHome>/profiles/<profile>/cordis.patch.yml`）；`<dshHome>/settings.yaml` 的 `whale-girl:` section 会被一次性导入该条目：

```yaml
whale-girl:
  enabled: true      # Browser pet; false when using the desktop companion
  sessionMemory: false # Local session memory and ancestry recall; off by default
  size: 110          # Pet size in px (64-160)
  opacity: 1         # Opacity (0.2-1)
  walk:
    enabled: true    # Enable wandering
  sleepAfterMs: 60000
  voice:
    enabled: false
    provider: browser        # browser | openai
    sttModel: gpt-transcribe      # Microphone transcription model
    instructions: Говори как милая игривая девочка-кит  # Speech style for Realtime and gpt-4o*-tts
    conversation: false      # Conversation mode default
    autoSpeakChat: false     # read only long chat replies (opt-in)
    minSpeakChars: 200       # auto-speech threshold; 0 = any non-empty reply
  chat:
    enabled: true
    provider: ''             # Empty = host model
    model: ''
    sessionContext: true     # Include selected-session facts
  news:
    enabled: true
    maxItems: 5
    feeds:
      - https://lenta.ru/rss/news
      - https://habr.com/ru/rss/news/?fl=ru
      - https://hnrss.org/frontpage
```

完整配置项清单与语义层（XP/称号）封闭说明见 `src/core/config.ts`。**语义层不可配**（改 XP/称号阈值会破坏积累账本一致性）。

## 角色

页面加载时按 manifest 或 localStorage `whale-girl:character` 选择角色。每个角色提供**全部 15 状态**素材（素材全量契约，见 [docs/sprites-spec.md](docs/sprites-spec.md)）；贡献新角色指南见 [docs/adding-a-character.md](docs/adding-a-character.md)。

## 开发与贡献

官方 bundle 契约见 [AGENTS.md](AGENTS.md)，文档与决策要求见 [docs/AGENTS.md](docs/AGENTS.md)。问题报告请附复现步骤及浏览器、DSH 版本。新增角色遵循 [角色素材规范](docs/sprites-spec.md)，代码行为变更须附决策记录与回归测试。

## 致谢

角色形象由 [ZipZipPipe](https://space.bilibili.com/4168597) 创作（《鲸鱼娘》表情包角色），sprites 基于其角色设定生成。

## License

MIT License
