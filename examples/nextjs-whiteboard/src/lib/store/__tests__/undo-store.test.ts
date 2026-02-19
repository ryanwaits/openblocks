import { describe, expect, test, beforeEach } from "bun:test";
import { useUndoStore } from "../undo-store";
import { makeUndoEntry } from "../../../../tests/helpers/factory";

function reset() {
  useUndoStore.setState({ undoStack: [], redoStack: [] });
}

describe("undo-store", () => {
  beforeEach(reset);

  test("push adds to undoStack", () => {
    const entry = makeUndoEntry("create");
    useUndoStore.getState().push(entry);

    expect(useUndoStore.getState().undoStack.length).toBe(1);
    expect(useUndoStore.getState().undoStack[0]).toEqual(entry);
  });

  test("push clears redoStack", () => {
    const e1 = makeUndoEntry("create");
    const e2 = makeUndoEntry("delete");
    useUndoStore.getState().push(e1);
    useUndoStore.getState().popUndo(); // moves to redo
    expect(useUndoStore.getState().redoStack.length).toBe(1);

    useUndoStore.getState().push(e2);
    expect(useUndoStore.getState().redoStack.length).toBe(0);
  });

  test("push 51 times → length 50 (overflow drops oldest)", () => {
    for (let i = 0; i < 51; i++) {
      useUndoStore.getState().push(makeUndoEntry("create"));
    }
    expect(useUndoStore.getState().undoStack.length).toBe(50);
  });

  test("popUndo returns entry and moves to redoStack", () => {
    const entry = makeUndoEntry("update");
    useUndoStore.getState().push(entry);

    const popped = useUndoStore.getState().popUndo();
    expect(popped).toEqual(entry);
    expect(useUndoStore.getState().undoStack.length).toBe(0);
    expect(useUndoStore.getState().redoStack.length).toBe(1);
  });

  test("popUndo on empty → undefined", () => {
    expect(useUndoStore.getState().popUndo()).toBeUndefined();
  });

  test("popRedo returns entry and moves to undoStack", () => {
    const entry = makeUndoEntry("delete");
    useUndoStore.getState().push(entry);
    useUndoStore.getState().popUndo();

    const popped = useUndoStore.getState().popRedo();
    expect(popped).toEqual(entry);
    expect(useUndoStore.getState().redoStack.length).toBe(0);
    expect(useUndoStore.getState().undoStack.length).toBe(1);
  });

  test("popRedo on empty → undefined", () => {
    expect(useUndoStore.getState().popRedo()).toBeUndefined();
  });

  test("clear empties both stacks", () => {
    useUndoStore.getState().push(makeUndoEntry("create"));
    useUndoStore.getState().push(makeUndoEntry("delete"));
    useUndoStore.getState().popUndo();

    useUndoStore.getState().clear();
    expect(useUndoStore.getState().undoStack.length).toBe(0);
    expect(useUndoStore.getState().redoStack.length).toBe(0);
  });
});
