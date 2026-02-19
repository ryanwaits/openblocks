interface ViewportSnapshot {
  pos: { x: number; y: number };
  scale: number;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Animate viewport position + scale from `from` to `to`.
 * Returns a cancel function. Calls `onTick` each frame with interpolated values.
 */
export function animateViewport(
  from: ViewportSnapshot,
  to: ViewportSnapshot,
  durationMs: number,
  onTick: (pos: { x: number; y: number }, scale: number) => void,
): () => void {
  let cancelled = false;
  const start = performance.now();

  function tick(now: number) {
    if (cancelled) return;
    const elapsed = now - start;
    const t = Math.min(elapsed / durationMs, 1);
    const e = easeInOutCubic(t);

    const pos = {
      x: from.pos.x + (to.pos.x - from.pos.x) * e,
      y: from.pos.y + (to.pos.y - from.pos.y) * e,
    };
    const scale = from.scale + (to.scale - from.scale) * e;

    onTick(pos, scale);

    if (t < 1) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);

  return () => {
    cancelled = true;
  };
}
