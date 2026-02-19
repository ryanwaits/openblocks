import { rotatePoint } from "./rotation";
import type { BoardObject } from "@/types/board";

interface SnapTarget {
  x: number;
  y: number;
  objectId: string;
}

const SNAP_RADIUS = 20;

function edgeMidpoints(obj: { x: number; y: number; width: number; height: number; rotation?: number }) {
  const cx = obj.x + obj.width / 2;
  const cy = obj.y + obj.height / 2;
  const rotation = obj.rotation || 0;

  const raw = [
    { x: obj.x + obj.width / 2, y: obj.y },               // top
    { x: obj.x + obj.width, y: obj.y + obj.height / 2 },  // right
    { x: obj.x + obj.width / 2, y: obj.y + obj.height },  // bottom
    { x: obj.x, y: obj.y + obj.height / 2 },              // left
  ];

  if (rotation === 0) return raw;

  return raw.map((p) => rotatePoint(p.x, p.y, cx, cy, rotation));
}

/**
 * Find a snap target for line drawing:
 * 1. Edge midpoint within SNAP_RADIUS (precise snap)
 * 2. Anywhere inside a shape body → snaps to nearest edge midpoint
 */
export function findSnapTarget(
  cursor: { x: number; y: number },
  objects: Map<string, BoardObject>,
  excludeIds?: Set<string>
): SnapTarget | null {
  let best: SnapTarget | null = null;
  let bestDist = SNAP_RADIUS;

  for (const obj of objects.values()) {
    if (obj.type === "line") continue;
    if (excludeIds?.has(obj.id)) continue;

    for (const mp of edgeMidpoints(obj)) {
      const dist = Math.sqrt((cursor.x - mp.x) ** 2 + (cursor.y - mp.y) ** 2);
      if (dist < bestDist) {
        bestDist = dist;
        best = { x: mp.x, y: mp.y, objectId: obj.id };
      }
    }
  }

  if (best) return best;

  // Fallback: cursor is inside a shape body → snap to nearest edge midpoint
  // For rotated shapes, un-rotate cursor before AABB test
  for (const obj of objects.values()) {
    if (obj.type === "line") continue;
    if (excludeIds?.has(obj.id)) continue;

    const rotation = obj.rotation || 0;
    let testX = cursor.x;
    let testY = cursor.y;

    if (rotation !== 0) {
      const cx = obj.x + obj.width / 2;
      const cy = obj.y + obj.height / 2;
      const local = rotatePoint(cursor.x, cursor.y, cx, cy, -rotation);
      testX = local.x;
      testY = local.y;
    }

    if (
      testX >= obj.x && testX <= obj.x + obj.width &&
      testY >= obj.y && testY <= obj.y + obj.height
    ) {
      const mps = edgeMidpoints(obj);
      let nearest = mps[0];
      let nearestDist = Infinity;
      for (const mp of mps) {
        const d = Math.sqrt((cursor.x - mp.x) ** 2 + (cursor.y - mp.y) ** 2);
        if (d < nearestDist) { nearestDist = d; nearest = mp; }
      }
      return { x: nearest.x, y: nearest.y, objectId: obj.id };
    }
  }

  return null;
}
