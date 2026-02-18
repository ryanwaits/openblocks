import { describe, expect, test } from "bun:test";
import { rotatePoint, getRotatedAABB } from "../rotation";

describe("rotatePoint", () => {
  test("0° returns same point", () => {
    const r = rotatePoint(10, 20, 0, 0, 0);
    expect(r.x).toBeCloseTo(10);
    expect(r.y).toBeCloseTo(20);
  });

  test("90° around origin", () => {
    const r = rotatePoint(10, 0, 0, 0, 90);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(10);
  });

  test("180° around origin", () => {
    const r = rotatePoint(10, 0, 0, 0, 180);
    expect(r.x).toBeCloseTo(-10);
    expect(r.y).toBeCloseTo(0);
  });

  test("270° around origin", () => {
    const r = rotatePoint(10, 0, 0, 0, 270);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(-10);
  });

  test("90° around custom center", () => {
    // Rotate (5,0) around (5,5) by 90° → (10,5)
    const r = rotatePoint(5, 0, 5, 5, 90);
    expect(r.x).toBeCloseTo(10);
    expect(r.y).toBeCloseTo(5);
  });

  test("180° around custom center", () => {
    // Rotate (10,0) around (5,5) by 180° → (0,10)
    const r = rotatePoint(10, 0, 5, 5, 180);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(10);
  });
});

describe("getRotatedAABB", () => {
  test("0° returns same rect", () => {
    const aabb = getRotatedAABB({ x: 10, y: 20, width: 100, height: 50 });
    expect(aabb).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  test("0° when rotation is undefined", () => {
    const aabb = getRotatedAABB({ x: 0, y: 0, width: 100, height: 50 });
    expect(aabb).toEqual({ x: 0, y: 0, width: 100, height: 50 });
  });

  test("90° swaps width/height for square-like rect", () => {
    // 100x50 rect at origin, rotated 90°
    const aabb = getRotatedAABB({ x: 0, y: 0, width: 100, height: 50, rotation: 90 });
    // Center is (50,25). After 90° rotation, w/h swap
    expect(aabb.width).toBeCloseTo(50);
    expect(aabb.height).toBeCloseTo(100);
  });

  test("45° expands bounding box", () => {
    // 100x100 square rotated 45° → diagonal = 141.42
    const aabb = getRotatedAABB({ x: 0, y: 0, width: 100, height: 100, rotation: 45 });
    expect(aabb.width).toBeCloseTo(141.42, 0);
    expect(aabb.height).toBeCloseTo(141.42, 0);
  });
});
