// Turns an air-written trajectory into an image a handwriting model (TrOCR) understands.
// TrOCR was trained on photos of ink on paper, so the strokes are rendered OFFSCREEN as
// dark ink on a white page with consistent thickness, uniform scale and padding.
// This canvas is never attached to the page: there is no whiteboard.

const INK_HEIGHT = 110;
const PAD = 40;
const LINE_WIDTH = 9;
const MIN_ASPECT = 2.5; // pad short words to a line-like shape, like the training data

export async function renderStrokesToBlob(strokes) {
  const pts = strokes.flat();
  if (pts.length < 8) return null;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  if (Math.max(w, h) < 0.04) return null; // jitter, not writing

  // Uniform scale keeps letter shapes; the 0.35 floor stops flat scribbles from exploding in size.
  const scale = INK_HEIGHT / Math.max(h, w * 0.35);
  const inkW = w * scale;
  const inkH = h * scale;
  const height = Math.round(inkH + PAD * 2);
  const width = Math.round(Math.max(inkW + PAD * 2, height * MIN_ASPECT));
  const offX = (width - inkW) / 2;
  const offY = (height - inkH) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = LINE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const map = (p) => ({ x: (p.x - minX) * scale + offX, y: (p.y - minY) * scale + offY });
  for (const stroke of strokes) {
    if (stroke.length < 2) continue;
    const s = stroke.map(map);
    ctx.beginPath();
    ctx.moveTo(s[0].x, s[0].y);
    for (let i = 1; i < s.length - 1; i++) {
      const mx = (s[i].x + s[i + 1].x) / 2;
      const my = (s[i].y + s[i + 1].y) / 2;
      ctx.quadraticCurveTo(s[i].x, s[i].y, mx, my);
    }
    ctx.lineTo(s[s.length - 1].x, s[s.length - 1].y);
    ctx.stroke();
  }
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
