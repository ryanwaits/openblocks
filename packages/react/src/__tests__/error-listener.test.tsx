import "./setup";
import { describe, it, expect, mock } from "bun:test";
import { createMockRoom, createMockClient, type MockRoom } from "./setup";

const { act, renderHook } = await import("@testing-library/react");
const { createElement } = await import("react");
const { LivelyProvider } = await import("../client-context.js");
const { RoomProvider } = await import("../room-context.js");
const { useErrorListener } = await import("../use-error-listener.js");

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

describe("useErrorListener", () => {
  it("fires callback on room error event", async () => {
    setup();
    const cb = mock(() => {});
    renderHook(() => useErrorListener(cb), { wrapper });

    const err = new Error("WebSocket error");
    await act(() => {
      mockRoom.emit("error", err);
    });

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0]).toBe(err);
  });

  it("uses latest callback ref (no stale closure)", async () => {
    setup();
    const cb1 = mock(() => {});
    const cb2 = mock(() => {});
    const { rerender } = renderHook(
      ({ cb }) => useErrorListener(cb),
      { wrapper, initialProps: { cb: cb1 } }
    );

    rerender({ cb: cb2 });

    await act(() => {
      mockRoom.emit("error", new Error("test"));
    });

    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes on unmount", async () => {
    setup();
    const cb = mock(() => {});
    const { unmount } = renderHook(() => useErrorListener(cb), { wrapper });

    unmount();

    await act(() => {
      mockRoom.emit("error", new Error("after unmount"));
    });

    expect(cb).not.toHaveBeenCalled();
  });
});
