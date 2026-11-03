# AirWrite AI

Write in the air with your index finger and watch editable text appear on screen. AirWrite AI uses your laptop webcam to track your fingertip, turns the movement into a handwriting image, and recognizes it with an AI model that runs in your browser. There is no whiteboard and no mouse drawing.

## Features

- Real-time hand and index-fingertip tracking with a live tracking indicator
- Gesture-based writing: pen down, pen up, next word and finish sentence
- Word-by-word AI handwriting recognition (TrOCR) running in a Web Worker
- Editable text area with Copy, Clear, Download as `.txt` and "Recognize last word again"
- Clear status for hand tracking, writing, recognition and model loading
- Camera permission, model loading and recognition errors are shown, never hidden. If the model returns nothing useful, no text is added
- Responsive layout with light and dark mode

## Tech stack

- React + Vite (JavaScript)
- [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) for hand landmarks
- [Transformers.js](https://huggingface.co/docs/transformers.js) with `Xenova/trocr-small-handwritten` for recognition

## Getting started

Requires Node.js 18 or newer and a webcam. Use Chrome or Edge.

```bash
git clone https://github.com/shivborse6/airwrite-ai.git
cd airwrite-ai
npm install
npm run dev
```

Open `http://localhost:5173` and click **Start Camera**. The first run downloads the hand-tracking and handwriting models (about 100 MB or more). The browser caches them afterwards.

## How to write

| Action | Gesture |
| --- | --- |
| Write | Point with only your index finger (pen down) |
| Lift the pen, e.g. between letters | Make a fist or relax your hand |
| Next word | Pause for about 1.4 seconds |
| Finish sentence | Hold an open palm for about 1 second |

Tips: write large, in clear block letters, at a steady pace, with your hand fully in view and good lighting.

## How it works

1. **Tracking.** MediaPipe detects 21 hand landmarks per frame. The index fingertip position is mirrored so the path matches what the writer sees, then smoothed to reduce jitter.
2. **Gesture detection.** A finger counts as extended when its tip is farther from the wrist than its middle joint. Index only means writing; all four fingers means finish.
3. **Segmentation.** Pen-up gaps separate strokes. A pause of about 1.4 seconds ends a word.
4. **Preprocessing.** The strokes are rendered offscreen as dark ink on a white page with uniform scale, consistent line width and padding. This matches the paper-style images TrOCR was trained on. The canvas is never shown.
5. **Recognition.** TrOCR runs in a Web Worker so the camera stays smooth. Empty or garbage output is rejected.

## Project structure

```
src/
  components/    CameraPanel, StatusBar, TextEditor
  hooks/         useAirWriter (camera, tracking loop, writing state machine)
  services/      handTracker, gestures, strokeProcessing, recognizer
  workers/       recognition.worker.js (TrOCR via Transformers.js)
  App.jsx        App state and layout
```

## Limitations

- TrOCR was trained on photos of handwriting, not finger trajectories, so accuracy on air-writing is imperfect. Short words in large block letters work best, and mistakes can be fixed in the editor.
- Recognition works per word. Recognizing a whole sentence in one pass is much less reliable.
- Tuning values are in `src/hooks/useAirWriter.js` (`WORD_PAUSE_MS`, `FINISH_HOLD_MS`, `SMOOTHING`) and `src/services/strokeProcessing.js` (`INK_HEIGHT`, `LINE_WIDTH`). For a larger model, change `MODEL_ID` in `src/workers/recognition.worker.js` to `Xenova/trocr-base-handwritten`.

## Privacy

Video never leaves your device. Hand tracking and handwriting recognition run locally in the browser. The only network requests download the model files.

## Author

Shivdarshan Borse - [GitHub](https://github.com/shivborse6)
