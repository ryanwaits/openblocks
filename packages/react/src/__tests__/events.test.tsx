import "./setup";
import { describe, it, expect, mock } from "bun:test";
import { createMockRoom, createMockClient, type MockRoom } from "./setup";

const { act, renderHook } = await import("@testing-library/react");
const { createElement } = await import("react");
const { LivelyProvider } = await import("../client-context.js");
const { RoomProvider } = await import("../room-context.js");
const { useCursors, useUpdateCursor } = await import("../use-cursors.js");
const { useBroadcastEvent } = await import("../use-broadcast-event.js");
const { useEventListener } = await import("../use-event-listener.js");

let mockRoom: MockRoom;
let client: any;

function setup() {
  mockRoom = createMockRoom();
  client = createMockClient(() => mockRoom);
}

function wrapper({ children }: { children: any }) {
  return createElement(
    LivelyProvider,
    { client },
    createElement(
      RoomProvider,
      { roomId: "r", userId: "u1", displayName: "U1" },
      children
    )
  );
}

describe("useCursors", () => {
  it("returns empty map initially", () => {
    setup();
    const { result } = renderHook(() => useCursors(), { wrapper });
    expect(result.current.size).toBe(0);
  });

  it("updates when cursors change", async () => {
    setup();
    const { result } = renderHook(() => useCursors(), { wrapper });

    const cursors = new Map([
      ["u2", { userId: "u2", x: 100, y: 200, displayName: "Alice" }],
    ]);

    await act(() => {
      mockRoom.setCursors(cursors);
      mockRoom.emit("cursors", cursors);
    });

    expect(result.current.size).toBe(1);
    expect(result.current.get("u2")?.x).toBe(100);
  });

  it("returns stable reference when cursors unchanged", async () => {
    setup();
    const cursors = new Map([
      ["u2", { userId: "u2", x: 10, y: 20, displayName: "A" }],
    ]);
    mockRoom.setCursors(cursors);

    const { result } = renderHook(() => useCursors(), { wrapper });
    const first = result.current;

    // Emit same cursor data
    await act(() => {
      mockRoom.setCursors(
        new Map([["u2", { userId: "u2", x: 10, y: 20, displayName: "A" }]])
      );
      mockRoom.emit("cursors", new Map());
    });
    expect(result.current).toBe(first);
  });
});

describe("useUpdateCursor", () => {
  it("calls room.updateCursor", () => {
    setup();
    const { result } = renderHook(() => useUpdateCursor(), { wrapper });
    result.current(50, 75);
    expect(mockRoom.updateCursor).toHaveBeenCalledWith(50, 75, undefined, undefined);
  });

  it("returns stable function reference", () => {
    setup();
    const { result, rerender } = renderHook(() => useUpdateCursor(), { wrapper });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});

describe("useBroadcastEvent", () => {
  it("calls room.send with event", () => {
    setup();
    const { result } = renderHook(() => useBroadcastEvent(), { wrapper });
    result.current({ type: "emoji", emoji: "👍" });
    expect(mockRoom.send).toHaveBeenCalledWith({ type: "emoji", emoji: "👍" });
  });

  it("returns stable function reference", () => {
    setup();
    const { result, rerender } = renderHook(() => useBroadcastEvent(), { wrapper });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});

describe("useEventListener", () => {
  it("fires callback on message events", async () => {
    setup();
    const handler = mock(() => {});
    renderHook(() => useEventListener(handler), { wrapper });

    await act(() => {
      mockRoom.emit("message", { type: "emoji", emoji: "🎉" });
    });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toEqual({ type: "emoji", emoji: "🎉" });
  });

  it("uses latest callback ref", async () => {
    setup();
    const handler1 = mock(() => {});
    const handler2 = mock(() => {});

    const { rerender } = renderHook(
      ({ cb }) => useEventListener(cb),
      { wrapper, initialProps: { cb: handler1 } }
    );

    rerender({ cb: handler2 });

    await act(() => {
      mockRoom.emit("message", { type: "test" });
    });

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledTimes(1);
  });
});
