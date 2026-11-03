// Classifies one hand (21 MediaPipe landmarks) into a gesture.
//  write  : only the index finger is extended  -> pen down
//  finish : open palm (all four fingers up)    -> hold to finish the sentence
//  idle   : anything else (fist, peace sign…)  -> pen up
//  none   : no hand visible
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// A finger is "extended" when its tip is clearly farther from the wrist than its middle joint.
// This works at any hand rotation, unlike comparing y-coordinates.
const extended = (lm, tip, pip) => dist(lm[tip], lm[0]) > dist(lm[pip], lm[0]) * 1.15;

export function classifyHand(lm) {
  if (!lm) return 'none';
  const index = extended(lm, 8, 6);
  const middle = extended(lm, 12, 10);
  const ring = extended(lm, 16, 14);
  const pinky = extended(lm, 20, 18);
  if (index && !middle && !ring && !pinky) return 'write';
  if (index && middle && ring && pinky) return 'finish';
  return 'idle';
}
