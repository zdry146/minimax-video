import fetch from 'node-fetch';

const MINIMAX_BASE_URL = 'https://api.minimax.cn';

/**
 * Reads the API key from the MINIMAX_KEY environment variable.
 * The user requested the env var name `minimax-key`, but Windows env vars
 * are case-insensitive, so we look up both spellings.
 */
function getApiKey(): string {
  const key =
    process.env.MINIMAX_KEY ||
    process.env.minimax_key ||
    process.env['minimax-key'];
  if (!key) {
    throw Object.assign(new Error('MINIMAX_KEY environment variable is not set'), { status: 500 });
  }
  return key;
}

export interface CreateVideoRequest {
  prompt: string;
  model?: 'MiniMax-Hailuo-2.3' | 'MiniMax-Hailuo-2.3-Fast' | 'MiniMax-Hailuo-02';
  duration?: 6 | 10;
  resolution?: '512P' | '720P' | '768P' | '1080P';
  prompt_optimizer?: boolean;
}

export type TaskStatus =
  | 'Preparing'
  | 'Queueing'
  | 'Processing'
  | 'Success'
  | 'Fail';

export interface HailuoTask {
  task_id: string;
  status: TaskStatus;
  file_id?: string;
  video_width?: number;
  video_height?: number;
  base_resp?: { status_code?: number; status_msg?: string };
  [k: string]: unknown;
}

/**
 * Creates a text-to-video generation task on MiniMax Hailuo 2.3.
 * Docs: https://platform.minimax.cn/docs/api-reference/video-generation-t2v
 */
export async function createVideoTask(req: CreateVideoRequest): Promise<string> {
  const apiKey = getApiKey();
  const body = {
    model: req.model ?? 'MiniMax-Hailuo-2.3',
    prompt: req.prompt,
    duration: req.duration ?? 6,
    resolution: req.resolution ?? '768P',
    prompt_optimizer: req.prompt_optimizer ?? true,
  };

  const response = await fetch(`${MINIMAX_BASE_URL}/v1/video_generation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const json = (await response.json().catch(() => ({}))) as {
    task_id?: string;
    base_resp?: { status_code?: number; status_msg?: string };
  };

  if (!response.ok || !json.task_id) {
    const msg =
      (json.base_resp && json.base_resp.status_msg) ||
      `MiniMax create failed (HTTP ${response.status})`;
    throw Object.assign(new Error(msg), { status: response.status });
  }

  return json.task_id;
}

/**
 * Queries a Hailuo video generation task by id.
 * Docs: https://platform.minimax.cn/docs/api-reference/video-generation-query
 */
export async function queryVideoTask(taskId: string): Promise<HailuoTask> {
  const apiKey = getApiKey();
  const response = await fetch(
    `${MINIMAX_BASE_URL}/v1/query/video_generation?task_id=${encodeURIComponent(taskId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
  );

  const json = (await response.json().catch(() => ({}))) as HailuoTask;
  if (!response.ok) {
    const msg = (json.base_resp && json.base_resp.status_msg) ||
      `MiniMax query failed (HTTP ${response.status})`;
    throw Object.assign(new Error(msg), { status: response.status });
  }

  return json;
}

/**
 * Retrieves the download URL for a generated video by file_id.
 * Docs: https://platform.minimax.io/docs/api-reference/file-management-retrieve
 * The returned download_url is valid for 9 hours (32,400 seconds).
 */
export async function retrieveFileDownloadUrl(fileId: string): Promise<string> {
  const apiKey = getApiKey();
  const response = await fetch(
    `${MINIMAX_BASE_URL}/v1/files/retrieve?file_id=${encodeURIComponent(fileId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
  );

  const json = (await response.json().catch(() => ({}))) as {
    file?: { download_url?: string };
    base_resp?: { status_code?: number; status_msg?: string };
  };

  if (!response.ok || !json.file || !json.file.download_url) {
    const msg = (json.base_resp && json.base_resp.status_msg) ||
      `MiniMax file retrieve failed (HTTP ${response.status})`;
    throw Object.assign(new Error(msg), { status: response.status });
  }

  return json.file.download_url;
}