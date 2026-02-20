import "./setup";
import { describe, it, expect } from "bun:test";
import { createMockRoom, createMockClient, type MockRoom } from "./setup";

const { act, renderHook } = await import("@testing-library/react");
const { createElement } = await import("react");
const { OpenBlocksProvider } = await import("../client-context.js");
const { RoomProvider } = await import("../room-context.js");
const { useUndo, useRedo, useCanUndo, useCanRedo, useHistory } = await import(
  "../use-undo-redo.js"
);

let mockRoom: MockRoom;
let client: any;

function setup() {
  mockRoom = createMockRoom();
  client = createMockClient(() => mockRoom);
}

function wrapper({ children }: { children: any }) {
  return createElement(
    OpenBlocksProvider,
    { client },
    createElement(
      RoomProvider,
      { roomId: "r", userId: "u1", displayName: "U1" },
      children
    )
  );
}

describe("useUndo", () => {
  it("returns stable callback", () => {
    setup();
    const { result } = renderHook(() => useUndo(), { wrapper });
    expect(typeof result.current).toBe("function");
  });

  it("calls room.undo()", async () => {
    setup();
    const { result } = renderHook(() => useUndo(), { wrapper });
    await act(() => {
      result.current();
    });
    expect(mockRoom.undo).toHaveBeenCalled();
  });
});

describe("useRedo", () => {
  it("calls room.redo()", async () => {
    setup();
    const { result } = renderHook(() => useRedo(), { wrapper });
    await act(() => {
      result.current();
    });
    expect(mockRoom.redo).toHaveBeenCalled();
  });
});

describe("useCanUndo", () => {
  it("returns false initially", () => {
    setup();
    const { result } = renderHook(() => useCanUndo(), { wrapper });
    expect(result.current).toBe(false);
  });

  it("updates when history changes", async () => {
    setup();
    const { result } = renderHook(() => useCanUndo(), { wrapper });
    expect(result.current).toBe(false);

    await act(() => {
      mockRoom.mockHistory.setCanUndo(true);
    });
    expect(result.current).toBe(true);
  });
});

describe("useCanRedo", () => {
  it("returns false initially", () => {
    setup();
    const { result } = renderHook(() => useCanRedo(), { wrapper });
    expect(result.current).toBe(false);
  });

  it("updates when history changes", async () => {
    setup();
    const { result } = renderHook(() => useCanRedo(), { wrapper });

    await act(() => {
      mockRoom.mockHistory.setCanRedo(true);
    });
    expect(result.current).toBe(true);
  });
});

describe("useHistory", () => {
  it("returns all four values", () => {
    setup();
    const { result } = renderHook(() => useHistory(), { wrapper });
    expect(typeof result.current.undo).toBe("function");
    expect(typeof result.current.redo).toBe("function");
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});
