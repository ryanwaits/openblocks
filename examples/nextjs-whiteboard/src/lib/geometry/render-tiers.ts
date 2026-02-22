import type { BoardObject } from "@/types/board";

/** Render tiers — lower tiers render underneath higher tiers regardless of z_index.
 *  z_index still controls ordering within the same tier. */
export const RENDER_TIER: Record<string, number> = {
  line: 0, drawing: 0,                            // lines/drawings (background)
  rectangle: 1, circle: 1, diamond: 1, pill: 1,  // shapes
  sticky: 2,                                      // stickies
  text: 3, emoji: 3,                              // text/stamps (foreground)
};

/** Returns the max z_index among objects in the same render tier. */
export function maxZInTier(objects: Iterable<BoardObject>, type: string): number {
  const tier = RENDER_TIER[type] ?? 1;
  let max = -1;
  for (const o of objects) {
    if ((RENDER_TIER[o.type] ?? 1) === tier && o.z_index > max) {
      max = o.z_index;
    }
  }
  return max;
}
