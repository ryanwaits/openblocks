import { describe, it, expect, afterEach } from "bun:test";
import WebSocket from "ws";
import { LivelyServer } from "@waits/lively-server";
import { LivelyClient } from "../client";
import type { CursorData, PresenceUser } from "@waits/lively-types";

describe("Integration: LivelyClient + Server", () => {
  let server: LivelyServer | null = null;
  const clients: LivelyClient[] = [];

  afterEach(async () => {
    for (const client of clients) {
      for (const room of client.getRooms()) {
        client.leaveRoom(room.roomId);
      }
    }
    clients.length = 0;
    if (server) {
      await server.stop();
      server = null;
    }
  });

  function createClient(port: number): LivelyClient {
    const client = new LivelyClient({
      serverUrl: `ws://127.0.0.1:${port}`,
      WebSocket: WebSocket as any,
      reconnect: false,
    });
    clients.push(client);
    return client;
  }

  function waitForPresence(
    client: LivelyClient,
    roomId: string,
    count: number
  ): Promise<PresenceUser[]> {
    return new Promise((resolve) => {
      const room = client.getRoom(roomId)!;
      if (room.getPresence().length === count) return resolve(room.getPresence());
      const unsub = room.subscribe("presence", (users) => {
        if (users.length === count) {
          unsub();
          resolve(users);
        }
      });
    });
  }

  function waitForStatus(
    client: LivelyClient,
    roomId: string,
    target: string
  ): Promise<void> {
    return new Promise((resolve) => {
      const room = client.getRoom(roomId)!;
      if (room.getStatus() === target) return resolve();
      const unsub = room.subscribe("status", (s) => {
        if (s === target) {
          unsub();
          resolve();
        }
      });
    });
  }

  it("client connects → getPresence returns self", async () => {
    server = new LivelyServer();
    await server.start(0);

    const client = createClient(server.port);
    client.joinRoom("room1", { userId: "alice", displayName: "Alice" });
    await waitForStatus(client, "room1", "connected");
    await waitForPresence(client, "room1", 1);

    const room = client.getRoom("room1")!;
    expect(room.getSelf()?.userId).toBe("alice");
  });

  it("2 clients see each other, subscribe('presence') fires", async () => {
    server = new LivelyServer();
    await server.start(0);

    const c1 = createClient(server.port);
    const c2 = createClient(server.port);

    c1.joinRoom("room1", { userId: "alice", displayName: "Alice" });
    await waitForStatus(c1, "room1", "connected");

    c2.joinRoom("room1", { userId: "bob", displayName: "Bob" });
    await waitForStatus(c2, "room1", "connected");

    await waitForPresence(c1, "room1", 2);
    await waitForPresence(c2, "room1", 2);

    expect(c1.getRoom("room1")!.getOthers()).toHaveLength(1);
    expect(c1.getRoom("room1")!.getOthers()[0].userId).toBe("bob");
    expect(c2.getRoom("room1")!.getOthers()[0].userId).toBe("alice");
  });

  it("updateCursor → other client receives via subscribe('cursors')", async () => {
    server = new LivelyServer();
    await server.start(0);

    const c1 = createClient(server.port);
    const c2 = createClient(server.port);

    c1.joinRoom("room1", { userId: "alice", displayName: "Alice" });
    c2.joinRoom("room1", { userId: "bob", displayName: "Bob" });

    await waitForPresence(c1, "room1", 2);
    await waitForPresence(c2, "room1", 2);

    const cursorPromise = new Promise<CursorData>((resolve) => {
      c2.getRoom("room1")!.subscribe("cursors", (cursors) => {
        const cursor = cursors.get("alice");
        if (cursor) resolve(cursor);
      });
    });

    c1.getRoom("room1")!.updateCursor(10, 20);

    const cursor = await cursorPromise;
    expect(cursor.userId).toBe("alice");
    expect(cursor.x).toBe(10);
    expect(cursor.y).toBe(20);
  });

  it("custom message → subscribe('message') fires on other client", async () => {
    server = new LivelyServer();
    await server.start(0);

    const c1 = createClient(server.port);
    const c2 = createClient(server.port);

    c1.joinRoom("room1", { userId: "alice", displayName: "Alice" });
    c2.joinRoom("room1", { userId: "bob", displayName: "Bob" });

    await waitForPresence(c1, "room1", 2);
    await waitForPresence(c2, "room1", 2);

    const msgPromise = new Promise<Record<string, unknown>>((resolve) => {
      c2.getRoom("room1")!.subscribe("message", resolve);
    });

    c1.getRoom("room1")!.send({ type: "custom:action", payload: "hello" });

    const msg = await msgPromise;
    expect(msg.type).toBe("custom:action");
    expect(msg.payload).toBe("hello");
  });

  it("leaveRoom → clean disconnect, other client sees updated presence", async () => {
    server = new LivelyServer();
    await server.start(0);

    const c1 = createClient(server.port);
    const c2 = createClient(server.port);

    c1.joinRoom("room1", { userId: "alice", displayName: "Alice" });
    c2.joinRoom("room1", { userId: "bob", displayName: "Bob" });

    await waitForPresence(c1, "room1", 2);
    await waitForPresence(c2, "room1", 2);

    const presencePromise = waitForPresence(c1, "room1", 1);
    c2.leaveRoom("room1");
    await presencePromise;

    expect(c1.getRoom("room1")!.getPresence()).toHaveLength(1);
    expect(c1.getRoom("room1")!.getOthers()).toHaveLength(0);
    expect(c2.getRoom("room1")).toBeUndefined();
  });

  it("disconnect → reconnect → presence restored", async () => {
    server = new LivelyServer();
    await server.start(0);

    const client = new LivelyClient({
      serverUrl: `ws://127.0.0.1:${server.port}`,
      WebSocket: WebSocket as any,
      reconnect: true,
      maxRetries: 3,
    });
    clients.push(client);

    client.joinRoom("room1", { userId: "alice", displayName: "Alice" });
    await waitForStatus(client, "room1", "connected");
    await waitForPresence(client, "room1", 1);

    // Force disconnect by terminating all server-side WS connections
    for (const ws of (server as any).wss.clients) {
      ws.terminate();
    }

    // Wait for reconnect
    await waitForStatus(client, "room1", "connected");
    await waitForPresence(client, "room1", 1);

    expect(client.getRoom("room1")!.getSelf()?.userId).toBe("alice");
  });
});
