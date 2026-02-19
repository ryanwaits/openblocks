import { describe, it, expect, mock, beforeEach } from "bun:test";
import { OpenBlocksClient } from "../client";

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
    queueMicrotask(() => this.onopen?.());
  }
}

describe("OpenBlocksClient", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
  });

  it("joinRoom creates and auto-connects a Room", async () => {
    const client = new OpenBlocksClient({
      serverUrl: "ws://localhost:3000",
      WebSocket: MockWebSocket as any,
      reconnect: false,
    });

    const room = client.joinRoom("room1", { userId: "alice", displayName: "Alice" });
    expect(room.roomId).toBe("room1");
    await new Promise((r) => queueMicrotask(r));
    expect(room.getStatus()).toBe("connected");
  });

  it("joinRoom returns existing room on duplicate", () => {
    const client = new OpenBlocksClient({
      serverUrl: "ws://localhost:3000",
      WebSocket: MockWebSocket as any,
      reconnect: false,
    });

    const r1 = client.joinRoom("room1", { userId: "alice", displayName: "Alice" });
    const r2 = client.joinRoom("room1", { userId: "alice", displayName: "Alice" });
    expect(r1).toBe(r2);
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("getRoom returns room or undefined", () => {
    const client = new OpenBlocksClient({
      serverUrl: "ws://localhost:3000",
      WebSocket: MockWebSocket as any,
      reconnect: false,
    });

    expect(client.getRoom("nope")).toBeUndefined();
    client.joinRoom("room1", { userId: "alice", displayName: "Alice" });
    expect(client.getRoom("room1")).toBeDefined();
  });

  it("getRooms returns all active rooms", () => {
    const client = new OpenBlocksClient({
      serverUrl: "ws://localhost:3000",
      WebSocket: MockWebSocket as any,
      reconnect: false,
    });

    client.joinRoom("r1", { userId: "alice", displayName: "Alice" });
    client.joinRoom("r2", { userId: "alice", displayName: "Alice" });
    expect(client.getRooms()).toHaveLength(2);
  });

  it("leaveRoom disconnects and removes", async () => {
    const client = new OpenBlocksClient({
      serverUrl: "ws://localhost:3000",
      WebSocket: MockWebSocket as any,
      reconnect: false,
    });

    const room = client.joinRoom("room1", { userId: "alice", displayName: "Alice" });
    await new Promise((r) => queueMicrotask(r));

    client.leaveRoom("room1");
    expect(room.getStatus()).toBe("disconnected");
    expect(client.getRoom("room1")).toBeUndefined();
    expect(client.getRooms()).toHaveLength(0);
  });

  it("leaveRoom is no-op for unknown room", () => {
    const client = new OpenBlocksClient({
      serverUrl: "ws://localhost:3000",
      WebSocket: MockWebSocket as any,
      reconnect: false,
    });
    expect(() => client.leaveRoom("nope")).not.toThrow();
  });
});
