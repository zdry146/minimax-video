# MiniMax Hailuo 2.3 Text-to-Video

A small project that turns a text prompt into a short clip using the
[MiniMax Hailuo 2.3 video generation API](https://platform.minimax.cn/docs/api-reference/video-generation-t2v).

- **Frontend**: HTML5 + TypeScript (single page, no bundler required).
- **Backend**: Node.js + Express, which proxies requests to MiniMax so the
  API key never leaves the server.

The full flow:

1. POST `/api/video/create` → `POST https://api.minimax.cn/v1/video_generation`
   (returns `task_id`).
2. Browser polls GET `/api/video/:taskId` → `GET https://api.minimax.cn/v1/query/video_generation?task_id=...`
   (status: `Preparing` / `Queueing` / `Processing` / `Success` / `Fail`).
3. On `Success`, the server calls `GET https://api.minimax.cn/v1/files/retrieve?file_id=...`
   and returns the `download_url` to the browser, which loads it into the
   `<video>` element. The download URL is valid for 9 hours.

## Layout

```
minimax-video/
├── package.json
├── tsconfig.json / tsconfig.server.json / tsconfig.client.json
├── scripts/
│   └── copy-static.js         # copies public/ into dist/public/ at build time
├── public/                    # frontend source (HTML, CSS)
│   ├── index.html
│   └── styles.css
├── src/
│   ├── server.ts              # Express server + /api/video/* routes
│   ├── minimax.ts             # MiniMax Hailuo 2.3 create / query / file client
│   └── app.ts                 # browser-side TypeScript for the UI
├── start-with-env.ps1         # launches the server with MINIMAX_KEY inherited
├── stop.ps1                   # kills the server by port (default 3000)
└── dist/                      # build output (generated)
```

## Configuration

The API key is read from the environment variable `MINIMAX_KEY` (Windows env
vars are case-insensitive, so `minimax-key` works too):

```powershell
# Permanent (User scope) — re-open the terminal afterwards
[Environment]::SetEnvironmentVariable('MINIMAX_KEY', '<YOUR_MINIMAX_KEY>', 'User')

# Or for the current session only
$env:MINIMAX_KEY = "<YOUR_MINIMAX_KEY>"
```

The listening port can be overridden via `PORT` (defaults to `3000`):

```powershell
$env:PORT = 8080
```

## Run

### Option A: One-shot build + start

```powershell
cd minimax-video
npm install
npm start            # listens on http://localhost:3000
```

### Option B: Use the PowerShell helper (recommended on Windows)

`start-with-env.ps1` launches the server as a background process and
explicitly injects `MINIMAX_KEY` into the child environment, because Node
started directly from PowerShell does not always pick up User-scope env
vars.

```powershell
# Background (default) — prints "started pid XXXX"
.\start-with-env.ps1

# Foreground — useful to see logs live
.\start-with-env.ps1 -Background:$false
```

### Option C: Build only, then serve

```powershell
npm install
npm run build        # tsc (server + client) + copy-static.js
npm run serve        # node dist/server.js
```

For local development without rebuilding on every change you can run
`npm run build:server -- -w` and `npm run build:client -- -w` in separate
shells.

## Stop the server

| How you started | How to stop |
|-----------------|-------------|
| `npm start` / `npm run serve` (foreground) | Press `Ctrl+C` in that terminal |
| `start-with-env.ps1` (background) or any other detached Node process | `.\stop.ps1` (kills whatever is listening on port 3000) |

`stop.ps1` accepts a `-Port` parameter:

```powershell
.\stop.ps1              # default port 3000
.\stop.ps1 -Port 8080   # if you changed PORT
```

## How it works

1. The browser posts the prompt to `POST /api/video/create`, which forwards
   to `POST https://api.minimax.cn/v1/video_generation` using the
   `MiniMax-Hailuo-2.3` model and returns a `task_id`.
2. The browser polls `GET /api/video/:taskId` every 4 seconds (up to 150
   attempts). On `Success`, the server fetches the file metadata
   (`/v1/files/retrieve`) and returns the video `download_url` to the
   browser.
3. The returned video URL is loaded into the `<video>` element on the page,
   and a download link is shown below it.

## API routes exposed by the server

| Method | Path                 | Purpose                                                |
|--------|----------------------|--------------------------------------------------------|
| GET    | `/` and `/public/*`  | Static frontend (`index.html`, `styles.css`, `app.js`) |
| POST   | `/api/video/create`  | Create a video generation task, returns `{ task_id }`  |
| GET    | `/api/video/:taskId` | Poll task status; on Success returns `{ task, video_url }` |

## Notes & limits

- Resolution `1080P` is only allowed at `duration = 6s` for the
  `MiniMax-Hailuo-2.3` / `2.3-Fast` models. The UI automatically disables
  the `1080P` option when `10s` is selected.
- `512P` is only supported by `MiniMax-Hailuo-02`.
- The generated `download_url` is valid for **9 hours** (32,400 seconds)
  after the file is retrieved.
