import { describe, it, expect, mock } from "bun:test";
import WebSocket from "ws";
import { Room } from "../room";
import type { PresenceUser } from "../types";

function mockWs(readyState = WebSocket.OPEN) {
  return { send: mock(() => {}), readyState } as unknown as WebSocket;
}

function makeUser(id: string): PresenceUser {
  return {
    userId: id,
    displayName: `User ${id}`,
    color: "#ef4444",
    connectedAt: Date.now(),
    onlineStatus: "online",
    lastActiveAt: Date.now(),
    isIdle: false,
  };
}

describe("Room", () => {
  it("tracks connections via add/remove", () => {
    const room = new Room("test");
    const ws = mockWs();
    const user = makeUser("u1");

    room.addConnection("c1", ws, user);
    expect(room.size).toBe(1);

    room.removeConnection("c1");
    expect(room.size).toBe(0);
  });

  it("removeConnection returns the user", () => {
    const room = new Room("test");
    const user = makeUser("u1");
    room.addConnection("c1", mockWs(), user);

    const removed = room.removeConnection("c1");
    expect(removed?.userId).toBe("u1");
    expect(removed?.onlineStatus).toBe("online");
  });

  it("removeConnection returns undefined for unknown id", () => {
    const room = new Room("test");
    expect(room.removeConnection("nope")).toBeUndefined();
  });

  it("broadcasts to all open connections", () => {
    const room = new Room("test");
    const ws1 = mockWs();
    const ws2 = mockWs();
    room.addConnection("c1", ws1, makeUser("u1"));
    room.addConnection("c2", ws2, makeUser("u2"));

    room.broadcast("hello");

    expect(ws1.send).toHaveBeenCalledWith("hello");
    expect(ws2.send).toHaveBeenCalledWith("hello");
  });

  it("broadcast excludes specified ids", () => {
    const room = new Room("test");
    const ws1 = mockWs();
    const ws2 = mockWs();
    room.addConnection("c1", ws1, makeUser("u1"));
    room.addConnection("c2", ws2, makeUser("u2"));

    room.broadcast("hello", ["c1"]);

    expect(ws1.send).not.toHaveBeenCalled();
    expect(ws2.send).toHaveBeenCalledWith("hello");
  });

  it("broadcast skips non-OPEN connections", () => {
    const room = new Room("test");
    const ws = mockWs(WebSocket.CLOSED);
    room.addConnection("c1", ws, makeUser("u1"));

    room.broadcast("hello");

    expect(ws.send).not.toHaveBeenCalled();
  });

  it("send delivers to a single connection", () => {
    const room = new Room("test");
    const ws1 = mockWs();
    const ws2 = mockWs();
    room.addConnection("c1", ws1, makeUser("u1"));
    room.addConnection("c2", ws2, makeUser("u2"));

    room.send("c2", "targeted");

    expect(ws1.send).not.toHaveBeenCalled();
    expect(ws2.send).toHaveBeenCalledWith("targeted");
  });

  it("send is a no-op for unknown connection", () => {
    const room = new Room("test");
    room.send("nope", "data"); // should not throw
  });

  it("getUsers returns all connected users", () => {
    const room = new Room("test");
    const u1 = makeUser("u1");
    const u2 = makeUser("u2");
    room.addConnection("c1", mockWs(), u1);
    room.addConnection("c2", mockWs(), u2);

    const users = room.getUsers();
    expect(users).toHaveLength(2);
    expect(users.map((u) => u.userId).sort()).toEqual(["u1", "u2"]);
  });

  // --- Task #8: Presence message caching ---

  it("presence message caches and invalidates on membership change", () => {
    const room = new Room("test");
    room.addConnection("c1", mockWs(), makeUser("u1"));

    const msg1 = room.getPresenceMessage();
    const msg2 = room.getPresenceMessage();
    // Same string reference (cached)
    expect(msg1).toBe(msg2);

    // Verify content
    const parsed = JSON.parse(msg1);
    expect(parsed.type).toBe("presence");
    expect(parsed.users).toHaveLength(1);

    // Add connection invalidates cache
    room.addConnection("c2", mockWs(), makeUser("u2"));
    const msg3 = room.getPresenceMessage();
    expect(msg3).not.toBe(msg1);
    expect(JSON.parse(msg3).users).toHaveLength(2);

    // Remove connection invalidates cache
    room.removeConnection("c1");
    const msg4 = room.getPresenceMessage();
    expect(JSON.parse(msg4).users).toHaveLength(1);
  });

  // --- Task #12: broadcast survives ws.send throw ---

  it("broadcast survives ws.send throw", () => {
    const room = new Room("test");
    const badWs = {
      send: mock(() => { throw new Error("send failed"); }),
      readyState: WebSocket.OPEN,
    } as unknown as WebSocket;
    const goodWs = mockWs();

    room.addConnection("c1", badWs, makeUser("u1"));
    room.addConnection("c2", goodWs, makeUser("u2"));

    // Should not throw
    room.broadcast("hello");
    expect(goodWs.send).toHaveBeenCalledWith("hello");
  });
});
