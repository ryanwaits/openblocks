import "./setup";
import { describe, it, expect } from "bun:test";
import { createMockRoom, createMockClient, createDeferredPromise, type MockRoom } from "./setup";

const { act, renderHook } = await import("@testing-library/react");
const { createElement } = await import("react");
const { LivelyProvider } = await import("../client-context.js");
const { RoomProvider } = await import("../room-context.js");
const { useSyncStatus } = await import("../use-status.js");

let mockRoom: MockRoom;
let client: any;

function setup(storageOverride?: () => Promise<{ root: any }>) {
  mockRoom = createMockRoom(storageOverride ? { getStorage: storageOverride } : undefined);
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

describe("useSyncStatus", () => {
  it("returns 'synchronized' when connected and storage loaded", async () => {
    setup(); // default mock resolves getStorage immediately
    const { result } = renderHook(() => useSyncStatus(), { wrapper });

    // Wait for storage to load within the same wrapper
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current).toBe("synchronized");
  });

  it("returns 'synchronizing' when connected but storage not yet loaded", () => {
    const deferred = createDeferredPromise<{ root: any }>();
    setup(() => deferred.promise);
    const { result } = renderHook(() => useSyncStatus(), { wrapper });
    expect(result.current).toBe("synchronizing");
  });

  it("returns 'synchronizing' when reconnecting", async () => {
    setup();
    const { result } = renderHook(() => useSyncStatus(), { wrapper });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    await act(() => {
      mockRoom.setStatus("reconnecting");
      mockRoom.emit("status", "reconnecting");
    });
    expect(result.current).toBe("synchronizing");
  });

  it("returns 'not-synchronized' when disconnected", async () => {
    setup();
    const { result } = renderHook(() => useSyncStatus(), { wrapper });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    await act(() => {
      mockRoom.setStatus("disconnected");
      mockRoom.emit("status", "disconnected");
    });
    expect(result.current).toBe("not-synchronized");
  });
});
