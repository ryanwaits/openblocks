import { describe, expect, test } from "bun:test";
import { computeEdgePoint, computeLineBounds } from "../edge-intersection";

describe("computeEdgePoint", () => {
  const rect = { x: 0, y: 0, width: 100, height: 100, type: "rectangle" };

  test("rectangle — target to the right", () => {
    const p = computeEdgePoint(rect, { x: 200, y: 50 });
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(50);
  });

  test("rectangle — target above", () => {
    const p = computeEdgePoint(rect, { x: 50, y: -100 });
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(0);
  });

  test("rectangle — target to the left", () => {
    const p = computeEdgePoint(rect, { x: -100, y: 50 });
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(50);
  });

  test("rectangle — target below", () => {
    const p = computeEdgePoint(rect, { x: 50, y: 200 });
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(100);
  });

  test("circle — target to the right", () => {
    const circle = { x: 0, y: 0, width: 100, height: 100, type: "circle" };
    const p = computeEdgePoint(circle, { x: 200, y: 50 });
    // Ellipse edge: radius 50, center (50,50), target (200,50) → right edge (100,50)
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(50);
  });

  test("circle — target at 45°", () => {
    const circle = { x: 0, y: 0, width: 100, height: 100, type: "circle" };
    const p = computeEdgePoint(circle, { x: 150, y: 150 });
    // Should be on circle edge at 45° from center (50,50)
    const dist = Math.sqrt((p.x - 50) ** 2 + (p.y - 50) ** 2);
    expect(dist).toBeCloseTo(50);
  });

  test("diamond — target to the right", () => {
    const diamond = { x: 0, y: 0, width: 100, height: 100, type: "diamond" };
    const p = computeEdgePoint(diamond, { x: 200, y: 50 });
    // Diamond right point = (100, 50)
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(50);
  });

  test("diamond — target at 45°", () => {
    const diamond = { x: 0, y: 0, width: 100, height: 100, type: "diamond" };
    const p = computeEdgePoint(diamond, { x: 150, y: 150 });
    // At 45°, diamond edge is at midpoint of right and bottom edges
    // |dx|/halfW + |dy|/halfH = 1 → each half
    expect(p.x).toBeCloseTo(75);
    expect(p.y).toBeCloseTo(75);
  });

  test("target === center returns center", () => {
    const p = computeEdgePoint(rect, { x: 50, y: 50 });
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(50);
  });

  test("rectangle with rotation", () => {
    const rotatedRect = { x: 0, y: 0, width: 100, height: 100, type: "rectangle", rotation: 90 };
    // Target directly right of center: should still hit edge at (100, 50) in world space
    // after rotation adjustment
    const p = computeEdgePoint(rotatedRect, { x: 200, y: 50 });
    // 90° rotation of 100x100 square → same shape, edge point still valid
    const dist = Math.sqrt((p.x - 50) ** 2 + (p.y - 50) ** 2);
    expect(dist).toBeCloseTo(50);
  });
});

describe("computeLineBounds", () => {
  test("empty array returns zero rect", () => {
    expect(computeLineBounds([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  test("single point returns zero-size rect", () => {
    const b = computeLineBounds([{ x: 10, y: 20 }]);
    expect(b).toEqual({ x: 10, y: 20, width: 0, height: 0 });
  });

  test("multi-point bounding box", () => {
    const b = computeLineBounds([
      { x: 10, y: 20 },
      { x: 50, y: 5 },
      { x: 30, y: 40 },
    ]);
    expect(b).toEqual({ x: 10, y: 5, width: 40, height: 35 });
  });
});
