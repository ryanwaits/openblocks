import { describe, it, expect, afterEach, mock } from "bun:test";
import WebSocket from "ws";
import { OpenBlocksServer } from "../server";

function connectClient(
  port: number,
  roomId: string,
  params: Record<string, string> = {}
): WebSocket {
  const qs = new URLSearchParams(params).toString();
  const url = `ws://127.0.0.1:${port}/rooms/${roomId}${qs ? "?" + qs : ""}`;
  return new WebSocket(url);
}

function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
}

function nextMessage(ws: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const handler = (data: any) => {
      const parsed = JSON.parse(data.toString());
      // Skip storage:init messages — they're tested separately
      if (parsed.type === "storage:init") {
        ws.once("message", handler);
        return;
      }
      resolve(parsed);
    };
    ws.once("message", handler);
  });
}

describe("Integration", () => {
  let server: OpenBlocksServer | null = null;
  const clients: WebSocket[] = [];

  afterEach(async () => {
    for (const ws of clients) {
      ws.terminate();
    }
    clients.length = 0;
    if (server) {
      await server.stop();
      server = null;
    }
  });

  function track(ws: WebSocket): WebSocket {
    clients.push(ws);
    return ws;
  }

  it("single client receives presence with 1 user", async () => {
    server = new OpenBlocksServer();
    await server.start(0);

    const ws = track(connectClient(server.port, "room1", { userId: "alice", displayName: "Alice" }));
    await waitForOpen(ws);

    const msg = await nextMessage(ws);
    expect(msg.type).toBe("presence");
    const users = msg.users as any[];
    expect(users).toHaveLength(1);
    expect(users[0].userId).toBe("alice");
    expect(users[0].displayName).toBe("Alice");
    expect(typeof users[0].color).toBe("string");
  });

  it("2 clients see each other in presence, 1 disconnects → other sees 1 user", async () => {
    server = new OpenBlocksServer();
    await server.start(0);

    const ws1 = track(connectClient(server.port, "room1", { userId: "alice" }));
    await waitForOpen(ws1);
    await nextMessage(ws1); // presence with 1 user

    const ws2 = track(connectClient(server.port, "room1", { userId: "bob" }));
    await waitForOpen(ws2);

    // ws1 gets updated presence with 2 users
    const msg1 = await nextMessage(ws1);
    expect(msg1.type).toBe("presence");
    expect((msg1.users as any[]).length).toBe(2);

    // ws2 also gets presence with 2 users
    const msg2 = await nextMessage(ws2);
    expect(msg2.type).toBe("presence");
    expect((msg2.users as any[]).length).toBe(2);

    // Now disconnect ws2 and check ws1 gets updated presence
    const presenceUpdate = nextMessage(ws1);
    ws2.close();
    const msg3 = await presenceUpdate;
    expect(msg3.type).toBe("presence");
    expect((msg3.users as any[]).length).toBe(1);
  });

  it("cursor:update is enriched and relayed to other clients, not sender", async () => {
    server = new OpenBlocksServer();
    await server.start(0);

    const ws1 = track(connectClient(server.port, "room1", { userId: "alice", displayName: "Alice" }));
    await waitForOpen(ws1);
    await nextMessage(ws1); // presence

    const ws2 = track(connectClient(server.port, "room1", { userId: "bob" }));
    await waitForOpen(ws2);
    await nextMessage(ws1); // presence update
    await nextMessage(ws2); // presence

    // ws1 sends cursor update
    ws1.send(JSON.stringify({ type: "cursor:update", x: 10, y: 20 }));

    // ws2 receives enriched cursor
    const msg = await nextMessage(ws2);
    expect(msg.type).toBe("cursor:update");
    const cursor = msg.cursor as any;
    expect(cursor.userId).toBe("alice");
    expect(cursor.displayName).toBe("Alice");
    expect(typeof cursor.color).toBe("string");
    expect(cursor.x).toBe(10);
    expect(cursor.y).toBe(20);

    // ws1 should NOT receive its own cursor back — verify by sending another message
    // and checking that ws1 gets that next (not a stale cursor)
    ws2.send(JSON.stringify({ type: "ping", value: 1 }));
    const nextMsg = await nextMessage(ws1);
    expect(nextMsg.type).toBe("ping");
  });

  it("custom message is broadcast and triggers onMessage callback", async () => {
    const onMessage = mock(() => {});
    server = new OpenBlocksServer({ onMessage });
    await server.start(0);

    const ws1 = track(connectClient(server.port, "room1", { userId: "alice" }));
    await waitForOpen(ws1);
    await nextMessage(ws1);

    const ws2 = track(connectClient(server.port, "room1", { userId: "bob" }));
    await waitForOpen(ws2);
    await nextMessage(ws1);
    await nextMessage(ws2);

    ws1.send(JSON.stringify({ type: "custom:action", payload: "hello" }));

    const msg = await nextMessage(ws2);
    expect(msg.type).toBe("custom:action");
    expect(msg.payload).toBe("hello");

    // Wait a tick for async callback
    await new Promise((r) => setTimeout(r, 50));
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage.mock.calls[0][0]).toBe("room1");
    expect(onMessage.mock.calls[0][1]).toBe("alice");
  });

  it("room cleanup removes empty room after timeout", async () => {
    server = new OpenBlocksServer({ roomConfig: { cleanupTimeoutMs: 100 } });
    await server.start(0);

    const ws = track(connectClient(server.port, "room1", { userId: "alice" }));
    await waitForOpen(ws);
    await nextMessage(ws);

    expect(server.getRoomManager().roomCount).toBe(1);

    ws.close();
    await new Promise((r) => setTimeout(r, 50));
    // Room still exists during timeout
    expect(server.getRoomManager().roomCount).toBe(1);

    await new Promise((r) => setTimeout(r, 100));
    // Room removed after timeout
    expect(server.getRoomManager().roomCount).toBe(0);
  });

  it("rejects connection to invalid path", async () => {
    server = new OpenBlocksServer();
    await server.start(0);

    const ws = track(new WebSocket(`ws://127.0.0.1:${server.port}/invalid/path`));

    await new Promise<void>((resolve) => {
      ws.on("error", () => resolve());
      ws.on("close", () => resolve());
    });

    expect(ws.readyState).not.toBe(WebSocket.OPEN);
  });

  it("onJoin and onLeave callbacks fire", async () => {
    const onJoin = mock(() => {});
    const onLeave = mock(() => {});
    server = new OpenBlocksServer({ onJoin, onLeave });
    await server.start(0);

    const ws = track(connectClient(server.port, "room1", { userId: "alice" }));
    await waitForOpen(ws);
    await nextMessage(ws);

    await new Promise((r) => setTimeout(r, 20));
    expect(onJoin).toHaveBeenCalledTimes(1);
    expect(onJoin.mock.calls[0][0]).toBe("room1");
    expect(onJoin.mock.calls[0][1].userId).toBe("alice");

    ws.close();
    await new Promise((r) => setTimeout(r, 50));
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(onLeave.mock.calls[0][0]).toBe("room1");
    expect(onLeave.mock.calls[0][1].userId).toBe("alice");
  });
});
