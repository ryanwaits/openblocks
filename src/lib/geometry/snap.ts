import type { BoardObject } from "@/types/board";

interface SnapTarget {
  x: number;
  y: number;
  objectId: string;
}

const SNAP_RADIUS = 20;

function edgeMidpoints(obj: { x: number; y: number; width: number; height: number }) {
  return [
    { x: obj.x + obj.width / 2, y: obj.y },               // top
    { x: obj.x + obj.width, y: obj.y + obj.height / 2 },  // right
    { x: obj.x + obj.width / 2, y: obj.y + obj.height },  // bottom
    { x: obj.x, y: obj.y + obj.height / 2 },              // left
  ];
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
  for (const obj of objects.values()) {
    if (obj.type === "line") continue;
    if (excludeIds?.has(obj.id)) continue;
    if (
      cursor.x >= obj.x && cursor.x <= obj.x + obj.width &&
      cursor.y >= obj.y && cursor.y <= obj.y + obj.height
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
