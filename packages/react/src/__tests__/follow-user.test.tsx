import "./setup";
import { describe, it, expect, mock } from "bun:test";
import { createMockRoom, createMockClient, type MockRoom } from "./setup";

const { act, renderHook } = await import("@testing-library/react");
const { createElement } = await import("react");
const { OpenBlocksProvider } = await import("../client-context.js");
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
    OpenBlocksProvider,
    { client },
    createElement(
      RoomProvider,
      { roomId: "r", userId: "u1", displayName: "U1" },
      children
    )
  );
}

describe("useFollowUser", () => {
  it("followUser calls room.followUser", () => {
    setup();
    const { result } = renderHook(() => useFollowUser(), { wrapper });

    act(() => result.current.followUser("bob"));
    expect(mockRoom.followUser).toHaveBeenCalledWith("bob");
  });

  it("stopFollowing calls room.stopFollowing", () => {
    setup();
    const { result } = renderHook(() => useFollowUser(), { wrapper });

    act(() => result.current.stopFollowing());
    expect(mockRoom.stopFollowing).toHaveBeenCalledTimes(1);
  });

  it("followingUserId reflects room.getFollowing", async () => {
    setup();
    const { result } = renderHook(() => useFollowUser(), { wrapper });
    expect(result.current.followingUserId).toBeNull();

    await act(() => {
      (mockRoom.getFollowing as any).mockImplementation(() => "bob");
      mockRoom.emit("presence", []);
    });
    expect(result.current.followingUserId).toBe("bob");
  });

  it("calls onViewportChange when target cursor has viewport data", async () => {
    setup();
    const onViewportChange = mock(() => {});
    (mockRoom.getFollowing as any).mockImplementation(() => "bob");

    const { result } = renderHook(
      () => useFollowUser({ onViewportChange }),
      { wrapper }
    );

    // Emit presence to set following state
    await act(() => mockRoom.emit("presence", []));

    // Emit cursor with viewport data
    await act(() => {
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
    (mockRoom.getFollowing as any).mockImplementation(() => "bob");

    renderHook(
      () => useFollowUser({ onAutoExit }),
      { wrapper }
    );

    // Set others including bob, then emit presence
    await act(() => {
      mockRoom.setOthers([{ userId: "bob", displayName: "Bob" }]);
      mockRoom.emit("presence", []);
    });

    // Now bob leaves
    await act(() => {
      mockRoom.setOthers([]);
      mockRoom.emit("presence", []);
    });

    expect(mockRoom.stopFollowing).toHaveBeenCalled();
    expect(onAutoExit).toHaveBeenCalledWith("disconnected");
  });

  it("followers array updates when others follow/unfollow", async () => {
    setup();
    const { result } = renderHook(() => useFollowUser(), { wrapper });
    expect(result.current.followers).toEqual([]);
    expect(result.current.isBeingFollowed).toBe(false);

    await act(() => {
      (mockRoom.getFollowers as any).mockImplementation(() => ["bob", "carol"]);
      mockRoom.emit("presence", []);
    });

    expect(result.current.followers).toEqual(["bob", "carol"]);
    expect(result.current.isBeingFollowed).toBe(true);
  });
});
