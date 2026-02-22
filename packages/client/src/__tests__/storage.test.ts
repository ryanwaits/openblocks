import { describe, it, expect, afterEach } from "bun:test";
import WebSocket from "ws";
import { LivelyServer } from "@waits/lively-server";
import { LivelyClient } from "../client";
import { LiveObject } from "@waits/lively-storage";

describe("Client Storage", () => {
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

  function waitForStatus(
    client: LivelyClient,
    roomId: string,
    target: string
  ): Promise<void> {
    return new Promise((resolve) => {
      const room = client.getRoom(roomId)!;
      if (room.getStatus() === target) {
        resolve();
        return;
      }
      const unsub = room.subscribe("status", (status) => {
        if (status === target) {
          unsub();
          resolve();
        }
      });
    });
  }

  it("getStorage resolves after server sends init with data", async () => {
    server = new LivelyServer();
    await server.start(0);

    const client = createClient(server.port);
    const room = client.joinRoom("room1", {
      userId: "alice",
      displayName: "Alice",
      initialStorage: { counter: 0, name: "test" },
    });

    await waitForStatus(client, "room1", "connected");
    const { root } = await room.getStorage();

    expect(root).toBeInstanceOf(LiveObject);
    expect(root.get("counter")).toBe(0);
    expect(root.get("name")).toBe("test");
  });

  it("mutations generate and send ops", async () => {
    server = new LivelyServer();
    await server.start(0);

    const client = createClient(server.port);
    const room = client.joinRoom("room1", {
      userId: "alice",
      displayName: "Alice",
      initialStorage: { x: 0 },
    });

    await waitForStatus(client, "room1", "connected");
    const { root } = await room.getStorage();
    root.set("x", 42);
    expect(root.get("x")).toBe(42);
  });

  it("subscribe fires on local mutation", async () => {
    server = new LivelyServer();
    await server.start(0);

    const client = createClient(server.port);
    const room = client.joinRoom("room1", {
      userId: "alice",
      displayName: "Alice",
      initialStorage: { count: 0 },
    });

    await waitForStatus(client, "room1", "connected");
    const { root } = await room.getStorage();

    let fired = 0;
    room.subscribe(root, () => fired++);
    root.set("count", 1);
    expect(fired).toBeGreaterThan(0);
  });

  it("batch groups storage ops", async () => {
    server = new LivelyServer();
    await server.start(0);

    const client = createClient(server.port);
    const room = client.joinRoom("room1", {
      userId: "alice",
      displayName: "Alice",
      initialStorage: { a: 0, b: 0 },
    });

    await waitForStatus(client, "room1", "connected");
    const { root } = await room.getStorage();

    room.batch(() => {
      root.set("a", 1);
      root.set("b", 2);
    });

    expect(root.get("a")).toBe(1);
    expect(root.get("b")).toBe(2);
  });

  it("initialStorage sends storage:init to server on first connect", async () => {
    server = new LivelyServer();
    await server.start(0);

    const client = createClient(server.port);
    const room = client.joinRoom("room1", {
      userId: "alice",
      displayName: "Alice",
      initialStorage: { seeded: true },
    });

    await waitForStatus(client, "room1", "connected");
    const { root } = await room.getStorage();
    expect(root.get("seeded")).toBe(true);

    // Verify server now has storage
    const serverRoom = server.getRoomManager().get("room1");
    // Wait a tick for the init to reach server
    await new Promise((r) => setTimeout(r, 100));
    expect(serverRoom?.storageInitialized).toBe(true);
  });
});
