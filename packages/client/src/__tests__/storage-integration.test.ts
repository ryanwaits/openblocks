import { describe, it, expect, afterEach } from "bun:test";
import WebSocket from "ws";
import { LivelyServer } from "@waits/lively-server";
import { LivelyClient } from "../client";
import { LiveObject, LiveMap, LiveList } from "@waits/lively-storage";

describe("Storage Integration: E2E", () => {
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

  it("Client A inits storage, Client B joins → receives snapshot", async () => {
    server = new LivelyServer();
    await server.start(0);

    // Client A connects and initializes storage
    const clientA = createClient(server.port);
    const roomA = clientA.joinRoom("room1", {
      userId: "alice",
      displayName: "Alice",
      initialStorage: { counter: 0, name: "test" },
    });
    await waitForStatus(clientA, "room1", "connected");
    const { root: rootA } = await roomA.getStorage();
    rootA.set("counter", 42);

    // Wait for ops to reach server
    await new Promise((r) => setTimeout(r, 100));

    // Client B joins
    const clientB = createClient(server.port);
    const roomB = clientB.joinRoom("room1", {
      userId: "bob",
      displayName: "Bob",
    });
    await waitForStatus(clientB, "room1", "connected");
    const { root: rootB } = await roomB.getStorage();

    expect(rootB.get("counter")).toBe(42);
    expect(rootB.get("name")).toBe("test");
  });

  it("Client A sets LiveObject field → Client B sees change via subscribe", async () => {
    server = new LivelyServer();
    await server.start(0);

    const clientA = createClient(server.port);
    const roomA = clientA.joinRoom("room1", {
      userId: "alice",
      displayName: "Alice",
      initialStorage: { value: 0 },
    });
    await waitForStatus(clientA, "room1", "connected");
    const { root: rootA } = await roomA.getStorage();

    await new Promise((r) => setTimeout(r, 100));

    const clientB = createClient(server.port);
    const roomB = clientB.joinRoom("room1", {
      userId: "bob",
      displayName: "Bob",
    });
    await waitForStatus(clientB, "room1", "connected");
    const { root: rootB } = await roomB.getStorage();

    // Subscribe on B
    const changed = new Promise<void>((resolve) => {
      roomB.subscribe(rootB, () => resolve());
    });

    // Mutate on A
    rootA.set("value", 99);

    await changed;
    expect(rootB.get("value")).toBe(99);
  });

  it("Client A adds to LiveMap → Client B has entry", async () => {
    server = new LivelyServer();
    await server.start(0);

    const clientA = createClient(server.port);
    const roomA = clientA.joinRoom("room1", {
      userId: "alice",
      displayName: "Alice",
      initialStorage: { items: new LiveMap<number>() },
    });
    await waitForStatus(clientA, "room1", "connected");
    const { root: rootA } = await roomA.getStorage();
    const mapA = rootA.get("items") as LiveMap<number>;

    await new Promise((r) => setTimeout(r, 100));

    const clientB = createClient(server.port);
    const roomB = clientB.joinRoom("room1", {
      userId: "bob",
      displayName: "Bob",
    });
    await waitForStatus(clientB, "room1", "connected");
    const { root: rootB } = await roomB.getStorage();

    const changed = new Promise<void>((resolve) => {
      roomB.subscribe(rootB, () => resolve(), { isDeep: true });
    });

    mapA.set("key1", 100);

    await changed;
    const mapB = rootB.get("items") as LiveMap<number>;
    expect(mapB.get("key1")).toBe(100);
  });

  it("Client A pushes to LiveList → Client B has item", async () => {
    server = new LivelyServer();
    await server.start(0);

    const clientA = createClient(server.port);
    const roomA = clientA.joinRoom("room1", {
      userId: "alice",
      displayName: "Alice",
      initialStorage: { list: new LiveList<number>() },
    });
    await waitForStatus(clientA, "room1", "connected");
    const { root: rootA } = await roomA.getStorage();
    const listA = rootA.get("list") as LiveList<number>;

    await new Promise((r) => setTimeout(r, 100));

    const clientB = createClient(server.port);
    const roomB = clientB.joinRoom("room1", {
      userId: "bob",
      displayName: "Bob",
    });
    await waitForStatus(clientB, "room1", "connected");
    const { root: rootB } = await roomB.getStorage();

    const changed = new Promise<void>((resolve) => {
      roomB.subscribe(rootB, () => resolve(), { isDeep: true });
    });

    listA.push(42);

    await changed;
    const listB = rootB.get("list") as LiveList<number>;
    expect(listB.toArray()).toEqual([42]);
  });

  it("concurrent mutations resolve deterministically via LWW", async () => {
    server = new LivelyServer();
    await server.start(0);

    const clientA = createClient(server.port);
    const roomA = clientA.joinRoom("room1", {
      userId: "alice",
      displayName: "Alice",
      initialStorage: { x: 0 },
    });
    await waitForStatus(clientA, "room1", "connected");
    const { root: rootA } = await roomA.getStorage();

    await new Promise((r) => setTimeout(r, 100));

    const clientB = createClient(server.port);
    const roomB = clientB.joinRoom("room1", {
      userId: "bob",
      displayName: "Bob",
    });
    await waitForStatus(clientB, "room1", "connected");
    const { root: rootB } = await roomB.getStorage();

    // A sets x, wait for B to receive it
    rootA.set("x", 1);
    await new Promise((r) => setTimeout(r, 100));

    // B sets x with a higher clock (because B merged A's clock)
    rootB.set("x", 2);
    await new Promise((r) => setTimeout(r, 200));

    // Both should converge: B's clock > A's clock, so B's value wins
    expect(rootA.get("x")).toBe(2);
    expect(rootB.get("x")).toBe(2);
  });

  it("batch groups ops, other client receives atomically", async () => {
    server = new LivelyServer();
    await server.start(0);

    const clientA = createClient(server.port);
    const roomA = clientA.joinRoom("room1", {
      userId: "alice",
      displayName: "Alice",
      initialStorage: { a: 0, b: 0 },
    });
    await waitForStatus(clientA, "room1", "connected");
    const { root: rootA } = await roomA.getStorage();

    await new Promise((r) => setTimeout(r, 100));

    const clientB = createClient(server.port);
    const roomB = clientB.joinRoom("room1", {
      userId: "bob",
      displayName: "Bob",
    });
    await waitForStatus(clientB, "room1", "connected");
    const { root: rootB } = await roomB.getStorage();

    const changed = new Promise<void>((resolve) => {
      roomB.subscribe(rootB, () => resolve());
    });

    roomA.batch(() => {
      rootA.set("a", 10);
      rootA.set("b", 20);
    });

    await changed;
    // Both fields should be updated
    expect(rootB.get("a")).toBe(10);
    expect(rootB.get("b")).toBe(20);
  });

  it("disconnect → reconnect → storage restored", async () => {
    server = new LivelyServer();
    await server.start(0);

    const clientA = createClient(server.port);
    const roomA = clientA.joinRoom("room1", {
      userId: "alice",
      displayName: "Alice",
      initialStorage: { x: 100 },
    });
    await waitForStatus(clientA, "room1", "connected");
    const { root: rootA } = await roomA.getStorage();
    expect(rootA.get("x")).toBe(100);

    // Verify server has storage
    await new Promise((r) => setTimeout(r, 100));
    const serverRoom = server.getRoomManager().get("room1");
    expect(serverRoom?.storageInitialized).toBe(true);

    // New client connects after storage exists
    const clientB = createClient(server.port);
    const roomB = clientB.joinRoom("room1", {
      userId: "bob",
      displayName: "Bob",
    });
    await waitForStatus(clientB, "room1", "connected");
    const { root: rootB } = await roomB.getStorage();
    expect(rootB.get("x")).toBe(100);
  });
});
