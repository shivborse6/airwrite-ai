import { useCallback, useEffect, useRef, useState } from 'react';
import { createHandTracker } from '../services/handTracker';
import { classifyHand } from '../services/gestures';
import { renderStrokesToBlob } from '../services/strokeProcessing';
import { recognizer, cleanResult } from '../services/recognizer';

const WORD_PAUSE_MS = 1400; // pen up this long -> the word is complete
const FINISH_HOLD_MS = 900; // hold an open palm this long -> finish sentence
const MIN_POINTS = 8;
const SMOOTHING = 0.55; // 0..1, higher = more responsive, lower = smoother

const cameraErrorMessage = (e) => {
  switch (e?.name) {
    case 'NotAllowedError': return 'Camera permission was denied. Allow camera access in the browser address bar and press Start Camera again.';
    case 'NotFoundError': return 'No camera was found. Connect a webcam and try again.';
    case 'NotReadableError': return 'The camera is in use by another app (Zoom, Teams, another tab). Close it and try again.';
    case 'OverconstrainedError': return 'This camera does not support the requested resolution.';
    default: return `Could not start the camera or hand tracker: ${e?.message || e}`;
  }
};

export function useAirWriter(onResult) {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const streamRef = useRef(null);
  const trackerRef = useRef(null);
  const rafRef = useRef(0);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  // Mutable writing state lives in a ref so the 30 fps loop never triggers React renders.
  const s = useRef({
    strokes: [], current: [], smooth: null, lastWrite: 0, writeRun: 0, nonWriteRun: 0,
    finishStart: null, latched: false, lastVideoTime: -1, gesture: 'none', capturing: false,
    lastWord: null, chain: Promise.resolve(),
  });

  const [camera, setCamera] = useState({ state: 'off', error: '' }); // off | starting | on | error
  const [hand, setHand] = useState('none');
  const [capturing, setCapturing] = useState(false);
  const [rec, setRec] = useState({ state: 'idle', message: 'Waiting for writing' });
  const [model, setModel] = useState({ state: 'idle', progress: 0, message: '' });
  const [hasLastWord, setHasLastWord] = useState(false);

  useEffect(() => recognizer.subscribe(setModel), []);

  // ---------- recognition ----------
  const runRecognition = (strokes, replaceLast = false) => {
    const st = s.current;
    st.chain = st.chain.then(async () => {
      setRec({ state: 'working', message: 'Recognizing…' });
      try {
        const blob = await renderStrokesToBlob(strokes);
        if (!blob) return setRec({ state: 'empty', message: 'Not enough writing captured. Write larger and a little slower.' });
        const text = cleanResult(await recognizer.recognize(blob));
        if (!text) return setRec({ state: 'empty', message: 'The model could not read that, so nothing was added. Try again or type it.' });
        onResultRef.current({ text, replaceLast });
        setRec({ state: 'ok', message: `Recognized “${text}”` });
      } catch (e) {
        setRec({ state: 'error', message: `Recognition failed: ${e.message}` });
      }
    });
  };

  const endStroke = () => {
    const st = s.current;
    if (st.current.length >= 3) st.strokes.push(st.current);
    st.current = [];
    st.smooth = null;
  };

  const commitWord = () => {
    const st = s.current;
    endStroke();
    const strokes = st.strokes;
    st.strokes = [];
    if (strokes.flat().length < MIN_POINTS) return;
    st.lastWord = strokes;
    setHasLastWord(true);
    runRecognition(strokes);
  };

  const finishSentence = () => {
    commitWord();
    const st = s.current;
    st.chain = st.chain.then(() => onResultRef.current({ newline: true }));
  };

  const recognizeAgain = useCallback(() => {
    if (s.current.lastWord) runRecognition(s.current.lastWord, true);
  }, []);

  // ---------- overlay (fingertip indicator + live ink trail on the video, not a whiteboard) ----------
  const draw = (lm, gesture, heldFraction) => {
    const c = overlayRef.current;
    const v = videoRef.current;
    if (!c || !v) return;
    if (c.width !== v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight; }
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(94, 234, 212, 0.9)';
    for (const stroke of [...s.current.strokes, s.current.current]) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      stroke.forEach((p, i) => (i ? ctx.lineTo(p.x * c.width, p.y * c.height) : ctx.moveTo(p.x * c.width, p.y * c.height)));
      ctx.stroke();
    }
    if (!lm) return;
    const tip = lm[8];
    const x = (1 - tip.x) * c.width; // video is mirrored with CSS, so mirror x here as well
    const y = tip.y * c.height;
    ctx.beginPath();
    ctx.arc(x, y, gesture === 'write' ? 11 : 8, 0, Math.PI * 2);
    ctx.fillStyle = gesture === 'write' ? '#5eead4' : 'rgba(255,255,255,0.85)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.stroke();
    if (heldFraction > 0) {
      const palm = lm[9];
      ctx.beginPath();
      ctx.arc((1 - palm.x) * c.width, palm.y * c.height, 40, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(heldFraction, 1));
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#fbbf24';
      ctx.stroke();
    }
  };

  // ---------- main tracking loop ----------
  const tick = () => {
    rafRef.current = requestAnimationFrame(tick);
    const v = videoRef.current;
    const st = s.current;
    if (!v || !trackerRef.current || v.readyState < 2 || v.currentTime === st.lastVideoTime) return;
    st.lastVideoTime = v.currentTime;
    const now = performance.now();

    let lm = null;
    try { lm = trackerRef.current.detect(v, now); } catch (e) { console.error('Hand tracking error', e); }
    const g = classifyHand(lm);
    if (g !== st.gesture) { st.gesture = g; setHand(g); }

    if (g === 'write') { st.writeRun++; st.nonWriteRun = 0; } else { st.nonWriteRun++; st.writeRun = 0; }

    if (g === 'write' && st.writeRun >= 3) {
      // Mirror x so the trajectory matches what the writer sees (not what the camera sees).
      const raw = { x: 1 - lm[8].x, y: lm[8].y };
      const p = st.smooth
        ? { x: st.smooth.x + (raw.x - st.smooth.x) * SMOOTHING, y: st.smooth.y + (raw.y - st.smooth.y) * SMOOTHING }
        : raw;
      st.smooth = p;
      const last = st.current[st.current.length - 1];
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.003) st.current.push(p);
      st.lastWrite = now;
    } else if (st.nonWriteRun >= 2 && st.current.length) {
      endStroke(); // pen lifted (tolerates 1 flickering frame)
    }

    let held = 0;
    if (g === 'finish') {
      st.finishStart ??= now;
      held = (now - st.finishStart) / FINISH_HOLD_MS;
      if (held >= 1 && !st.latched) { st.latched = true; finishSentence(); }
    } else {
      st.finishStart = null;
      st.latched = false;
    }

    const hasInk = st.current.length > 0 || st.strokes.length > 0;
    if (g !== 'write' && hasInk && now - st.lastWrite > WORD_PAUSE_MS) commitWord();
    if (hasInk !== st.capturing) { st.capturing = hasInk; setCapturing(hasInk); }

    draw(lm, g, held);
  };

  // ---------- camera lifecycle ----------
  const stop = useCallback((commit = true) => {
    cancelAnimationFrame(rafRef.current);
    const st = s.current;
    if (commit && (st.strokes.length || st.current.length)) commitWord();
    st.strokes = []; st.current = []; st.smooth = null; st.gesture = 'none'; st.capturing = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    trackerRef.current?.close();
    trackerRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    const c = overlayRef.current;
    c?.getContext('2d').clearRect(0, 0, c.width, c.height);
    setCamera((prev) => (prev.state === 'error' ? prev : { state: 'off', error: '' }));
    setHand('none');
    setCapturing(false);
  }, []);

  const start = useCallback(async () => {
    if (streamRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      return setCamera({ state: 'error', error: 'This browser cannot access the camera. Use Chrome or Edge on http://localhost or HTTPS.' });
    }
    setCamera({ state: 'starting', error: '' });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      recognizer.load(); // warm up the handwriting model while the user gets ready
      trackerRef.current = await createHandTracker();
      if (!streamRef.current) { trackerRef.current.close(); trackerRef.current = null; return; } // stopped while loading
      setCamera({ state: 'on', error: '' });
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      console.error(e);
      stop(false);
      setCamera({ state: 'error', error: cameraErrorMessage(e) });
    }
  }, [stop]);

  useEffect(() => () => { stop(false); recognizer.dispose(); }, [stop]);

  return { videoRef, overlayRef, camera, hand, capturing, rec, model, hasLastWord, start, stop, recognizeAgain };
}
