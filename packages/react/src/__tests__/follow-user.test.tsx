import "./setup";
import { describe, it, expect, mock } from "bun:test";
import { createMockRoom, createMockClient, type MockRoom } from "./setup";

const { act, renderHook } = await import("@testing-library/react");
const { createElement } = await import("react");
const { LivelyProvider } = await import("../client-context.js");
const { RoomProvider } = await import("../room-context.js");
const { useFollowUser } = await import("../use-follow-user.js");

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

describe("useFollowUser", () => {
  it("followUser calls room.followUser and sets local state", async () => {
    setup();
    mockRoom.setOthers([{ userId: "bob", displayName: "Bob" }]);
    const { result } = renderHook(() => useFollowUser(), { wrapper });
    expect(result.current.followingUserId).toBeNull();

    await act(async () => result.current.followUser("bob"));
    expect(mockRoom.followUser).toHaveBeenCalledWith("bob");
    expect(result.current.followingUserId).toBe("bob");
  });

  it("stopFollowing calls room.stopFollowing and clears local state", async () => {
    setup();
    mockRoom.setOthers([{ userId: "bob", displayName: "Bob" }]);
    const { result } = renderHook(() => useFollowUser(), { wrapper });

    await act(async () => result.current.followUser("bob"));
    expect(result.current.followingUserId).toBe("bob");

    await act(async () => result.current.stopFollowing());
    expect(mockRoom.stopFollowing).toHaveBeenCalledTimes(1);
    expect(result.current.followingUserId).toBeNull();
  });

  it("followingUserId is not cleared by server presence broadcasts", async () => {
    setup();
    mockRoom.setOthers([{ userId: "bob", displayName: "Bob" }]);
    const { result } = renderHook(() => useFollowUser(), { wrapper });

    // Follow bob — local state should be immediate
    await act(async () => result.current.followUser("bob"));
    expect(result.current.followingUserId).toBe("bob");

    // Simulate server presence broadcast (could arrive with stale metadata)
    await act(async () => {
      mockRoom.emit("presence", []);
    });

    // Local state should survive the broadcast
    expect(result.current.followingUserId).toBe("bob");
  });

  it("calls onViewportChange when target cursor has viewport data", async () => {
    setup();
    const onViewportChange = mock(() => {});

    // Set others so bob is present
    mockRoom.setOthers([{ userId: "bob", displayName: "Bob" }]);

    const { result } = renderHook(
      () => useFollowUser({ onViewportChange }),
      { wrapper }
    );

    // Follow bob via local state
    await act(async () => result.current.followUser("bob"));

    // Emit cursor with viewport data
    await act(async () => {
      mockRoom.setCursors(
        new Map([
          [
            "bob",
            {
              userId: "bob",
              displayName: "Bob",
              color: "#0f0",
              x: 100,
              y: 200,
              lastUpdate: Date.now(),
              viewportPos: { x: 50, y: 60 },
              viewportScale: 1.5,
            },
          ],
        ])
      );
      mockRoom.emit("cursors", mockRoom.getCursors());
    });

    expect(onViewportChange).toHaveBeenCalledWith({ x: 50, y: 60 }, 1.5);
  });

  it("auto-exits when target disconnects", async () => {
    setup();
    const onAutoExit = mock(() => {});

    // Set others including bob
    mockRoom.setOthers([{ userId: "bob", displayName: "Bob" }]);

    const { result } = renderHook(
      () => useFollowUser({ onAutoExit }),
      { wrapper }
    );

    // Follow bob
    await act(async () => result.current.followUser("bob"));
    expect(result.current.followingUserId).toBe("bob");

    // Now bob leaves
    await act(async () => {
      mockRoom.setOthers([]);
      mockRoom.emit("presence", []);
    });

    expect(mockRoom.stopFollowing).toHaveBeenCalled();
    expect(onAutoExit).toHaveBeenCalledWith("disconnected");
    expect(result.current.followingUserId).toBeNull();
  });

  it("followers array updates when others follow/unfollow", async () => {
    setup();
    const { result } = renderHook(() => useFollowUser(), { wrapper });
    expect(result.current.followers).toEqual([]);
    expect(result.current.isBeingFollowed).toBe(false);

    await act(async () => {
      (mockRoom.getFollowers as any).mockImplementation(() => ["bob", "carol"]);
      mockRoom.emit("presence", []);
    });

    expect(result.current.followers).toEqual(["bob", "carol"]);
    expect(result.current.isBeingFollowed).toBe(true);
  });
});
