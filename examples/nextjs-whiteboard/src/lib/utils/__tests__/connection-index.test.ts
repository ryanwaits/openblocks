import { describe, expect, test } from "bun:test";
import { buildConnectionIndex } from "../connection-index";
import {
  makeObj,
  makeLine,
  makeObjectMap,
} from "../../../../tests/helpers/factory";

describe("buildConnectionIndex", () => {
  test("returns empty map for empty input", () => {
    const index = buildConnectionIndex(new Map());
    expect(index.size).toBe(0);
  });

  test("returns empty map for shapes only", () => {
    const index = buildConnectionIndex(
      makeObjectMap(makeObj({ id: "a" }), makeObj({ id: "b" })),
    );
    expect(index.size).toBe(0);
  });

  test("indexes line with one endpoint", () => {
    const index = buildConnectionIndex(
      makeObjectMap(
        makeObj({ id: "s1" }),
        makeLine({ id: "l1", start_object_id: "s1", end_object_id: undefined }),
      ),
    );
    expect(index.get("s1")?.has("l1")).toBe(true);
    expect(index.size).toBe(1);
  });

  test("indexes line with both endpoints", () => {
    const index = buildConnectionIndex(
      makeObjectMap(
        makeObj({ id: "s1" }),
        makeObj({ id: "s2" }),
        makeLine({ id: "l1", start_object_id: "s1", end_object_id: "s2" }),
      ),
    );
    expect(index.get("s1")?.has("l1")).toBe(true);
    expect(index.get("s2")?.has("l1")).toBe(true);
  });

  test("multiple lines to same shape", () => {
    const index = buildConnectionIndex(
      makeObjectMap(
        makeObj({ id: "s1" }),
        makeLine({ id: "l1", start_object_id: "s1", end_object_id: undefined }),
        makeLine({ id: "l2", start_object_id: "s1", end_object_id: undefined }),
      ),
    );
    const set = index.get("s1")!;
    expect(set.size).toBe(2);
    expect(set.has("l1")).toBe(true);
    expect(set.has("l2")).toBe(true);
  });
});
