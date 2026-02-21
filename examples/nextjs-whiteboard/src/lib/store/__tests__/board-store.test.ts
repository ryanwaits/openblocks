import { describe, expect, test, beforeEach } from "bun:test";
import { useBoardStore } from "../board-store";
import { makeObj } from "../../../../tests/helpers/factory";

function reset() {
  useBoardStore.setState({
    objects: new Map(),
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

    test("prunes stale selectedIds", () => {
      useBoardStore.getState().setSelectedIds(new Set(["a", "b", "c"]));
      useBoardStore.getState().syncAll([makeObj({ id: "a" })]);

      const { selectedIds } = useBoardStore.getState();
      expect(selectedIds).toEqual(new Set(["a"]));
    });

    test("preserves selectedIds reference when no pruning needed", () => {
      const ids = new Set(["a"]);
      useBoardStore.setState({ selectedIds: ids });
      useBoardStore.getState().syncAll([makeObj({ id: "a" })]);
      expect(useBoardStore.getState().selectedIds).toBe(ids);
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
