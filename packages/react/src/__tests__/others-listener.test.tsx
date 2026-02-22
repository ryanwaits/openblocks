import "./setup";
import { describe, it, expect, mock } from "bun:test";
import { createMockRoom, createMockClient, type MockRoom } from "./setup";

const { act, renderHook } = await import("@testing-library/react");
const { createElement } = await import("react");
const { LivelyProvider } = await import("../client-context.js");
const { RoomProvider } = await import("../room-context.js");
const { useOthersListener } = await import("../use-others-listener.js");

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

describe("useOthersListener", () => {
  it("fires 'enter' when a new user joins", async () => {
    setup();
    const cb = mock(() => {});
    renderHook(() => useOthersListener(cb), { wrapper });

    const user = { userId: "u2", displayName: "Alice" };
    await act(() => {
      mockRoom.setOthers([user]);
      mockRoom.emit("presence", []);
    });

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0]).toEqual({
      type: "enter",
      user,
      others: [user],
    });
  });

  it("fires 'leave' when a user disconnects", async () => {
    setup();
    const user = { userId: "u2", displayName: "Alice" };
    mockRoom.setOthers([user]);

    const cb = mock(() => {});
    renderHook(() => useOthersListener(cb), { wrapper });

    // First emit to populate prevUsersRef
    await act(() => {
      mockRoom.emit("presence", []);
    });
    cb.mockClear();

    // User leaves
    await act(() => {
      mockRoom.setOthers([]);
      mockRoom.emit("presence", []);
    });

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0]).toEqual({
      type: "leave",
      user,
      others: [],
    });
  });

  it("fires 'update' when presence data changes", async () => {
    setup();
    const user = { userId: "u2", displayName: "Alice" };
    mockRoom.setOthers([user]);

    const cb = mock(() => {});
    renderHook(() => useOthersListener(cb), { wrapper });

    // Populate prevUsersRef
    await act(() => { mockRoom.emit("presence", []); });
    cb.mockClear();

    // Update presence
    const updated = { userId: "u2", displayName: "Alice2" };
    await act(() => {
      mockRoom.setOthers([updated]);
      mockRoom.emit("presence", []);
    });

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0]).toEqual({
      type: "update",
      user: updated,
      others: [updated],
    });
  });

  it("does not fire when nothing changes", async () => {
    setup();
    const user = { userId: "u2", displayName: "Alice" };
    mockRoom.setOthers([user]);

    const cb = mock(() => {});
    renderHook(() => useOthersListener(cb), { wrapper });

    await act(() => { mockRoom.emit("presence", []); });
    cb.mockClear();

    // Same data
    await act(() => { mockRoom.emit("presence", []); });

    expect(cb).not.toHaveBeenCalled();
  });
});
