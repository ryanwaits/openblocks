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

function createRoom(cursorThrottleMs = 50): Room {
  return new Room({
    serverUrl: "ws://localhost:3000",
    roomId: "test",
    userId: "alice",
    displayName: "Alice",
    WebSocket: MockWebSocket as any,
    reconnect: false,
    cursorThrottleMs,
  });
}

describe("Room.updateCursor", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
  });

  it("sends first cursor immediately", async () => {
    const room = createRoom(100);
    room.connect();
    await new Promise((r) => queueMicrotask(r));

    room.updateCursor(10, 20);
    const ws = MockWebSocket.instances[0];
    expect(ws.send).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(ws.send.mock.calls[0][0] as string);
    expect(sent).toEqual({ type: "cursor:update", x: 10, y: 20 });
  });

  it("throttles rapid cursor updates", async () => {
    const room = createRoom(50);
    room.connect();
    await new Promise((r) => queueMicrotask(r));

    room.updateCursor(1, 1); // immediate
    room.updateCursor(2, 2); // throttled
    room.updateCursor(3, 3); // replaces throttled

    const ws = MockWebSocket.instances[0];
    expect(ws.send).toHaveBeenCalledTimes(1); // only first went through
  });

  it("trailing cursor fires after interval", async () => {
    const room = createRoom(20);
    room.connect();
    await new Promise((r) => queueMicrotask(r));

    room.updateCursor(1, 1);
    room.updateCursor(2, 2);

    await new Promise((r) => setTimeout(r, 40));

    const ws = MockWebSocket.instances[0];
    expect(ws.send).toHaveBeenCalledTimes(2);
    const lastSent = JSON.parse(ws.send.mock.calls[1][0] as string);
    expect(lastSent.x).toBe(2);
    expect(lastSent.y).toBe(2);
  });
});
