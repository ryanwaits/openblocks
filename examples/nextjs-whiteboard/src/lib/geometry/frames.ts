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
