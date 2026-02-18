import type { BoardObject, Frame } from "../../src/types/board";
import type { UndoEntry } from "../../src/types/undo";

let counter = 0;
function uid(): string {
  return `test-${++counter}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeObj(overrides?: Partial<BoardObject>): BoardObject {
  return {
    id: uid(),
    board_id: "board-1",
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    color: "#ffffff",
    text: "",
    z_index: 1,
    created_by: null,
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function makeLine(overrides?: Partial<BoardObject>): BoardObject {
  return makeObj({
    type: "line",
    points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
    stroke_color: "#000000",
    stroke_width: 2,
    width: 100,
    height: 100,
    ...overrides,
  });
}

export function makeFrame(overrides?: Partial<Frame>): Frame {
  return {
    id: uid(),
    index: 0,
    label: "Frame 1",
    ...overrides,
  };
}

export function makeUndoEntry(
  type: UndoEntry["type"],
  overrides?: Partial<UndoEntry>
): UndoEntry {
  switch (type) {
    case "create":
      return { type: "create", objects: [makeObj()], ...overrides } as UndoEntry;
    case "delete":
      return { type: "delete", objects: [makeObj()], ...overrides } as UndoEntry;
    case "update":
      return {
        type: "update",
        before: [makeObj()],
        after: [makeObj()],
        ...overrides,
      } as UndoEntry;
  }
}

export function makeObjectMap(...objs: BoardObject[]): Map<string, BoardObject> {
  const map = new Map<string, BoardObject>();
  for (const obj of objs) {
    map.set(obj.id, obj);
  }
  return map;
}
