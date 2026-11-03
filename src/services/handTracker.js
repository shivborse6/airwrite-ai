import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// Keep the CDN version identical to the installed npm package version.
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export async function createHandTracker() {
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  const make = (delegate) =>
    HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });

  let landmarker;
  try {
    landmarker = await make('GPU');
  } catch {
    landmarker = await make('CPU'); // fall back if the GPU delegate is unavailable
  }

  return {
    /** Returns the 21 landmarks of the first hand, or null. */
    detect: (video, timestampMs) => landmarker.detectForVideo(video, timestampMs).landmarks?.[0] ?? null,
    close: () => landmarker.close(),
  };
}
