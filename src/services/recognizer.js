// Main-thread client for the recognition Web Worker (TrOCR via Transformers.js).
let worker = null;
let nextId = 1;
const pending = new Map();
const subscribers = new Set();
let status = { state: 'idle', progress: 0, message: 'Handwriting model not loaded yet' };

const setStatus = (patch) => {
  status = { ...status, ...patch };
  subscribers.forEach((fn) => fn(status));
};
const failAll = (message) => {
  pending.forEach((p) => p.reject(new Error(message)));
  pending.clear();
};

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/recognition.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    switch (data.type) {
      case 'progress':
        setStatus({ state: 'loading', progress: data.progress, message: `Downloading handwriting model… ${Math.round(data.progress)}%` });
        break;
      case 'ready':
        setStatus({ state: 'ready', progress: 100, message: 'Handwriting model ready' });
        break;
      case 'result':
        pending.get(data.id)?.resolve(data.text);
        pending.delete(data.id);
        break;
      case 'error':
        if (data.phase === 'load') setStatus({ state: 'error', message: `Model failed to load: ${data.message}` });
        pending.get(data.id)?.reject(new Error(data.message));
        pending.delete(data.id);
        break;
    }
  };
  worker.onerror = (e) => {
    const message = e.message || 'unknown worker error';
    setStatus({ state: 'error', message: `Recognition worker crashed: ${message}` });
    failAll(message);
    worker?.terminate();
    worker = null;
  };
  return worker;
}

export const recognizer = {
  subscribe(fn) {
    subscribers.add(fn);
    fn(status);
    return () => subscribers.delete(fn);
  },
  /** Start downloading/initialising the model early. */
  load() {
    if (status.state === 'ready' || status.state === 'loading') return;
    setStatus({ state: 'loading', progress: 0, message: 'Loading handwriting model…' });
    ensureWorker().postMessage({ type: 'load' });
  },
  /** @param {Blob} blob PNG of the rendered handwriting. @returns {Promise<string>} raw model text */
  recognize(blob) {
    const w = ensureWorker();
    if (status.state === 'idle' || status.state === 'error') setStatus({ state: 'loading', message: 'Loading handwriting model…' });
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      w.postMessage({ type: 'recognize', id, blob });
    });
  },
  dispose() {
    worker?.terminate();
    worker = null;
    failAll('Recognizer was shut down');
    setStatus({ state: 'idle', progress: 0, message: 'Handwriting model not loaded yet' });
  },
};

/** Rejects empty / punctuation-only / repeated-character garbage so we never fake a success. */
export function cleanResult(raw) {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!/[\p{L}\p{N}]/u.test(text)) return '';
  if (/^(.)\1{3,}$/u.test(text)) return '';
  return text;
}
