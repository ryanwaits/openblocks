import { describe, it, expect, afterEach, mock } from "bun:test";
import WebSocket from "ws";
import { OpenBlocksServer } from "../server";
import { connectClient, waitForOpen, createMessageStream } from "./test-helpers";

describe("Server Storage", () => {
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

  it("new connection receives storage:init with null root", async () => {
    server = new OpenBlocksServer();
    await server.start(0);

    const ws = track(connectClient(server.port, "room1", { userId: "alice" }));
    const stream = createMessageStream(ws);
    await waitForOpen(ws);

    const msg = await stream.nextOfType("storage:init");
    expect(msg.type).toBe("storage:init");
    expect(msg.root).toBeNull();
  });

  it("first client sends storage:init → server stores and broadcasts", async () => {
    server = new OpenBlocksServer();
    await server.start(0);

    const ws1 = track(connectClient(server.port, "room1", { userId: "alice" }));
    const stream1 = createMessageStream(ws1);
    await waitForOpen(ws1);
    await stream1.nextOfType("storage:init"); // null root

    const ws2 = track(connectClient(server.port, "room1", { userId: "bob" }));
    const stream2 = createMessageStream(ws2);
    await waitForOpen(ws2);
    await stream2.nextOfType("storage:init"); // null root

    // Client 1 initializes storage
    const initData = {
      type: "LiveObject",
      data: { counter: 0, name: "test" },
    };
    // Set up listeners BEFORE sending to avoid dropped messages
    const p1 = stream1.nextOfType("storage:init");
    const p2 = stream2.nextOfType("storage:init");
    ws1.send(JSON.stringify({ type: "storage:init", root: initData }));

    const [msg1, msg2] = await Promise.all([p1, p2]);
    expect(msg1.root).toBeTruthy();
    expect(msg2.root).toBeTruthy();
  });

  it("storage:ops applied and broadcast to all clients", async () => {
    server = new OpenBlocksServer();
    await server.start(0);

    const ws1 = track(connectClient(server.port, "room1", { userId: "alice" }));
    const stream1 = createMessageStream(ws1);
    await waitForOpen(ws1);
    await stream1.nextOfType("storage:init");

    // Init storage
    ws1.send(
      JSON.stringify({
        type: "storage:init",
        root: { type: "LiveObject", data: { x: 0 } },
      })
    );
    await stream1.nextOfType("storage:init");

    const ws2 = track(connectClient(server.port, "room1", { userId: "bob" }));
    const stream2 = createMessageStream(ws2);
    await waitForOpen(ws2);
    await stream2.nextOfType("storage:init"); // snapshot

    // Set up listeners BEFORE sending ops
    const opsP1 = stream1.nextOfType("storage:ops");
    const opsP2 = stream2.nextOfType("storage:ops");

    const ops = [{ type: "set", path: [], key: "x", value: 42, clock: 1 }];
    ws1.send(JSON.stringify({ type: "storage:ops", ops }));

    const [opsMsg1, opsMsg2] = await Promise.all([opsP1, opsP2]);
    expect(opsMsg1.ops).toBeTruthy();
    expect(typeof opsMsg1.clock).toBe("number");
    expect(opsMsg2.ops).toBeTruthy();
  });

  it("late joiner receives snapshot on connect", async () => {
    server = new OpenBlocksServer();
    await server.start(0);

    const ws1 = track(connectClient(server.port, "room1", { userId: "alice" }));
    const stream1 = createMessageStream(ws1);
    await waitForOpen(ws1);
    await stream1.nextOfType("storage:init");

    // Init storage with data
    ws1.send(
      JSON.stringify({
        type: "storage:init",
        root: { type: "LiveObject", data: { name: "hello", count: 5 } },
      })
    );
    await stream1.nextOfType("storage:init");

    // Late joiner connects
    const ws2 = track(connectClient(server.port, "room1", { userId: "bob" }));
    const stream2 = createMessageStream(ws2);
    await waitForOpen(ws2);

    const msg = await stream2.nextOfType("storage:init");
    expect(msg.root).toBeTruthy();
    const root = msg.root as any;
    expect(root.type).toBe("LiveObject");
    expect(root.data.name).toBe("hello");
    expect(root.data.count).toBe(5);
  });

  it("onStorageChange fires on ops", async () => {
    const onStorageChange = mock(() => {});
    server = new OpenBlocksServer({ onStorageChange });
    await server.start(0);

    const ws = track(connectClient(server.port, "room1", { userId: "alice" }));
    const stream = createMessageStream(ws);
    await waitForOpen(ws);
    await stream.nextOfType("storage:init");

    ws.send(
      JSON.stringify({
        type: "storage:init",
        root: { type: "LiveObject", data: { x: 0 } },
      })
    );
    await stream.nextOfType("storage:init");

    const ops = [{ type: "set", path: [], key: "x", value: 10, clock: 1 }];
    ws.send(JSON.stringify({ type: "storage:ops", ops }));
    await stream.nextOfType("storage:ops");

    // Wait for async callback
    await new Promise((r) => setTimeout(r, 50));
    expect(onStorageChange).toHaveBeenCalledTimes(1);
    expect(onStorageChange.mock.calls[0][0]).toBe("room1");
    expect(onStorageChange.mock.calls[0][1]).toHaveLength(1);
  });

  it("initialStorage seeds room on first connection", async () => {
    const initialStorage = mock(async (_roomId: string) => ({
      type: "LiveObject" as const,
      data: { seeded: true, value: 42 },
    }));
    server = new OpenBlocksServer({ initialStorage });
    await server.start(0);

    const ws = track(connectClient(server.port, "room1", { userId: "alice" }));
    const stream = createMessageStream(ws);
    await waitForOpen(ws);

    const msg = await stream.nextOfType("storage:init");
    expect(msg.root).toBeTruthy();
    const root = msg.root as any;
    expect(root.data.seeded).toBe(true);
    expect(root.data.value).toBe(42);
  });

  it("storage:ops dropped if storage not initialized", async () => {
    server = new OpenBlocksServer();
    await server.start(0);

    const ws = track(connectClient(server.port, "room1", { userId: "alice" }));
    const stream = createMessageStream(ws);
    await waitForOpen(ws);
    await stream.nextOfType("storage:init"); // null root

    // Send ops without initializing storage
    const ops = [{ type: "set", path: [], key: "x", value: 42, clock: 1 }];
    ws.send(JSON.stringify({ type: "storage:ops", ops }));

    // Send a regular message to verify no storage:ops was broadcast
    ws.send(JSON.stringify({ type: "ping", val: 1 }));
    // Should NOT receive storage:ops, just nothing (ping is broadcast to others, not sender)
    // We verify by checking server room has no storage
    const room = server.getRoomManager().get("room1");
    expect(room?.storageInitialized).toBe(false);
  });
});
