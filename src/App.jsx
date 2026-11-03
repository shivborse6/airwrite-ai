import { useCallback, useRef, useState } from 'react';
import { useAirWriter } from './hooks/useAirWriter';
import CameraPanel from './components/CameraPanel';
import StatusBar from './components/StatusBar';
import TextEditor from './components/TextEditor';

export default function App() {
  const [text, setText] = useState('');
  const textRef = useRef(''); // always-current copy so recognition results never use stale text
  const lastChunk = useRef('');

  const apply = (next) => { textRef.current = next; setText(next); };

  const handleResult = useCallback(({ text: word, replaceLast, newline }) => {
    let base = textRef.current;
    if (newline) {
      lastChunk.current = '';
      if (base && !base.endsWith('\n')) apply(base + '\n');
      return;
    }
    // "Recognize again" replaces the previous chunk, but only if the user has not edited past it.
    if (replaceLast && lastChunk.current && base.endsWith(lastChunk.current)) {
      base = base.slice(0, -lastChunk.current.length);
    }
    const sep = base && !/\s$/.test(base) ? ' ' : '';
    lastChunk.current = sep + word;
    apply(base + lastChunk.current);
  }, []);

  const air = useAirWriter(handleResult);

  return (
    <div className="app">
      <header className="top">
        <h1>AirWrite AI</h1>
        <p>Write in the air with your index finger. Your words appear as editable text.</p>
      </header>

      <StatusBar camera={air.camera} hand={air.hand} capturing={air.capturing} rec={air.rec} model={air.model} />

      <main className="grid">
        <CameraPanel
          videoRef={air.videoRef}
          overlayRef={air.overlayRef}
          camera={air.camera}
          onStart={air.start}
          onStop={air.stop}
        />
        <TextEditor
          text={text}
          onChange={(v) => { lastChunk.current = ''; apply(v); }}
          onClear={() => { lastChunk.current = ''; apply(''); }}
          onRecognizeAgain={air.recognizeAgain}
          canRecognizeAgain={air.hasLastWord}
          busy={air.rec.state === 'working'}
        />
      </main>
    </div>
  );
}
