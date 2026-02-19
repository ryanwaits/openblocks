import { describe, expect, test } from "bun:test";
import { findSnapTarget } from "../snap";
import { makeObj, makeLine, makeObjectMap } from "../../../../tests/helpers/factory";

describe("findSnapTarget", () => {
  test("near edge midpoint — snaps", () => {
    // Rect at (0,0) 100x100 → top midpoint is (50, 0)
    const obj = makeObj({ x: 0, y: 0, width: 100, height: 100 });
    const objects = makeObjectMap(obj);

    const result = findSnapTarget({ x: 52, y: 3 }, objects);
    expect(result).not.toBeNull();
    expect(result!.objectId).toBe(obj.id);
    expect(result!.x).toBeCloseTo(50); // top midpoint
    expect(result!.y).toBeCloseTo(0);
  });

  test("far away — null", () => {
    const obj = makeObj({ x: 0, y: 0, width: 100, height: 100 });
    const objects = makeObjectMap(obj);

    const result = findSnapTarget({ x: 500, y: 500 }, objects);
    expect(result).toBeNull();
  });

  test("inside body — snaps to nearest midpoint", () => {
    const obj = makeObj({ x: 0, y: 0, width: 100, height: 100 });
    const objects = makeObjectMap(obj);

    // Inside shape, closest to left midpoint (0, 50)
    const result = findSnapTarget({ x: 10, y: 50 }, objects);
    expect(result).not.toBeNull();
    expect(result!.objectId).toBe(obj.id);
    expect(result!.x).toBeCloseTo(0);
    expect(result!.y).toBeCloseTo(50);
  });

  test("excludeIds filtering", () => {
    const obj = makeObj({ x: 0, y: 0, width: 100, height: 100 });
    const objects = makeObjectMap(obj);

    const result = findSnapTarget({ x: 50, y: 2 }, objects, new Set([obj.id]));
    expect(result).toBeNull();
  });

  test("lines are skipped", () => {
    const line = makeLine({ x: 0, y: 0, width: 100, height: 100 });
    const objects = makeObjectMap(line);

    const result = findSnapTarget({ x: 50, y: 0 }, objects);
    expect(result).toBeNull();
  });

  test("rotated shape — snap still works", () => {
    // 100x100 shape rotated 90° — edge midpoints get rotated
    const obj = makeObj({ x: 0, y: 0, width: 100, height: 100, rotation: 90 });
    const objects = makeObjectMap(obj);

    // Top midpoint (50,0) rotated 90° around center (50,50) → (100,50)
    const result = findSnapTarget({ x: 98, y: 50 }, objects);
    expect(result).not.toBeNull();
    expect(result!.objectId).toBe(obj.id);
  });

  test("multiple objects — snaps to closest", () => {
    const obj1 = makeObj({ x: 0, y: 0, width: 100, height: 100 });
    const obj2 = makeObj({ x: 200, y: 0, width: 100, height: 100 });
    const objects = makeObjectMap(obj1, obj2);

    // Closer to obj2's left midpoint (200, 50)
    const result = findSnapTarget({ x: 195, y: 50 }, objects);
    expect(result).not.toBeNull();
    expect(result!.objectId).toBe(obj2.id);
  });
});
