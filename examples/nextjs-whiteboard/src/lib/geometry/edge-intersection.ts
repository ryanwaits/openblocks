import { rotatePoint } from "./rotation";

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

interface ShapeInfo extends Rect {
  rotation?: number;
  type?: string;
}

/**
 * Ray-rectangle intersection: point on the edge of a rectangle where a ray
 * from its center toward `target` intersects.
 */
function rectEdgePoint(cx: number, cy: number, halfW: number, halfH: number, tx: number, ty: number): Point {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  const scaleX = halfW / Math.abs(dx || 1);
  const scaleY = halfH / Math.abs(dy || 1);
  const s = Math.min(scaleX, scaleY);

  return { x: cx + dx * s, y: cy + dy * s };
}

/**
 * Ray-ellipse intersection: point on the edge of an ellipse where a ray
 * from its center toward `target` intersects.
 */
function ellipseEdgePoint(cx: number, cy: number, rx: number, ry: number, tx: number, ty: number): Point {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  // Parametric: (cx + dx*t, cy + dy*t) on ellipse when (dx*t/rx)^2 + (dy*t/ry)^2 = 1
  const a = (dx / rx) ** 2 + (dy / ry) ** 2;
  const t = 1 / Math.sqrt(a);

  return { x: cx + dx * t, y: cy + dy * t };
}

/**
 * Ray-diamond intersection: point on the edge of a diamond (rhombus inscribed
 * in the bounding box) where a ray from its center toward `target` intersects.
 */
function diamondEdgePoint(cx: number, cy: number, halfW: number, halfH: number, tx: number, ty: number): Point {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  // Diamond edges: |dx|/halfW + |dy|/halfH = 1 at the boundary
  // Ray: (dx*t, dy*t), so |dx*t|/halfW + |dy*t|/halfH = 1
  // t = 1 / (|dx|/halfW + |dy|/halfH)
  const t = 1 / (Math.abs(dx) / halfW + Math.abs(dy) / halfH);

  return { x: cx + dx * t, y: cy + dy * t };
}

/**
 * Compute the point on the edge of a shape where a ray from its center
 * toward `target` intersects. Supports rotation and shape-type-aware geometry.
 */
export function computeEdgePoint(obj: ShapeInfo, target: Point): Point {
  const cx = obj.x + obj.width / 2;
  const cy = obj.y + obj.height / 2;
  const halfW = obj.width / 2;
  const halfH = obj.height / 2;
  const rotation = obj.rotation || 0;

  // If rotated, un-rotate target into local space
  let localTarget = target;
  if (rotation !== 0) {
    localTarget = rotatePoint(target.x, target.y, cx, cy, -rotation);
  }

  let result: Point;
  switch (obj.type) {
    case "circle":
      result = ellipseEdgePoint(cx, cy, halfW, halfH, localTarget.x, localTarget.y);
      break;
    case "diamond":
      result = diamondEdgePoint(cx, cy, halfW, halfH, localTarget.x, localTarget.y);
      break;
    default:
      // rect, sticky, text, pill — all use rectangle intersection
      result = rectEdgePoint(cx, cy, halfW, halfH, localTarget.x, localTarget.y);
      break;
  }

  // If rotated, rotate result back to world space
  if (rotation !== 0) {
    result = rotatePoint(result.x, result.y, cx, cy, rotation);
  }

  return result;
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
