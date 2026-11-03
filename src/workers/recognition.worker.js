import { pipeline, RawImage, env } from '@huggingface/transformers';

env.allowLocalModels = false; // fetch from the Hugging Face Hub (the browser caches it afterwards)

const MODEL_ID = 'Xenova/trocr-small-handwritten';
let pipePromise = null;
const files = new Map();

function load() {
  if (!pipePromise) {
    pipePromise = pipeline('image-to-text', MODEL_ID, {
      progress_callback: (p) => {
        if (p.status === 'progress' && p.total) {
          files.set(p.file, { loaded: p.loaded, total: p.total });
          let loaded = 0, total = 0;
          files.forEach((f) => { loaded += f.loaded; total += f.total; });
          postMessage({ type: 'progress', progress: (loaded / total) * 100 });
        }
      },
    }).then((p) => {
      postMessage({ type: 'ready' });
      return p;
    });
  }
  return pipePromise;
}

self.onmessage = async ({ data }) => {
  let phase = 'load';
  try {
    const pipe = await load();
    if (data.type === 'recognize') {
      phase = 'recognize';
      const image = await RawImage.fromBlob(data.blob);
      const out = await pipe(image, { max_new_tokens: 24, num_beams: 3 });
      postMessage({ type: 'result', id: data.id, text: out?.[0]?.generated_text ?? '' });
    }
  } catch (err) {
    if (phase === 'load') pipePromise = null; // allow a retry
    postMessage({ type: 'error', id: data.id, phase, message: String(err?.message || err) });
  }
};
