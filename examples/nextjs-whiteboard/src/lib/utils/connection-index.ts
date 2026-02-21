import type { BoardObject } from "@/types/board";

export function buildConnectionIndex(
  objects: Map<string, BoardObject>,
): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const obj of objects.values()) {
    if (obj.type !== "line") continue;
    if (obj.start_object_id) {
      if (!index.has(obj.start_object_id))
        index.set(obj.start_object_id, new Set());
      index.get(obj.start_object_id)!.add(obj.id);
    }
    if (obj.end_object_id) {
      if (!index.has(obj.end_object_id))
        index.set(obj.end_object_id, new Set());
      index.get(obj.end_object_id)!.add(obj.id);
    }
  }
  return index;
}
