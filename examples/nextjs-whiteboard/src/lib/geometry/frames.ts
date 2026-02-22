export const BOARD_WIDTH = 4000;
export const BOARD_HEIGHT = 3000;
export const FRAME_GAP = 200;
export const BOARD_OFFSET_X = -BOARD_WIDTH / 2; // -2000
export const BOARD_OFFSET_Y = -BOARD_HEIGHT / 2; // -1500

/** X origin for a frame at the given index */
export function frameOriginX(index: number): number {
  return index * (BOARD_WIDTH + FRAME_GAP) + BOARD_OFFSET_X;
}

/** Y origin is constant for all frames (horizontal row layout) */
export const FRAME_ORIGIN_Y = BOARD_OFFSET_Y;

/** Find the frame whose bounds contain the given position (center-based) */
export function findFrameForPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  frames: import("@/types/board").Frame[],
): string | undefined {
  const cx = x + width / 2;
  const cy = y + height / 2;
  for (const frame of frames) {
    const fx = frameOriginX(frame.index);
    const fy = FRAME_ORIGIN_Y;
    if (cx >= fx && cx <= fx + BOARD_WIDTH && cy >= fy && cy <= fy + BOARD_HEIGHT) {
      return frame.id;
    }
  }
  // Fallback: closest frame by horizontal distance
  if (frames.length > 0) {
    let closest = frames[0];
    let minDist = Infinity;
    for (const frame of frames) {
      const fcx = frameOriginX(frame.index) + BOARD_WIDTH / 2;
      const dist = Math.abs(cx - fcx);
      if (dist < minDist) {
        minDist = dist;
        closest = frame;
      }
    }
    return closest.id;
  }
  return undefined;
}
