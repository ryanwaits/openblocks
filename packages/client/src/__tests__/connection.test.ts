import { describe, it, expect, mock, beforeEach } from "bun:test";
import { ConnectionManager } from "../connection";

// Minimal mock WebSocket
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
  }

  simulateOpen() {
    this.onopen?.();
  }

  simulateMessage(data: string) {
    this.onmessage?.({ data });
  }

  simulateError(event?: Event) {
    this.onerror?.(event ?? new Event("error"));
  }

  simulateClose() {
    this.onclose?.();
  }
}

function createManager(overrides: Record<string, unknown> = {}): ConnectionManager {
  return new ConnectionManager({
    url: "ws://localhost:3000/rooms/test",
    WebSocket: MockWebSocket as any,
    reconnect: false,
    ...overrides,
  });
}

describe("ConnectionManager", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
  });

  it("starts disconnected", () => {
    const cm = createManager();
    expect(cm.getStatus()).toBe("disconnected");
  });

  it("transitions to connecting then connected on open", () => {
    const statuses: string[] = [];
    const cm = createManager();
    cm.on("status", (s) => statuses.push(s));

    cm.connect();
    expect(cm.getStatus()).toBe("connecting");

    MockWebSocket.instances[0].simulateOpen();
    expect(cm.getStatus()).toBe("connected");
    expect(statuses).toEqual(["connecting", "connected"]);
  });

  it("emits message events", () => {
    const cb = mock(() => {});
    const cm = createManager();
    cm.on("message", cb);
    cm.connect();
    MockWebSocket.instances[0].simulateOpen();
    MockWebSocket.instances[0].simulateMessage('{"type":"test"}');
    expect(cb).toHaveBeenCalledWith('{"type":"test"}');
  });

  it("send() forwards to WebSocket when connected", () => {
    const cm = createManager();
    cm.connect();
    MockWebSocket.instances[0].simulateOpen();
    cm.send("hello");
    expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith("hello");
  });

  it("send() is no-op when not connected", () => {
    const cm = createManager();
    cm.send("ignored");
    // No error thrown, nothing sent
  });

  it("disconnect sets status to disconnected", () => {
    const cm = createManager();
    cm.connect();
    MockWebSocket.instances[0].simulateOpen();
    cm.disconnect();
    expect(cm.getStatus()).toBe("disconnected");
  });

  it("does not reconnect when reconnect=false", () => {
    const cm = createManager({ reconnect: false });
    cm.connect();
    MockWebSocket.instances[0].simulateOpen();
    MockWebSocket.instances[0].simulateClose();
    expect(cm.getStatus()).toBe("disconnected");
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("reconnects with exponential backoff when reconnect=true", async () => {
    const cm = createManager({
      reconnect: true,
      baseDelay: 10,
      maxDelay: 100,
      maxRetries: 3,
    });
    cm.connect();
    MockWebSocket.instances[0].simulateClose();
    expect(cm.getStatus()).toBe("reconnecting");

    // Wait for reconnect attempt
    await new Promise((r) => setTimeout(r, 50));
    expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(2);
  });

  it("stops reconnecting after maxRetries", async () => {
    const cm = createManager({
      reconnect: true,
      baseDelay: 5,
      maxDelay: 10,
      maxRetries: 2,
    });
    cm.connect();

    // Close repeatedly to exhaust retries
    MockWebSocket.instances[0].simulateClose();
    await new Promise((r) => setTimeout(r, 30));
    if (MockWebSocket.instances[1]) MockWebSocket.instances[1].simulateClose();
    await new Promise((r) => setTimeout(r, 30));
    if (MockWebSocket.instances[2]) MockWebSocket.instances[2].simulateClose();
    await new Promise((r) => setTimeout(r, 30));

    expect(cm.getStatus()).toBe("disconnected");
  });

  it("resets attempt counter on successful connection", async () => {
    const cm = createManager({
      reconnect: true,
      baseDelay: 5,
      maxDelay: 10,
      maxRetries: 5,
    });
    cm.connect();
    MockWebSocket.instances[0].simulateClose();

    await new Promise((r) => setTimeout(r, 30));
    // Reconnected — simulate success
    const reconnected = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    reconnected.simulateOpen();
    expect(cm.getStatus()).toBe("connected");

    // Disconnect again — should be able to reconnect (counter reset)
    reconnected.simulateClose();
    expect(cm.getStatus()).toBe("reconnecting");
  });

  it("connect() is no-op when already connecting", () => {
    const cm = createManager();
    cm.connect();
    cm.connect(); // should not create second socket
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("emits error events", () => {
    const cb = mock(() => {});
    const cm = createManager();
    cm.on("error", cb);
    cm.connect();
    const errorEvent = new Event("error");
    MockWebSocket.instances[0].simulateError(errorEvent);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
