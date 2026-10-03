# MiniMax Hailuo 2.3 文生视频（中文版）

一个把文本提示词转换为短视频片段的小项目，底层调用
[MiniMax Hailuo 2.3 视频生成 API](https://platform.minimax.cn/docs/api-reference/video-generation-t2v)。

- **前端**：HTML5 + TypeScript（单页面，无需打包工具）。
- **后端**：Node.js + Express，作为代理转发到 MiniMax，**API Key 不会暴露给浏览器**。

完整调用流程：

1. `POST /api/video/create` → `POST https://api.minimax.cn/v1/video_generation`
   （返回 `task_id`）。
2. 浏览器轮询 `GET /api/video/:taskId` → `GET https://api.minimax.cn/v1/query/video_generation?task_id=...`
   （状态：`Preparing` / `Queueing` / `Processing` / `Success` / `Fail`）。
3. 当状态为 `Success` 时，服务端调用 `GET https://api.minimax.cn/v1/files/retrieve?file_id=...`
   拿到 `download_url` 返回给浏览器，浏览器将其载入 `<video>` 元素。该下载链接 **9 小时内有效**。

## 目录结构

```
minimax-video/
├── package.json
├── tsconfig.json / tsconfig.server.json / tsconfig.client.json
├── scripts/
│   └── copy-static.js         # 构建时把 public/ 拷到 dist/public/
├── public/                    # 前端源文件（HTML、CSS）
│   ├── index.html
│   └── styles.css
├── src/
│   ├── server.ts              # Express 服务 + /api/video/* 路由
│   ├── minimax.ts             # MiniMax Hailuo 2.3 创建 / 查询 / 文件客户端
│   └── app.ts                 # 浏览器端 TypeScript 逻辑
├── start-with-env.ps1         # 启动服务（自动注入 MINIMAX_KEY 到子进程）
├── stop.ps1                   # 按端口停止服务（默认 3000）
└── dist/                      # 构建产物（自动生成）
```

## 配置

API Key 通过环境变量 `MINIMAX_KEY` 读取（Windows 环境变量不区分大小写，`minimax-key` 也可以）：

```powershell
# 永久写入（用户级）—— 设置后请重新打开终端
[Environment]::SetEnvironmentVariable('MINIMAX_KEY', '<YOUR_MINIMAX_KEY>', 'User')

# 仅当前会话生效
$env:MINIMAX_KEY = "<YOUR_MINIMAX_KEY>"
```

监听端口可通过 `PORT` 环境变量覆盖（默认 `3000`）：

```powershell
$env:PORT = 8080
```

## 启动

### 方式 A：一键构建 + 启动

```powershell
cd minimax-video
npm install
npm start            # 监听 http://localhost:3000
```

### 方式 B：使用 PowerShell 助手脚本（Windows 推荐）

`start-with-env.ps1` 会把服务作为后台进程启动，并显式把 `MINIMAX_KEY`
注入子进程环境。这是因为从 PowerShell 直接启动 Node 时，并不总能读取到
用户级（User scope）的环境变量。

```powershell
# 后台启动（默认）—— 会打印 "started pid XXXX"
.\start-with-env.ps1

# 前台启动 —— 实时查看日志
.\start-with-env.ps1 -Background:$false
```

### 方式 C：先构建再启动

```powershell
npm install
npm run build        # tsc（server + client）+ copy-static.js
npm run serve        # node dist/server.js
```

本地开发时如需监听文件变化自动重建，可以分别在两个终端运行：

```powershell
npm run build:server -- -w
npm run build:client -- -w
```

## 停止服务

| 启动方式 | 停止方式 |
|----------|----------|
| `npm start` / `npm run serve`（前台） | 在当前终端按 **`Ctrl + C`** |
| `start-with-env.ps1`（后台）或任何其他脱离终端的 Node 进程 | 运行 `.\stop.ps1`（按端口杀进程，默认 3000） |

`stop.ps1` 支持 `-Port` 参数：

```powershell
.\stop.ps1              # 默认 3000 端口
.\stop.ps1 -Port 8080   # 如果改了 PORT
```

## 工作原理

1. 浏览器把提示词 POST 到 `/api/video/create`，服务端转发到
   `POST https://api.minimax.cn/v1/video_generation`，使用
   `MiniMax-Hailuo-2.3` 模型，返回 `task_id`。
2. 浏览器每 4 秒轮询一次 `GET /api/video/:taskId`（最多 150 次）。
   当状态为 `Success` 时，服务端调用文件接口 `/v1/files/retrieve`
   获取视频 `download_url` 返回给浏览器。
3. 浏览器把返回的视频 URL 载入页面上的 `<video>` 元素，并在下方显示下载链接。

## 服务端暴露的路由

| 方法 | 路径                  | 作用                                                |
|------|-----------------------|-----------------------------------------------------|
| GET  | `/` 以及 `/public/*`  | 静态前端（`index.html`、`styles.css`、`app.js`）     |
| POST | `/api/video/create`   | 创建视频生成任务，返回 `{ task_id }`                |
| GET  | `/api/video/:taskId`  | 轮询任务状态；Success 时返回 `{ task, video_url }`   |

## 注意事项与限制

- `MiniMax-Hailuo-2.3` / `2.3-Fast` 模型下，**1080P 分辨率仅在 `duration = 6s` 时可用**。
  当前端选择 10 秒时，UI 会自动禁用 1080P 选项。
- `512P` 分辨率**仅** `MiniMax-Hailuo-02` 模型支持。
- 生成的 `download_url` 自文件被检索起 **9 小时（32,400 秒）内有效**。
- 请妥善保管 `MINIMAX_KEY`，**不要**将其提交到版本库或截图分享。
