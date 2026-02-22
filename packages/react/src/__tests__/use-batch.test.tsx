import "./setup";
import { describe, it, expect } from "bun:test";
import { createMockRoom, createMockClient, type MockRoom } from "./setup";

const { renderHook } = await import("@testing-library/react");
const { createElement } = await import("react");
const { LivelyProvider } = await import("../client-context.js");
const { RoomProvider } = await import("../room-context.js");
const { useBatch } = await import("../use-batch.js");

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

describe("useBatch", () => {
  it("delegates to room.batch", () => {
    setup();
    const { result } = renderHook(() => useBatch(), { wrapper });
    const ret = result.current(() => 42);
    expect(ret).toBe(42);
    expect(mockRoom.batch).toHaveBeenCalledTimes(1);
  });

  it("returns a stable reference across renders", () => {
    setup();
    const { result, rerender } = renderHook(() => useBatch(), { wrapper });
    const first = result.current;
    rerender({});
    expect(result.current).toBe(first);
  });
});
