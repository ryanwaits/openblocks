import { describe, it, expect } from "bun:test";
import { HistoryManager } from "../history";
import type { StorageOp } from "@waits/lively-types";

function makeOp(key: string, clock = 0): StorageOp {
  return { type: "set", path: [], key, value: key, clock };
}

function makeInverse(key: string, clock = 0): StorageOp {
  return { type: "set", path: [], key, value: `old-${key}`, clock };
}

describe("HistoryManager", () => {
  it("record + undo returns inverse ops", () => {
    const h = new HistoryManager();
    h.record(makeOp("a"), makeInverse("a"));

    expect(h.canUndo()).toBe(true);
    expect(h.canRedo()).toBe(false);

    const ops = h.undo();
    expect(ops).toEqual([makeInverse("a")]);
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(true);
  });

  it("undo + redo cycle", () => {
    const h = new HistoryManager();
    h.record(makeOp("a"), makeInverse("a"));
    h.record(makeOp("b"), makeInverse("b"));

    const undone = h.undo();
    expect(undone).toEqual([makeInverse("b")]);

    const redone = h.redo();
    expect(redone).toEqual([makeOp("b")]);
  });

  it("new record clears redo stack", () => {
    const h = new HistoryManager();
    h.record(makeOp("a"), makeInverse("a"));
    h.undo();
    expect(h.canRedo()).toBe(true);

    h.record(makeOp("b"), makeInverse("b"));
    expect(h.canRedo()).toBe(false);
  });

  it("undo on empty returns null", () => {
    const h = new HistoryManager();
    expect(h.undo()).toBeNull();
  });

  it("redo on empty returns null", () => {
    const h = new HistoryManager();
    expect(h.redo()).toBeNull();
  });

  describe("batching", () => {
    it("groups ops into single entry", () => {
      const h = new HistoryManager();
      h.startBatch();
      h.record(makeOp("a"), makeInverse("a"));
      h.record(makeOp("b"), makeInverse("b"));
      h.endBatch();

      expect(h.canUndo()).toBe(true);
      const ops = h.undo();
      // Inverse ops in reverse order
      expect(ops).toEqual([makeInverse("b"), makeInverse("a")]);
      expect(h.canUndo()).toBe(false);
    });

    it("empty batch is discarded", () => {
      const h = new HistoryManager();
      h.startBatch();
      h.endBatch();
      expect(h.canUndo()).toBe(false);
    });
  });

  describe("max entries", () => {
    it("evicts oldest when exceeding max", () => {
      const h = new HistoryManager({ maxEntries: 3 });
      h.record(makeOp("a"), makeInverse("a"));
      h.record(makeOp("b"), makeInverse("b"));
      h.record(makeOp("c"), makeInverse("c"));
      h.record(makeOp("d"), makeInverse("d"));

      // Should have b, c, d (a evicted)
      h.undo(); // d
      h.undo(); // c
      h.undo(); // b
      expect(h.undo()).toBeNull(); // a was evicted
    });
  });

  describe("clear", () => {
    it("empties both stacks", () => {
      const h = new HistoryManager();
      h.record(makeOp("a"), makeInverse("a"));
      h.undo();
      expect(h.canRedo()).toBe(true);

      h.clear();
      expect(h.canUndo()).toBe(false);
      expect(h.canRedo()).toBe(false);
    });
  });

  describe("pause/resume", () => {
    it("paused recording is skipped", () => {
      const h = new HistoryManager();
      h.pause();
      h.record(makeOp("a"), makeInverse("a"));
      h.resume();

      expect(h.canUndo()).toBe(false);
    });

    it("resumed recording works", () => {
      const h = new HistoryManager();
      h.pause();
      h.record(makeOp("a"), makeInverse("a"));
      h.resume();
      h.record(makeOp("b"), makeInverse("b"));

      expect(h.canUndo()).toBe(true);
      expect(h.undo()).toEqual([makeInverse("b")]);
    });
  });

  describe("subscribe", () => {
    it("notifies on record", () => {
      const h = new HistoryManager();
      let count = 0;
      h.subscribe(() => count++);

      h.record(makeOp("a"), makeInverse("a"));
      expect(count).toBe(1);
    });

    it("notifies on undo/redo", () => {
      const h = new HistoryManager();
      let count = 0;
      h.record(makeOp("a"), makeInverse("a"));

      h.subscribe(() => count++);
      h.undo();
      expect(count).toBe(1);
      h.redo();
      expect(count).toBe(2);
    });

    it("notifies on clear", () => {
      const h = new HistoryManager();
      let count = 0;
      h.subscribe(() => count++);
      h.record(makeOp("a"), makeInverse("a"));
      h.clear();
      expect(count).toBe(2); // record + clear
    });

    it("unsubscribe works", () => {
      const h = new HistoryManager();
      let count = 0;
      const unsub = h.subscribe(() => count++);
      h.record(makeOp("a"), makeInverse("a"));
      expect(count).toBe(1);

      unsub();
      h.record(makeOp("b"), makeInverse("b"));
      expect(count).toBe(1);
    });

    it("batch notifies once on endBatch", () => {
      const h = new HistoryManager();
      let count = 0;
      h.subscribe(() => count++);

      h.startBatch();
      h.record(makeOp("a"), makeInverse("a"));
      h.record(makeOp("b"), makeInverse("b"));
      expect(count).toBe(0); // no notification during batch
      h.endBatch();
      expect(count).toBe(1); // one notification
    });
  });

  it("enabled: false disables recording", () => {
    const h = new HistoryManager({ enabled: false });
    h.record(makeOp("a"), makeInverse("a"));
    expect(h.canUndo()).toBe(false);
  });
});
