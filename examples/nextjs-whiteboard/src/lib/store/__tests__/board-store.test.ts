import { describe, expect, test, beforeEach } from "bun:test";
import { useBoardStore } from "../board-store";
import { makeObj, makeLine } from "../../../../tests/helpers/factory";

function reset() {
  useBoardStore.setState({
    objects: new Map(),
    connectionIndex: new Map(),
    selectedIds: new Set(),
  });
}

describe("board-store", () => {
  beforeEach(reset);

  describe("syncAll", () => {
    test("populates objects Map", () => {
      const a = makeObj({ id: "a" });
      const b = makeObj({ id: "b" });
      useBoardStore.getState().syncAll([a, b]);

      const { objects } = useBoardStore.getState();
      expect(objects.size).toBe(2);
      expect(objects.get("a")).toEqual(a);
    });

    test("builds connectionIndex from lines", () => {
      const shape = makeObj({ id: "shape-1" });
      const line = makeLine({ id: "line-1", start_object_id: "shape-1", end_object_id: null });
      useBoardStore.getState().syncAll([shape, line]);

      const { connectionIndex } = useBoardStore.getState();
      expect(connectionIndex.get("shape-1")?.has("line-1")).toBe(true);
    });
  });

  describe("addObject", () => {
    test("adds to objects Map", () => {
      const obj = makeObj({ id: "x" });
      useBoardStore.getState().addObject(obj);
      expect(useBoardStore.getState().objects.get("x")).toEqual(obj);
    });

    test("indexes line connections", () => {
      const line = makeLine({ id: "l1", start_object_id: "s1", end_object_id: "s2" });
      useBoardStore.getState().addObject(line);

      const { connectionIndex } = useBoardStore.getState();
      expect(connectionIndex.get("s1")?.has("l1")).toBe(true);
      expect(connectionIndex.get("s2")?.has("l1")).toBe(true);
    });

    test("non-line objects do not affect connectionIndex", () => {
      useBoardStore.getState().addObject(makeObj({ id: "r1" }));
      expect(useBoardStore.getState().connectionIndex.size).toBe(0);
    });
  });

  describe("updateObject", () => {
    test("overwrites existing object", () => {
      const obj = makeObj({ id: "u1", text: "old" });
      useBoardStore.getState().addObject(obj);
      useBoardStore.getState().updateObject({ ...obj, text: "new" });
      expect(useBoardStore.getState().objects.get("u1")!.text).toBe("new");
    });

    test("reindexes when line endpoints change", () => {
      const line = makeLine({ id: "l1", start_object_id: "s1", end_object_id: "s2" });
      useBoardStore.getState().addObject(line);

      // Change end connection
      useBoardStore.getState().updateObject({ ...line, end_object_id: "s3" });

      const { connectionIndex } = useBoardStore.getState();
      expect(connectionIndex.get("s1")?.has("l1")).toBe(true);
      expect(connectionIndex.has("s2")).toBe(false); // removed
      expect(connectionIndex.get("s3")?.has("l1")).toBe(true);
    });
  });

  describe("deleteObject", () => {
    test("removes from objects Map", () => {
      const obj = makeObj({ id: "d1" });
      useBoardStore.getState().addObject(obj);
      useBoardStore.getState().deleteObject("d1");
      expect(useBoardStore.getState().objects.has("d1")).toBe(false);
    });

    test("removes from selectedIds", () => {
      const obj = makeObj({ id: "d2" });
      useBoardStore.getState().addObject(obj);
      useBoardStore.getState().setSelected("d2");
      useBoardStore.getState().deleteObject("d2");
      expect(useBoardStore.getState().selectedIds.has("d2")).toBe(false);
    });

    test("removes shape from connectionIndex", () => {
      const shape = makeObj({ id: "shape" });
      const line = makeLine({ id: "line", start_object_id: "shape", end_object_id: null });
      useBoardStore.getState().syncAll([shape, line]);

      useBoardStore.getState().deleteObject("shape");
      expect(useBoardStore.getState().connectionIndex.has("shape")).toBe(false);
    });

    test("removing line cleans up index entries", () => {
      const line = makeLine({ id: "line", start_object_id: "s1", end_object_id: "s2" });
      useBoardStore.getState().addObject(line);

      useBoardStore.getState().deleteObject("line");
      const { connectionIndex } = useBoardStore.getState();
      // s1 and s2 should be cleaned up since the only line was removed
      expect(connectionIndex.has("s1")).toBe(false);
      expect(connectionIndex.has("s2")).toBe(false);
    });
  });

  describe("selection", () => {
    test("setSelected(id) sets single selection", () => {
      useBoardStore.getState().setSelected("x");
      expect(useBoardStore.getState().selectedIds).toEqual(new Set(["x"]));
    });

    test("setSelected(null) clears selection", () => {
      useBoardStore.getState().setSelected("x");
      useBoardStore.getState().setSelected(null);
      expect(useBoardStore.getState().selectedIds.size).toBe(0);
    });

    test("setSelectedIds sets multiple", () => {
      useBoardStore.getState().setSelectedIds(new Set(["a", "b"]));
      expect(useBoardStore.getState().selectedIds).toEqual(new Set(["a", "b"]));
    });
  });
});
