import "./setup";
import { describe, it, expect } from "bun:test";
import { createMockRoom, createMockClient, type MockRoom } from "./setup";

const { act, renderHook } = await import("@testing-library/react");
const { createElement } = await import("react");
const { LivelyProvider } = await import("../client-context.js");
const { RoomProvider } = await import("../room-context.js");
const { useMyPresence, useUpdateMyPresence } = await import("../use-my-presence.js");

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

describe("useUpdateMyPresence", () => {
  it("calls room.updatePresence with payload", () => {
    setup();
    const { result } = renderHook(() => useUpdateMyPresence(), { wrapper });
    result.current({ location: "page-1" });
    expect(mockRoom.updatePresence).toHaveBeenCalledWith({ location: "page-1" });
  });

  it("returns a stable reference across renders", async () => {
    setup();
    const { result, rerender } = renderHook(() => useUpdateMyPresence(), { wrapper });
    const first = result.current;
    rerender({});
    expect(result.current).toBe(first);
  });
});

describe("useMyPresence", () => {
  it("returns [null, fn] before presence init", () => {
    setup();
    const { result } = renderHook(() => useMyPresence(), { wrapper });
    expect(result.current[0]).toBeNull();
    expect(typeof result.current[1]).toBe("function");
  });

  it("returns [self, fn] after join", async () => {
    setup();
    const self = { userId: "u1", displayName: "U1" };
    const { result } = renderHook(() => useMyPresence(), { wrapper });

    await act(() => {
      mockRoom.setSelf(self);
      mockRoom.emit("presence", [self]);
    });

    expect(result.current[0]).toEqual(self);
    expect(typeof result.current[1]).toBe("function");
  });

  it("updater calls room.updatePresence", async () => {
    setup();
    const { result } = renderHook(() => useMyPresence(), { wrapper });
    result.current[1]({ metadata: { role: "admin" } });
    expect(mockRoom.updatePresence).toHaveBeenCalledWith({ metadata: { role: "admin" } });
  });
});
