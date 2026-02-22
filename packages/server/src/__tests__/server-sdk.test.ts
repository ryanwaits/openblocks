import { describe, it, expect, afterEach } from "bun:test";
import WebSocket from "ws";
import { LivelyServer } from "../server";
import { connectClient, waitForOpen, createMessageStream } from "./test-helpers";

describe("Server SDK methods", () => {
  let server: LivelyServer | null = null;
  const clients: WebSocket[] = [];

  afterEach(async () => {
    for (const ws of clients) ws.terminate();
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

  // ── mutateStorage ──

  it("mutateStorage broadcasts ops to connected client", async () => {
    server = new LivelyServer({
      initialStorage: async () => ({
        type: "LiveObject" as const,
        data: { count: 0 },
      }),
    });
    await server.start(0);

    const ws = track(connectClient(server.port, "room1", { userId: "alice" }));
    const stream = createMessageStream(ws);
    await waitForOpen(ws);
    await stream.nextOfType("storage:init");

    const opsP = stream.nextOfType("storage:ops");
    const result = await server.mutateStorage("room1", (root) => {
      root.set("newKey", "newValue");
    });
    expect(result).toBe(true);

    const opsMsg = await opsP;
    expect(opsMsg.type).toBe("storage:ops");
    expect(Array.isArray(opsMsg.ops)).toBe(true);
    expect((opsMsg.ops as any[]).length).toBeGreaterThan(0);
    expect(typeof opsMsg.clock).toBe("number");

    // Verify mutation actually persisted on the server document
    const room = server.getRoomManager().get("room1");
    const root = room?.getStorageDocument()?.getRoot();
    expect(root?.get("newKey")).toBe("newValue");
  });

  it("mutateStorage returns false for non-existent room", async () => {
    server = new LivelyServer();
    await server.start(0);

    const result = await server.mutateStorage("no-such-room", (root) => {
      root.set("x", 1);
    });
    expect(result).toBe(false);
  });

  it("mutateStorage returns false if storage not initialized", async () => {
    server = new LivelyServer();
    await server.start(0);

    // Connect to create the room, but storage:init returns null (no initialStorage callback)
    const ws = track(connectClient(server.port, "room2", { userId: "alice" }));
    const stream = createMessageStream(ws);
    await waitForOpen(ws);
    await stream.nextOfType("storage:init"); // null root

    const result = await server.mutateStorage("room2", (root) => {
      root.set("x", 1);
    });
    expect(result).toBe(false);
  });

  // ── getRoomUsers ──

  it("getRoomUsers returns connected users", async () => {
    server = new LivelyServer();
    await server.start(0);

    const wsA = track(connectClient(server.port, "room1", { userId: "alice" }));
    const wsB = track(connectClient(server.port, "room1", { userId: "bob" }));
    await Promise.all([waitForOpen(wsA), waitForOpen(wsB)]);

    // Wait briefly for connections to be fully registered
    await new Promise((r) => setTimeout(r, 50));

    const users = server.getRoomUsers("room1");
    expect(users.length).toBe(2);

    const userIds = users.map((u) => u.userId);
    expect(userIds).toContain("alice");
    expect(userIds).toContain("bob");
  });

  it("getRoomUsers returns empty array for non-existent room", async () => {
    server = new LivelyServer();
    await server.start(0);

    const users = server.getRoomUsers("no-such-room");
    expect(users).toEqual([]);
  });

  // ── setLiveState ──

  it("setLiveState broadcasts state:update to client", async () => {
    server = new LivelyServer();
    await server.start(0);

    const ws = track(connectClient(server.port, "room1", { userId: "alice" }));
    const stream = createMessageStream(ws);
    await waitForOpen(ws);

    // Wait for initial presence message to flush
    await new Promise((r) => setTimeout(r, 50));

    const stateP = stream.nextOfType("state:update");
    const result = server.setLiveState("room1", "theme", "dark");
    expect(result).toBe(true);

    const stateMsg = await stateP;
    expect(stateMsg.type).toBe("state:update");
    expect(stateMsg.key).toBe("theme");
    expect(stateMsg.value).toBe("dark");
    expect(stateMsg.userId).toBe("__server__");
    expect(typeof stateMsg.timestamp).toBe("number");
  });

  it("setLiveState returns false for non-existent room", async () => {
    server = new LivelyServer();
    await server.start(0);

    const result = server.setLiveState("no-such-room", "key", "value");
    expect(result).toBe(false);
  });
});
