export default function CameraPanel({ videoRef, overlayRef, camera, onStart, onStop }) {
  const on = camera.state === 'on';
  const starting = camera.state === 'starting';
  return (
    <section className="panel camera">
      <div className="stage">
        <video ref={videoRef} playsInline muted className="video" />
        <canvas ref={overlayRef} className="overlay" />
        {!on && (
          <div className="stage-empty">
            {starting ? 'Starting camera and hand tracker…' : 'Start the camera, then write in the air with your index finger.'}
          </div>
        )}
      </div>

      {camera.state === 'error' && <div className="banner banner-error" role="alert">{camera.error}</div>}

      <div className="actions">
        {on || starting ? (
          <button className="btn btn-dark" onClick={() => onStop(true)}>Stop Camera</button>
        ) : (
          <button className="btn btn-primary" onClick={onStart}>Start Camera</button>
        )}
      </div>

      <ul className="gestures">
        <li><b>Write</b> Point with only your index finger.</li>
        <li><b>Lift the pen</b> Make a fist or relax your hand, e.g. between letters.</li>
        <li><b>Next word</b> Pause for about 1.5 seconds.</li>
        <li><b>Finish sentence</b> Hold an open palm for about 1 second.</li>
      </ul>
    </section>
  );
}
