const DEG_TO_RAD = Math.PI / 180;

/**
 * Rotate point (px, py) around center (cx, cy) by angleDeg degrees.
 */
export function rotatePoint(
  px: number,
  py: number,
  cx: number,
  cy: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = angleDeg * DEG_TO_RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

/**
 * Compute the axis-aligned bounding box of a rotated rectangle.
 */
export function getRotatedAABB(obj: {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}): { x: number; y: number; width: number; height: number } {
  const rotation = obj.rotation || 0;
  if (rotation === 0) {
    return { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
  }

  const cx = obj.x + obj.width / 2;
  const cy = obj.y + obj.height / 2;

  // Four corners of the unrotated rect
  const corners = [
    rotatePoint(obj.x, obj.y, cx, cy, rotation),
    rotatePoint(obj.x + obj.width, obj.y, cx, cy, rotation),
    rotatePoint(obj.x + obj.width, obj.y + obj.height, cx, cy, rotation),
    rotatePoint(obj.x, obj.y + obj.height, cx, cy, rotation),
  ];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const c of corners) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.x > maxX) maxX = c.x;
    if (c.y > maxY) maxY = c.y;
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
