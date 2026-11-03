import { useState } from 'react';

export default function TextEditor({ text, onChange, onClear, onRecognizeAgain, canRecognizeAgain, busy }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert('Copy failed. Select the text and press Ctrl+C.');
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'airwrite.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="panel editor">
      <div className="editor-head">
        <h2>Recognized text</h2>
        {busy && <span className="spinner" role="status" aria-label="AI is processing" />}
      </div>
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Your air-written words appear here. You can edit them like any text."
        spellCheck="true"
      />
      <div className="actions wrap">
        <button className="btn" onClick={onRecognizeAgain} disabled={!canRecognizeAgain || busy}>Recognize last word again</button>
        <button className="btn" onClick={copy} disabled={!text}>{copied ? 'Copied' : 'Copy Text'}</button>
        <button className="btn" onClick={download} disabled={!text}>Download .txt</button>
        <button className="btn btn-quiet" onClick={onClear} disabled={!text}>Clear Text</button>
      </div>
    </section>
  );
}
