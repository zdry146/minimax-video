import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import {
  createVideoTask,
  queryVideoTask,
  retrieveFileDownloadUrl,
} from './minimax';

interface CreateVideoBody {
  prompt: string;
  model?: 'MiniMax-Hailuo-2.3' | 'MiniMax-Hailuo-2.3-Fast' | 'MiniMax-Hailuo-02';
  duration?: 6 | 10;
  resolution?: '512P' | '720P' | '768P' | '1080P';
  prompt_optimizer?: boolean;
}

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '1mb' }));

// Serve the compiled frontend (HTML/JS/CSS lives in ./public and is copied into ./dist/public).
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// Proxy: create a text-to-video task on Hailuo 2.3.
app.post('/api/video/create', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as CreateVideoBody;
    if (!body || typeof body.prompt !== 'string' || body.prompt.trim() === '') {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const payload: CreateVideoBody = {
      prompt: body.prompt,
      model: body.model ?? 'MiniMax-Hailuo-2.3',
      duration: body.duration ?? 6,
      resolution: body.resolution ?? '768P',
      prompt_optimizer: body.prompt_optimizer ?? true,
    };

    const taskId = await createVideoTask(payload);
    return res.json({ task_id: taskId });
  } catch (err) {
    return next(err);
  }
});

// Proxy: poll task status, and on Success resolve the video download URL.
app.get('/api/video/:taskId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { taskId } = req.params;
    if (!taskId) {
      return res.status(400).json({ error: 'taskId is required' });
    }
    const task = await queryVideoTask(taskId);

    if (task.status === 'Success' && task.file_id) {
      const video_url = await retrieveFileDownloadUrl(task.file_id);
      return res.json({ task, video_url });
    }

    return res.json({ task });
  } catch (err) {
    return next(err);
  }
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err && err.status ? err.status : 500;
  const message = err && err.message ? err.message : 'internal server error';
  // eslint-disable-next-line no-console
  console.error('[minimax-proxy]', err);
  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`minimax-video server listening on http://localhost:${PORT}`);
});