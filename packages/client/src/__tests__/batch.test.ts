import { describe, it, expect, mock, beforeEach } from "bun:test";
import { Room } from "../room";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  send = mock(() => {});
  close = mock(() => {});

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
    queueMicrotask(() => this.onopen?.());
  }
}

function createRoom(): Room {
  return new Room({
    serverUrl: "ws://localhost:3000",
    roomId: "test",
    userId: "alice",
    displayName: "Alice",
    WebSocket: MockWebSocket as any,
    reconnect: false,
  });
}

describe("Room.batch", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
  });

  it("holds messages during batch, sends after", async () => {
    const room = createRoom();
    room.connect();
    await new Promise((r) => queueMicrotask(r));
    const ws = MockWebSocket.instances[0];

    room.batch(() => {
      room.send({ type: "a", v: 1 });
      room.send({ type: "b", v: 2 });
      // During batch, nothing sent yet
      expect(ws.send).not.toHaveBeenCalled();
    });

    // After batch, both sent
    expect(ws.send).toHaveBeenCalledTimes(2);
    expect(JSON.parse(ws.send.mock.calls[0][0] as string).type).toBe("a");
    expect(JSON.parse(ws.send.mock.calls[1][0] as string).type).toBe("b");
  });

  it("non-batch sends go immediately", async () => {
    const room = createRoom();
    room.connect();
    await new Promise((r) => queueMicrotask(r));
    const ws = MockWebSocket.instances[0];

    room.send({ type: "immediate", v: 1 });
    expect(ws.send).toHaveBeenCalledTimes(1);
  });

  it("flushes even if fn throws", async () => {
    const room = createRoom();
    room.connect();
    await new Promise((r) => queueMicrotask(r));
    const ws = MockWebSocket.instances[0];

    expect(() => {
      room.batch(() => {
        room.send({ type: "before-error", v: 1 });
        throw new Error("oops");
      });
    }).toThrow("oops");

    // Message sent despite error
    expect(ws.send).toHaveBeenCalledTimes(1);
  });

  it("returns callback return value", async () => {
    const room = createRoom();
    room.connect();
    await new Promise((r) => queueMicrotask(r));

    const result = room.batch(() => {
      room.send({ type: "a", v: 1 });
      return 42;
    });
    expect(result).toBe(42);
  });
});
