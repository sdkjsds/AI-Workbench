# 知流（Zhiliu）

用自动拉取的「正向知识流」替代刷短视频 / 小红书。亮色简洁，**电脑桌面端和手机端共用同一套数据**。

## 架构（一次抽后端，多端共用）

```
                  ┌─────────────┐
   电脑 Electron  │  浏览器/PWA │◄── 手机（添加到主屏幕即 App）
   （壳 loadURL） └──────┬──────┘
                        │  HTTP / REST
                        ▼
              ┌─────────────────────┐
              │  server/  Node 后端   │  Express
              │  · RSS 抓取/去重      │
              │  · 每日新知(LLM)      │
              │  · 文章正文提取       │
              │  · 随手记存储 + OCR   │
              │  · serve 前端静态资源 │
              └──────────┬──────────┘
                         ▼
                 data/  （JSON + 图片，可用环境变量指向持久化磁盘）
```

- **电脑端**：`npm start` 先起 `server/`，再用 Electron 壳 `loadURL` 连本地服务（壳只是个浏览器窗口，逻辑全在后端）。
- **手机端**：后端部署到公网（如 Render）后，手机浏览器打开网址 →「添加到主屏幕」，即变成可离线缓存的 PWA App。
- **数据统一存服务器**：任意设备登录同一个后端，看到的内容一致、已读同步。

## 目录结构
```
zhiliu/
├─ server/                # 独立 Node 后端（桌面/PWA 共用）
│  ├─ index.js            # Express 入口 + REST 接口
│  ├─ public/             # 前端（HTML/JS/CSS + PWA 文件）
│  ├─ src/                # storage / rss / ai / article / ocr / prompt
│  └─ package.json
├─ main.js                # Electron 壳（仅窗口 + 连 server）
├─ start.js               # 一键启动：先起 server，再起 Electron
└─ package.json
```

## 本机运行

### 1. 起后端 + 前端（任意浏览器即可用，不需要 Electron）
```bash
cd zhiliu/server
npm install
npm start
# 打开 http://localhost:3000
```

### 2. 桌面 Electron 壳（可选）
在 zhiliu 根目录：
```bash
npm install            # 仅装 electron
npm start              # 自动起 server 并打开 Electron 窗口
```
> electron 二进制下载慢可设镜像：`set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ && npm install`

## 部署到公网（手机可用 · 以 Render 为例）

1. 把整个 `zhiliu/` 推到 GitHub 仓库（Render 从仓库拉代码）。
2. Render 控制台 → **New → Web Service** → 连仓库。
3. 设置：
   - **Build Command**：`cd server && npm install`
   - **Start Command**：`cd server && npm start`
   - **Environment**：`PORT` 由 Render 自动注入；可选 `DATA_DIR` 指向持久化磁盘（否则重启丢数据）
4. 部署完成后拿到 `https://xxx.onrender.com`，手机浏览器打开 → 添加到主屏幕 → 即可当 App 用。

> 其他平台同理：只要能跑 Node + 持久化磁盘即可（Railway / Fly.io / 自有服务器等）。

### Render 免费版的特别处理（推荐起步）
免费版**不能挂持久化磁盘**，服务重启/休眠后会清空 `data/` 目录。为此本项目做了适配：

- **AI Key 走环境变量（防丢）**：Render 控制台 → 该服务 → **Environment** 添加：
  - `ZHILIU_AI_API_KEY` = 你的 DeepSeek Key
  - `ZHILIU_AI_BASE_URL`（可选，默认 `https://api.deepseek.com/v1`）
  - `ZHILIU_AI_MODEL`（可选，默认 `deepseek-chat`）
  - `ZHILIU_AI_PROMPT`（可选，覆盖每日新知提示词）
  
  设了环境变量后，即使 `data/` 被清空，「每日新知」依然可用；设置页对应字段会显示「已由服务器环境变量配置」且不可编辑。
- **其余设置**（拉取间隔、RSS 源等）仍存 `data/`，免费版下重启会重置为默认，需重新设置。
- **保活防止休眠**：免费版约 15 分钟无访问会休眠。用免费服务 [UptimeRobot](https://uptimerobot.com) 建一个 HTTP Monitor，指向 `https://你的服务.onrender.com/api/settings`，每 5 分钟 ping 一次即可保持唤醒（注意：同源自 ping 不被允许，需用外部监控）。

> 若想数据完全持久（随手记 / 已读不丢），升级到 Render Starter（$7/月，可挂磁盘）或改用 Oracle Always Free / 自有服务器。

## 配置
1. 打开应用 → 左侧「设置」
2. **LLM** 栏填 DeepSeek API Key（`https://platform.deepseek.com`，很便宜）；不填则「每日新知」不可用，其余三流照常
3. 可选：改模型名、改每日提示词、增删 RSS 源、调拉取间隔（默认 60 分钟）

## 注意事项
- **OCR 中文**：服务端首次识别需联网下载一次中文语言包（之后可离线）
- **RSS 源可能失效**：部分源会改版/停更，在「设置 → RSS 源」里替换即可
- **每日新知**：按本地日期去重，每天最多一篇；已有则直接展示
- 数据存于 `server/data/`（或 `DATA_DIR` 指定目录），可整体备份带走
- 部署到 Render 等平台时，`data/` 不在 Git 里（已 gitignore），需挂载持久化磁盘或设 `DATA_DIR` 指向挂载目录
