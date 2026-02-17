interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

/**
 * Compute the point on the edge of a rectangle where a ray from its center
 * toward `target` intersects. Used for connector endpoints.
 */
export function computeEdgePoint(obj: Rect, target: Point): Point {
  const cx = obj.x + obj.width / 2;
  const cy = obj.y + obj.height / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;

  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  const halfW = obj.width / 2;
  const halfH = obj.height / 2;

  // Scale factor to reach the rectangle edge
  const scaleX = halfW / Math.abs(dx || 1);
  const scaleY = halfH / Math.abs(dy || 1);
  const scale = Math.min(scaleX, scaleY);

  return {
    x: cx + dx * scale,
    y: cy + dy * scale,
  };
}

/**
 * Compute the axis-aligned bounding box of a set of points.
 */
export function computeLineBounds(points: Point[]): Rect {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
