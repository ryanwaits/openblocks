import { describe, expect, test } from "bun:test";
import {
  frameOriginX,
  BOARD_WIDTH,
  BOARD_HEIGHT,
  FRAME_GAP,
  FRAME_ORIGIN_Y,
  BOARD_OFFSET_X,
} from "../frames";

describe("frames", () => {
  test("constants", () => {
    expect(BOARD_WIDTH).toBe(4000);
    expect(BOARD_HEIGHT).toBe(3000);
    expect(FRAME_GAP).toBe(200);
    expect(FRAME_ORIGIN_Y).toBe(-1500);
    expect(BOARD_OFFSET_X).toBe(-2000);
  });

  test("frameOriginX(0) = -2000", () => {
    expect(frameOriginX(0)).toBe(-2000);
  });

  test("frameOriginX(1) = 2200", () => {
    // 1 * (4000 + 200) + (-2000) = 4200 - 2000 = 2200
    expect(frameOriginX(1)).toBe(2200);
  });

  test("frameOriginX(2) = 6400", () => {
    // 2 * (4000 + 200) + (-2000) = 8400 - 2000 = 6400
    expect(frameOriginX(2)).toBe(6400);
  });

  test("FRAME_ORIGIN_Y equals BOARD_OFFSET_Y", () => {
    expect(FRAME_ORIGIN_Y).toBe(-BOARD_HEIGHT / 2);
  });
});
