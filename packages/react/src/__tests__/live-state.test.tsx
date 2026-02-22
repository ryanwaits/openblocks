import "./setup";
import { describe, it, expect } from "bun:test";
import { createMockRoom, createMockClient, type MockRoom } from "./setup";

const { act, renderHook } = await import("@testing-library/react");
const { createElement } = await import("react");
const { LivelyProvider } = await import("../client-context.js");
const { RoomProvider } = await import("../room-context.js");
const { useLiveState, useLiveStateData, useSetLiveState } = await import(
  "../use-live-state.js"
);

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

describe("useLiveState", () => {
  it("returns initial value when no state exists", () => {
    setup();
    const { result } = renderHook(() => useLiveState("filter", "all"), {
      wrapper,
    });
    expect(result.current[0]).toBe("all");
  });

  it("updates from room changes", async () => {
    setup();
    const { result } = renderHook(() => useLiveState("filter", "all"), {
      wrapper,
    });

    await act(() => {
      mockRoom.setMockLiveState("filter", "active");
    });
    expect(result.current[0]).toBe("active");
  });

  it("setter calls setLiveState on room (after debounce)", async () => {
    setup();
    const { result } = renderHook(
      () => useLiveState("filter", "all", { syncDuration: 0 }),
      { wrapper }
    );

    await act(async () => {
      result.current[1]("completed");
      // Wait for debounce
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(mockRoom.setLiveState).toHaveBeenCalledWith("filter", "completed");
  });
});

describe("useLiveStateData", () => {
  it("returns undefined when no state", () => {
    setup();
    const { result } = renderHook(() => useLiveStateData("x"), { wrapper });
    expect(result.current).toBeUndefined();
  });

  it("returns value from room", async () => {
    setup();
    const { result } = renderHook(() => useLiveStateData("x"), { wrapper });

    await act(() => {
      mockRoom.setMockLiveState("x", 42);
    });
    expect(result.current).toBe(42);
  });
});

describe("useSetLiveState", () => {
  it("returns stable setter", () => {
    setup();
    const { result } = renderHook(() => useSetLiveState("key"), { wrapper });
    expect(typeof result.current).toBe("function");
  });

  it("calls room.setLiveState", async () => {
    setup();
    const { result } = renderHook(() => useSetLiveState("key"), { wrapper });

    await act(() => {
      result.current("value");
    });
    expect(mockRoom.setLiveState).toHaveBeenCalledWith("key", "value", undefined);
  });
});
