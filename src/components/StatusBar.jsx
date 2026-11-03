const HAND = { none: 'No hand in view', idle: 'Hand detected', write: 'Fingertip tracked', finish: 'Open palm' };
const WRITING = { none: 'Idle', idle: 'Pen up', write: 'Pen down, writing', finish: 'Hold to finish sentence' };

function Item({ label, value, tone = 'neutral' }) {
  return (
    <div className="status-item">
      <span className={`dot dot-${tone}`} aria-hidden="true" />
      <div>
        <div className="status-label">{label}</div>
        <div className="status-value">{value}</div>
      </div>
    </div>
  );
}

export default function StatusBar({ camera, hand, capturing, rec, model }) {
  const on = camera.state === 'on';
  const recTone = { ok: 'good', working: 'busy', empty: 'warn', error: 'bad', idle: 'neutral' }[rec.state];
  const modelText =
    model.state === 'loading' ? model.message : model.state === 'error' ? model.message : model.state === 'ready' ? 'Model ready' : 'Model loads with the camera';

  return (
    <section className="status" aria-label="Status">
      <Item label="Hand tracking" value={on ? HAND[hand] : 'Camera off'} tone={on && hand !== 'none' ? 'good' : 'neutral'} />
      <Item
        label="Writing"
        value={on ? `${WRITING[hand]}${capturing && hand !== 'write' ? ' · word captured' : ''}` : 'Camera off'}
        tone={hand === 'write' ? 'good' : capturing ? 'busy' : 'neutral'}
      />
      <Item label="Recognition" value={rec.message} tone={recTone} />
      <Item label="AI model" value={modelText} tone={model.state === 'ready' ? 'good' : model.state === 'error' ? 'bad' : model.state === 'loading' ? 'busy' : 'neutral'} />
    </section>
  );
}
