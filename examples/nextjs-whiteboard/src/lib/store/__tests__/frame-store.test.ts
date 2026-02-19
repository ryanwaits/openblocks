import { describe, expect, test, beforeEach } from "bun:test";
import { useFrameStore } from "../frame-store";
import { makeFrame } from "../../../../tests/helpers/factory";

function reset() {
  useFrameStore.setState({ frames: [], activeFrameIndex: 0 });
  localStorage.clear();
}

describe("frame-store", () => {
  beforeEach(reset);

  describe("addFrame", () => {
    test("adds and sorts by index", () => {
      useFrameStore.getState().addFrame(makeFrame({ id: "b", index: 2, label: "Frame 2" }));
      useFrameStore.getState().addFrame(makeFrame({ id: "a", index: 0, label: "Frame 1" }));

      const { frames } = useFrameStore.getState();
      expect(frames.length).toBe(2);
      expect(frames[0].index).toBe(0);
      expect(frames[1].index).toBe(2);
    });

    test("dedup by ID", () => {
      const frame = makeFrame({ id: "dup", index: 0 });
      useFrameStore.getState().addFrame(frame);
      useFrameStore.getState().addFrame(frame);

      expect(useFrameStore.getState().frames.length).toBe(1);
    });
  });

  describe("deleteFrame", () => {
    test("removes frame", () => {
      useFrameStore.getState().addFrame(makeFrame({ id: "f1", index: 0 }));
      useFrameStore.getState().addFrame(makeFrame({ id: "f2", index: 1 }));
      useFrameStore.getState().deleteFrame("f1");

      const { frames } = useFrameStore.getState();
      expect(frames.length).toBe(1);
      expect(frames[0].id).toBe("f2");
    });

    test("adjusts activeFrameIndex if >= remaining.length", () => {
      useFrameStore.getState().addFrame(makeFrame({ id: "f1", index: 0 }));
      useFrameStore.getState().addFrame(makeFrame({ id: "f2", index: 1 }));
      useFrameStore.setState({ activeFrameIndex: 1 });
      useFrameStore.getState().deleteFrame("f2");

      expect(useFrameStore.getState().activeFrameIndex).toBe(0);
    });
  });

  describe("syncFrames", () => {
    test("replaces all frames, sorted", () => {
      useFrameStore.getState().addFrame(makeFrame({ id: "old", index: 0 }));
      useFrameStore.getState().syncFrames([
        makeFrame({ id: "b", index: 2 }),
        makeFrame({ id: "a", index: 0 }),
      ]);

      const { frames } = useFrameStore.getState();
      expect(frames.length).toBe(2);
      expect(frames[0].id).toBe("a");
      expect(frames[1].id).toBe("b");
    });
  });

  describe("nextFrameIndex", () => {
    test("empty → 1", () => {
      expect(useFrameStore.getState().nextFrameIndex()).toBe(1);
    });

    test("frames [0, 2] → 3", () => {
      useFrameStore.getState().addFrame(makeFrame({ index: 0 }));
      useFrameStore.getState().addFrame(makeFrame({ index: 2 }));

      expect(useFrameStore.getState().nextFrameIndex()).toBe(3);
    });
  });

  describe("setActiveFrame + restoreActiveFrame", () => {
    test("persists to localStorage when boardId provided", () => {
      useFrameStore.getState().setActiveFrame(2, "board-123");
      expect(localStorage.getItem("activeFrame:board-123")).toBe("2");
    });

    test("does not persist without boardId", () => {
      useFrameStore.getState().setActiveFrame(2);
      expect(useFrameStore.getState().activeFrameIndex).toBe(2);
    });

    test("restoreActiveFrame reads localStorage", () => {
      useFrameStore.getState().syncFrames([
        makeFrame({ index: 0 }),
        makeFrame({ index: 3 }),
      ]);
      localStorage.setItem("activeFrame:board-x", "3");

      const idx = useFrameStore.getState().restoreActiveFrame("board-x");
      expect(idx).toBe(3);
      expect(useFrameStore.getState().activeFrameIndex).toBe(3);
    });

    test("restoreActiveFrame defaults to first frame on missing key", () => {
      useFrameStore.getState().syncFrames([
        makeFrame({ index: 5 }),
      ]);

      const idx = useFrameStore.getState().restoreActiveFrame("missing-board");
      expect(idx).toBe(5);
    });

    test("restoreActiveFrame defaults to first frame on invalid stored value", () => {
      useFrameStore.getState().syncFrames([
        makeFrame({ index: 0 }),
        makeFrame({ index: 1 }),
      ]);
      localStorage.setItem("activeFrame:board-y", "garbage");

      const idx = useFrameStore.getState().restoreActiveFrame("board-y");
      expect(idx).toBe(0);
    });
  });
});
