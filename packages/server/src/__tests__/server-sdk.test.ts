import { describe, it, expect, afterEach } from "bun:test";
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

function nextMessageOfType(
  ws: WebSocket,
  type: string
): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const handler = (data: any) => {
      const parsed = JSON.parse(data.toString());
      if (parsed.type === type) {
        resolve(parsed);
      } else {
        ws.once("message", handler);
      }
    };
    ws.once("message", handler);
  });
}

describe("Server SDK methods", () => {
  let server: OpenBlocksServer | null = null;
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
    server = new OpenBlocksServer({
      initialStorage: async () => ({
        type: "LiveObject" as const,
        data: { count: 0 },
      }),
    });
    await server.start(0);

    const ws = track(connectClient(server.port, "room1", { userId: "alice" }));
    await waitForOpen(ws);
    await nextMessageOfType(ws, "storage:init");

    const opsP = nextMessageOfType(ws, "storage:ops");
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
    server = new OpenBlocksServer();
    await server.start(0);

    const result = await server.mutateStorage("no-such-room", (root) => {
      root.set("x", 1);
    });
    expect(result).toBe(false);
  });

  it("mutateStorage returns false if storage not initialized", async () => {
    server = new OpenBlocksServer();
    await server.start(0);

    // Connect to create the room, but storage:init returns null (no initialStorage callback)
    const ws = track(connectClient(server.port, "room2", { userId: "alice" }));
    await waitForOpen(ws);
    await nextMessageOfType(ws, "storage:init"); // null root

    const result = await server.mutateStorage("room2", (root) => {
      root.set("x", 1);
    });
    expect(result).toBe(false);
  });

  // ── getRoomUsers ──

  it("getRoomUsers returns connected users", async () => {
    server = new OpenBlocksServer();
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
    server = new OpenBlocksServer();
    await server.start(0);

    const users = server.getRoomUsers("no-such-room");
    expect(users).toEqual([]);
  });

  // ── setLiveState ──

  it("setLiveState broadcasts state:update to client", async () => {
    server = new OpenBlocksServer();
    await server.start(0);

    const ws = track(connectClient(server.port, "room1", { userId: "alice" }));
    await waitForOpen(ws);

    // Wait for initial presence message to flush
    await new Promise((r) => setTimeout(r, 50));

    const stateP = nextMessageOfType(ws, "state:update");
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
    server = new OpenBlocksServer();
    await server.start(0);

    const result = server.setLiveState("no-such-room", "key", "value");
    expect(result).toBe(false);
  });
});
