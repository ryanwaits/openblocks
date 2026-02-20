import "./setup";
import { describe, it, expect, mock } from "bun:test";
import { createMockRoom, createMockClient, type MockRoom } from "./setup";

const { render, act, renderHook } = await import("@testing-library/react");
const { createElement } = await import("react");
const { OpenBlocksProvider } = await import("../client-context.js");
const { RoomProvider } = await import("../room-context.js");
const { useStatus, useLostConnectionListener } = await import("../use-status.js");
const { useSelf } = await import("../use-self.js");
const { useOthers, useOther, useOthersMapped, useOthersUserIds } = await import("../use-others.js");

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

describe("useStatus", () => {
  it("returns current status and re-renders on change", async () => {
    setup();
    const { result } = renderHook(() => useStatus(), { wrapper });
    expect(result.current).toBe("connected");

    await act(() => {
      mockRoom.setStatus("reconnecting");
      mockRoom.emit("status", "reconnecting");
    });
    expect(result.current).toBe("reconnecting");
  });
});

describe("useSelf", () => {
  it("returns null initially, then user after presence update", async () => {
    setup();
    const { result } = renderHook(() => useSelf(), { wrapper });
    expect(result.current).toBeNull();

    const self = { userId: "u1", displayName: "U1" };
    await act(() => {
      mockRoom.setSelf(self);
      mockRoom.emit("presence", [self]);
    });
    expect(result.current).toEqual(self);
  });

  it("returns referentially stable object when unchanged", async () => {
    setup();
    const self = { userId: "u1", displayName: "U1" };
    mockRoom.setSelf(self);

    const { result } = renderHook(() => useSelf(), { wrapper });
    const first = result.current;

    // Emit same data — new object with same values
    await act(() => {
      mockRoom.setSelf({ userId: "u1", displayName: "U1" });
      mockRoom.emit("presence", [{ userId: "u1", displayName: "U1" }]);
    });
    expect(result.current).toBe(first); // same reference
  });
});

describe("useOthers", () => {
  it("returns others and updates", async () => {
    setup();
    const { result } = renderHook(() => useOthers(), { wrapper });
    expect(result.current).toEqual([]);

    const other = { userId: "u2", displayName: "U2" };
    await act(() => {
      mockRoom.setOthers([other]);
      mockRoom.emit("presence", [{ userId: "u1", displayName: "U1" }, other]);
    });
    expect(result.current).toEqual([other]);
  });

  it("returns referentially stable array when unchanged", async () => {
    setup();
    const others = [{ userId: "u2", displayName: "U2" }];
    mockRoom.setOthers(others);

    const { result } = renderHook(() => useOthers(), { wrapper });
    const first = result.current;

    await act(() => {
      mockRoom.setOthers([{ userId: "u2", displayName: "U2" }]);
      mockRoom.emit("presence", []);
    });
    expect(result.current).toBe(first);
  });
});

describe("useOther", () => {
  it("returns user by userId", async () => {
    setup();
    const other = { userId: "u2", displayName: "Alice", color: "#f00", connectedAt: 0 };
    mockRoom.setOthers([other]);
    const { result } = renderHook(() => useOther("u2"), { wrapper });
    expect(result.current).toEqual(other);
  });

  it("returns null when user not found", async () => {
    setup();
    const { result } = renderHook(() => useOther("nobody"), { wrapper });
    expect(result.current).toBeNull();
  });

  it("applies selector", async () => {
    setup();
    const other = { userId: "u2", displayName: "Alice", color: "#f00", connectedAt: 0 };
    mockRoom.setOthers([other]);
    const { result } = renderHook(() => useOther("u2", (u) => u.displayName), { wrapper });
    expect(result.current).toBe("Alice");
  });
});

describe("useOthersMapped", () => {
  it("maps each user with selector", async () => {
    setup();
    const others = [
      { userId: "u2", displayName: "Alice" },
      { userId: "u3", displayName: "Bob" },
    ];
    mockRoom.setOthers(others);

    const { result } = renderHook(
      () => useOthersMapped((u: any) => u.displayName),
      { wrapper }
    );
    expect(result.current).toEqual(["Alice", "Bob"]);
  });

  it("is referentially stable when users unchanged", async () => {
    setup();
    const others = [{ userId: "u2", displayName: "Alice" }];
    mockRoom.setOthers(others);

    const { result } = renderHook(
      () => useOthersMapped((u: any) => u.displayName),
      { wrapper }
    );
    const first = result.current;

    await act(() => {
      mockRoom.setOthers([{ userId: "u2", displayName: "Alice" }]);
      mockRoom.emit("presence", []);
    });
    expect(result.current).toBe(first);
  });
});

describe("useLostConnectionListener", () => {
  it("fires callback when status goes connected → reconnecting", async () => {
    setup();
    const onLost = mock(() => {});
    renderHook(() => useLostConnectionListener(onLost), { wrapper });

    // First set status to connected so prev is tracked
    await act(() => {
      mockRoom.setStatus("connected");
      mockRoom.emit("status", "connected");
    });

    await act(() => {
      mockRoom.setStatus("reconnecting");
      mockRoom.emit("status", "reconnecting");
    });

    expect(onLost).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire on intentional disconnect", async () => {
    setup();
    const onLost = mock(() => {});
    renderHook(() => useLostConnectionListener(onLost), { wrapper });

    await act(() => {
      mockRoom.setStatus("connected");
      mockRoom.emit("status", "connected");
    });

    await act(() => {
      mockRoom.setStatus("disconnected");
      mockRoom.emit("status", "disconnected");
    });

    expect(onLost).not.toHaveBeenCalled();
  });
});

describe("useOthersUserIds", () => {
  it("returns [] initially", () => {
    setup();
    const { result } = renderHook(() => useOthersUserIds(), { wrapper });
    expect(result.current).toEqual([]);
  });

  it("returns sorted userIds after others join", async () => {
    setup();
    const { result } = renderHook(() => useOthersUserIds(), { wrapper });

    await act(() => {
      mockRoom.setOthers([
        { userId: "u3", displayName: "U3" },
        { userId: "u2", displayName: "U2" },
      ]);
      mockRoom.emit("presence", []);
    });

    expect(result.current).toEqual(["u2", "u3"]);
  });

  it("does NOT re-render when presence data changes (same userId set)", async () => {
    setup();
    mockRoom.setOthers([{ userId: "u2", displayName: "U2" }]);

    const { result } = renderHook(() => useOthersUserIds(), { wrapper });
    const first = result.current;

    await act(() => {
      mockRoom.setOthers([{ userId: "u2", displayName: "U2-renamed" }]);
      mockRoom.emit("presence", []);
    });

    expect(result.current).toBe(first); // same reference
  });
});
