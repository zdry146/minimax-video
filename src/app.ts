// Browser-side TypeScript that powers the MiniMax Hailuo 2.3 video UI.

interface CreateVideoResponse {
  task_id: string;
  error?: string;
}

interface QueryVideoResponse {
  task: {
    task_id: string;
    status: 'Preparing' | 'Queueing' | 'Processing' | 'Success' | 'Fail';
    file_id?: string;
    video_width?: number;
    video_height?: number;
    [k: string]: unknown;
  };
  video_url?: string;
  error?: string;
}

const form = document.getElementById('video-form') as HTMLFormElement;
const promptEl = document.getElementById('prompt') as HTMLTextAreaElement;
const modelEl = document.getElementById('model') as HTMLSelectElement;
const resolutionEl = document.getElementById('resolution') as HTMLSelectElement;
const durationEl = document.getElementById('duration') as HTMLSelectElement;
const optimizerEl = document.getElementById('prompt_optimizer') as HTMLInputElement;
const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const errorEl = document.getElementById('error') as HTMLDivElement;
const videoEl = document.getElementById('result-video') as HTMLVideoElement;
const videoWrapper = document.getElementById('video-wrapper') as HTMLDivElement;
const downloadLink = document.getElementById('download-link') as HTMLAnchorElement;

function setStatus(text: string) {
  statusEl.textContent = text;
  statusEl.classList.remove('hidden');
}

function setError(text: string | null) {
  if (!text) {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
    return;
  }
  errorEl.textContent = text;
  errorEl.classList.remove('hidden');
}

function setLoading(loading: boolean) {
  submitBtn.disabled = loading;
  submitBtn.textContent = loading ? 'Generating…' : 'Generate video';
}

function resolutionIsValid(model: string, resolution: string, duration: number): boolean {
  // MiniMax-Hailuo-2.3 / 2.3-Fast: 1080P only allowed at 6s; 768P at 6 or 10s.
  if ((model === 'MiniMax-Hailuo-2.3' || model === 'MiniMax-Hailuo-2.3-Fast') && resolution === '1080P' && duration !== 6) {
    return false;
  }
  return true;
}

function syncResolutionOptions() {
  // Enable/disable the 1080P option based on duration, since Hailuo 2.3 only
  // supports 1080P at 6s.
  const model = modelEl.value;
  const duration = Number(durationEl.value);
  const opt = Array.from(resolutionEl.options).find((o) => o.value === '1080P');
  if (!opt) return;
  const ok = resolutionIsValid(model, '1080P', duration);
  opt.disabled = !ok;
  if (!ok && resolutionEl.value === '1080P') {
    resolutionEl.value = '768P';
  }
}

modelEl.addEventListener('change', syncResolutionOptions);
durationEl.addEventListener('change', syncResolutionOptions);
syncResolutionOptions();

async function pollTask(taskId: string): Promise<void> {
  // Hailuo 2.3 typically takes 30s–3min depending on duration / resolution.
  const maxAttempts = 150;
  const intervalMs = 4000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    setStatus(`Polling task (${attempt + 1}/${maxAttempts})…`);
    const res = await fetch(`/api/video/${encodeURIComponent(taskId)}`);
    const data = (await res.json()) as QueryVideoResponse;

    if (!res.ok || data.error) {
      throw new Error(data.error || `query failed (HTTP ${res.status})`);
    }

    const status = data.task.status;
    if (status === 'Success') {
      const url = data.video_url;
      if (!url) {
        throw new Error('Task succeeded but no video_url was returned.');
      }
      showVideo(url);
      return;
    }
    if (status === 'Fail') {
      throw new Error('Task failed on MiniMax side.');
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Timed out waiting for the video to finish generating.');
}

function showVideo(url: string) {
  setStatus('Video ready.');
  videoEl.src = url;
  videoEl.load();
  videoWrapper.classList.remove('hidden');
  downloadLink.href = url;
  downloadLink.classList.remove('hidden');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setError(null);
  videoWrapper.classList.add('hidden');
  downloadLink.classList.add('hidden');
  videoEl.removeAttribute('src');
  videoEl.load();

  const prompt = promptEl.value.trim();
  if (!prompt) {
    setError('Please enter a video script (prompt).');
    return;
  }

  setLoading(true);
  try {
    setStatus('Submitting task to MiniMax Hailuo 2.3…');
    const createRes = await fetch('/api/video/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        model: modelEl.value,
        resolution: resolutionEl.value,
        duration: Number(durationEl.value),
        prompt_optimizer: optimizerEl.checked,
      }),
    });
    const createData = (await createRes.json()) as CreateVideoResponse;
    if (!createRes.ok || !createData.task_id) {
      throw new Error(createData.error || `create failed (HTTP ${createRes.status})`);
    }

    setStatus(`Task created: ${createData.task_id}. Waiting for the video to finish…`);
    await pollTask(createData.task_id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setError(msg);
    setStatus('Failed.');
  } finally {
    setLoading(false);
  }
});