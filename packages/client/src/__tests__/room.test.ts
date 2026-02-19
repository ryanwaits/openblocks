import { describe, it, expect, mock, beforeEach } from "bun:test";
import { Room } from "../room";

// Mock WebSocket that auto-opens
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  send = mock(() => {});
  close = mock(() => {
    this.onclose?.();
  });

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
    // Auto-open on next tick
    queueMicrotask(() => this.onopen?.());
  }

  simulateMessage(data: string) {
    this.onmessage?.({ data });
  }

  simulateClose() {
    this.onclose?.();
  }
}

function createRoom(overrides: Record<string, unknown> = {}): Room {
  return new Room({
    serverUrl: "ws://localhost:3000",
    roomId: "test-room",
    userId: "alice",
    displayName: "Alice",
    WebSocket: MockWebSocket as any,
    reconnect: false,
    ...overrides,
  });
}

describe("Room", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
  });

  it("builds correct URL with query params", () => {
    const room = createRoom();
    room.connect();
    expect(MockWebSocket.instances[0].url).toBe(
      "ws://localhost:3000/rooms/test-room?userId=alice&displayName=Alice"
    );
  });

  it("emits status events on connect", async () => {
    const statuses: string[] = [];
    const room = createRoom();
    room.subscribe("status", (s) => statuses.push(s));
    room.connect();
    await new Promise((r) => queueMicrotask(r));
    expect(statuses).toContain("connecting");
    expect(statuses).toContain("connected");
  });

  it("tracks presence from server messages", async () => {
    const room = createRoom();
    room.connect();
    await new Promise((r) => queueMicrotask(r));

    const users = [
      { userId: "alice", displayName: "Alice", color: "#f00", connectedAt: 1 },
      { userId: "bob", displayName: "Bob", color: "#0f0", connectedAt: 2 },
    ];
    MockWebSocket.instances[0].simulateMessage(
      JSON.stringify({ type: "presence", users })
    );

    expect(room.getPresence()).toEqual(users);
    expect(room.getSelf()?.userId).toBe("alice");
    expect(room.getOthers()).toHaveLength(1);
    expect(room.getOthers()[0].userId).toBe("bob");
  });

  it("fires presence subscription", async () => {
    const cb = mock(() => {});
    const room = createRoom();
    room.subscribe("presence", cb);
    room.connect();
    await new Promise((r) => queueMicrotask(r));

    MockWebSocket.instances[0].simulateMessage(
      JSON.stringify({ type: "presence", users: [{ userId: "alice", displayName: "Alice", color: "#f00", connectedAt: 1 }] })
    );
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("tracks cursor updates from server", async () => {
    const cb = mock(() => {});
    const room = createRoom();
    room.subscribe("cursors", cb);
    room.connect();
    await new Promise((r) => queueMicrotask(r));

    const cursor = { userId: "bob", displayName: "Bob", color: "#0f0", x: 10, y: 20, lastUpdate: 1 };
    MockWebSocket.instances[0].simulateMessage(
      JSON.stringify({ type: "cursor:update", cursor })
    );
    expect(cb).toHaveBeenCalledTimes(1);
    expect(room.getCursors().get("bob")).toEqual(cursor);
  });

  it("cleans up cursors on presence update", async () => {
    const room = createRoom();
    room.connect();
    await new Promise((r) => queueMicrotask(r));

    // Add cursor for bob
    MockWebSocket.instances[0].simulateMessage(
      JSON.stringify({ type: "cursor:update", cursor: { userId: "bob", displayName: "Bob", color: "#0f0", x: 10, y: 20, lastUpdate: 1 } })
    );
    expect(room.getCursors().has("bob")).toBe(true);

    // Presence update without bob → cursor cleaned up
    MockWebSocket.instances[0].simulateMessage(
      JSON.stringify({ type: "presence", users: [{ userId: "alice", displayName: "Alice", color: "#f00", connectedAt: 1 }] })
    );
    expect(room.getCursors().has("bob")).toBe(false);
  });

  it("fires message subscription for custom messages", async () => {
    const cb = mock(() => {});
    const room = createRoom();
    room.subscribe("message", cb);
    room.connect();
    await new Promise((r) => queueMicrotask(r));

    MockWebSocket.instances[0].simulateMessage(
      JSON.stringify({ type: "custom:action", payload: "hello" })
    );
    expect(cb).toHaveBeenCalledWith({ type: "custom:action", payload: "hello" });
  });

  it("clears state on reconnecting/disconnected status", async () => {
    const room = createRoom();
    room.connect();
    await new Promise((r) => queueMicrotask(r));

    // Populate state
    MockWebSocket.instances[0].simulateMessage(
      JSON.stringify({ type: "presence", users: [{ userId: "alice", displayName: "Alice", color: "#f00", connectedAt: 1 }] })
    );
    MockWebSocket.instances[0].simulateMessage(
      JSON.stringify({ type: "cursor:update", cursor: { userId: "bob", displayName: "Bob", color: "#0f0", x: 10, y: 20, lastUpdate: 1 } })
    );
    expect(room.getPresence()).toHaveLength(1);
    expect(room.getCursors().size).toBe(1);

    // Simulate close → state cleared
    MockWebSocket.instances[0].simulateClose();
    expect(room.getPresence()).toHaveLength(0);
    expect(room.getCursors().size).toBe(0);
  });

  it("unsubscribe stops callback", async () => {
    const cb = mock(() => {});
    const room = createRoom();
    const unsub = room.subscribe("message", cb);
    room.connect();
    await new Promise((r) => queueMicrotask(r));

    unsub();
    MockWebSocket.instances[0].simulateMessage(
      JSON.stringify({ type: "custom:action", payload: "ignored" })
    );
    expect(cb).not.toHaveBeenCalled();
  });

  it("send() serializes and sends via connection", async () => {
    const room = createRoom();
    room.connect();
    await new Promise((r) => queueMicrotask(r));

    room.send({ type: "test", value: 42 });
    expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith(
      JSON.stringify({ type: "test", value: 42 })
    );
  });

  it("getSelf returns null before presence", () => {
    const room = createRoom();
    expect(room.getSelf()).toBeNull();
  });

  it("handles http:// serverUrl by converting to ws://", () => {
    const room = new Room({
      serverUrl: "http://localhost:3000",
      roomId: "r1",
      userId: "u1",
      displayName: "U",
      WebSocket: MockWebSocket as any,
      reconnect: false,
    });
    room.connect();
    expect(MockWebSocket.instances[0].url).toStartWith("ws://");
  });
});
