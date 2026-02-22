import "./setup";
import { describe, it, expect } from "bun:test";
import { createMockRoom, createMockClient, type MockRoom } from "./setup";

const { act, renderHook } = await import("@testing-library/react");
const { createElement } = await import("react");
const { LivelyProvider } = await import("../client-context.js");
const { RoomProvider } = await import("../room-context.js");
const { createRoomContext } = await import("../create-room-context.js");

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

describe("createRoomContext", () => {
  it("returns an object with all expected hook keys", () => {
    const ctx = createRoomContext();
    const expectedKeys = [
      "RoomProvider", "useRoom", "useIsInsideRoom", "useStorageRoot",
      "useStorage", "useMutation", "useBatch",
      "useSelf", "useMyPresence", "useUpdateMyPresence",
      "useOthers", "useOther", "useOthersMapped", "useOthersUserIds", "useOthersListener",
      "useStatus", "useSyncStatus", "useLostConnectionListener", "useErrorListener",
      "useBroadcastEvent", "useEventListener",
      "useHistory", "useUndo", "useRedo", "useCanUndo", "useCanRedo",
      "useLiveState", "useLiveStateData", "useSetLiveState",
      "useCursors", "useUpdateCursor",
      "useOthersOnLocation", "usePresenceEvent",
    ];

    for (const key of expectedKeys) {
      expect(typeof (ctx as any)[key]).toBe("function");
    }
  });

  it("typed hooks work identically to direct imports", async () => {
    setup();
    const ctx = createRoomContext<{ cursor: null }, { count: number }>();

    const { result } = renderHook(() => ctx.useSelf(), { wrapper });
    expect(result.current).toBeNull();

    const self = { userId: "u1", displayName: "U1" };
    await act(() => {
      mockRoom.setSelf(self);
      mockRoom.emit("presence", [self]);
    });
    expect(result.current).toEqual(self);
  });

  it("useUpdateMyPresence delegates to room.updatePresence", () => {
    setup();
    const ctx = createRoomContext<{ cursor: null }, { count: number }>();
    const { result } = renderHook(() => ctx.useUpdateMyPresence(), { wrapper });
    result.current({ cursor: null });
    expect(mockRoom.updatePresence).toHaveBeenCalledWith({ cursor: null });
  });
});
