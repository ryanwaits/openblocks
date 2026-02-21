import { describe, it, expect, afterEach, mock } from "bun:test";
import WebSocket from "ws";
import { OpenBlocksServer } from "../server";
import { connectClient, waitForOpen, createMessageStream } from "./test-helpers";

describe("Server Storage Integration (raw WS)", () => {
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

  it("full init/ops/snapshot flow with 2 clients", async () => {
    server = new OpenBlocksServer();
    await server.start(0);

    // Client A connects
    const wsA = track(connectClient(server.port, "room1", { userId: "alice" }));
    const streamA = createMessageStream(wsA);
    await waitForOpen(wsA);

    // Should receive storage:init with null
    const initA = await streamA.nextOfType("storage:init");
    expect(initA.root).toBeNull();

    // Client A initializes storage
    const initMsg = {
      type: "storage:init",
      root: { type: "LiveObject", data: { counter: 0 } },
    };
    const initBroadcast = streamA.nextOfType("storage:init");
    wsA.send(JSON.stringify(initMsg));
    const initResult = await initBroadcast;
    expect(initResult.root).toBeTruthy();

    // Client B connects — should get snapshot
    const wsB = track(connectClient(server.port, "room1", { userId: "bob" }));
    const streamB = createMessageStream(wsB);
    await waitForOpen(wsB);
    const snapshotB = await streamB.nextOfType("storage:init");
    expect(snapshotB.root).toBeTruthy();
    const rootData = (snapshotB.root as any).data;
    expect(rootData.counter).toBe(0);

    // Client A sends ops
    const opsP_A = streamA.nextOfType("storage:ops");
    const opsP_B = streamB.nextOfType("storage:ops");
    wsA.send(
      JSON.stringify({
        type: "storage:ops",
        ops: [{ type: "set", path: [], key: "counter", value: 5, clock: 1 }],
      })
    );
    const [opsA, opsB] = await Promise.all([opsP_A, opsP_B]);
    expect((opsA.ops as any[]).length).toBe(1);
    expect((opsB.ops as any[]).length).toBe(1);
    expect(typeof opsA.clock).toBe("number");
  });

  it("second storage:init is ignored (race condition guard)", async () => {
    server = new OpenBlocksServer();
    await server.start(0);

    const ws = track(connectClient(server.port, "room1", { userId: "alice" }));
    const stream = createMessageStream(ws);
    await waitForOpen(ws);
    await stream.nextOfType("storage:init"); // null

    // First init
    const p1 = stream.nextOfType("storage:init");
    ws.send(
      JSON.stringify({
        type: "storage:init",
        root: { type: "LiveObject", data: { first: true } },
      })
    );
    await p1;

    // Second init — should be ignored
    ws.send(
      JSON.stringify({
        type: "storage:init",
        root: { type: "LiveObject", data: { second: true } },
      })
    );

    // Send a regular message to flush
    ws.send(JSON.stringify({ type: "ping" }));
    await new Promise((r) => setTimeout(r, 50));

    // Verify server still has first init
    const room = server.getRoomManager().get("room1");
    const doc = room?.getStorageDocument();
    const root = doc?.getRoot();
    expect(root?.get("first")).toBe(true);
    expect(root?.get("second")).toBeUndefined();
  });

  it("onStorageChange callback receives ops", async () => {
    const onStorageChange = mock(() => {});
    server = new OpenBlocksServer({ onStorageChange });
    await server.start(0);

    const ws = track(connectClient(server.port, "room1", { userId: "alice" }));
    const stream = createMessageStream(ws);
    await waitForOpen(ws);
    await stream.nextOfType("storage:init");

    const initP = stream.nextOfType("storage:init");
    ws.send(
      JSON.stringify({
        type: "storage:init",
        root: { type: "LiveObject", data: { x: 0 } },
      })
    );
    await initP;

    const opsP = stream.nextOfType("storage:ops");
    ws.send(
      JSON.stringify({
        type: "storage:ops",
        ops: [{ type: "set", path: [], key: "x", value: 10, clock: 1 }],
      })
    );
    await opsP;

    await new Promise((r) => setTimeout(r, 50));
    expect(onStorageChange).toHaveBeenCalledTimes(1);
    expect(onStorageChange.mock.calls[0][0]).toBe("room1");
  });

  it("initialStorage callback seeds room", async () => {
    const initialStorage = mock(async () => ({
      type: "LiveObject" as const,
      data: { fromDB: true },
    }));
    server = new OpenBlocksServer({ initialStorage });
    await server.start(0);

    const ws = track(connectClient(server.port, "room1", { userId: "alice" }));
    const stream = createMessageStream(ws);
    await waitForOpen(ws);

    const msg = await stream.nextOfType("storage:init");
    expect(msg.root).toBeTruthy();
    expect((msg.root as any).data.fromDB).toBe(true);
    expect(initialStorage).toHaveBeenCalledTimes(1);
    expect(initialStorage.mock.calls[0][0]).toBe("room1");
  });

  // --- Task #6: concurrent connects call initialStorage only once ---

  it("concurrent connects call initialStorage only once", async () => {
    let callCount = 0;
    const initialStorage = async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 50)); // simulate async work
      return {
        type: "LiveObject" as const,
        data: { seeded: true },
      };
    };
    server = new OpenBlocksServer({ initialStorage });
    await server.start(0);

    // Connect 2 clients simultaneously
    const wsA = track(connectClient(server.port, "race-room", { userId: "alice" }));
    const streamA = createMessageStream(wsA);
    const wsB = track(connectClient(server.port, "race-room", { userId: "bob" }));
    const streamB = createMessageStream(wsB);

    await Promise.all([waitForOpen(wsA), waitForOpen(wsB)]);

    // Both should get storage:init
    const [msgA, msgB] = await Promise.all([
      streamA.nextOfType("storage:init"),
      streamB.nextOfType("storage:init"),
    ]);
    expect(msgA.root).toBeTruthy();
    expect(msgB.root).toBeTruthy();

    // initialStorage called only once
    expect(callCount).toBe(1);
  });

  // --- Task #10: validation tests ---

  it("rejects cursor with NaN", async () => {
    server = new OpenBlocksServer();
    await server.start(0);

    const wsA = track(connectClient(server.port, "val-room", { userId: "alice" }));
    const wsB = track(connectClient(server.port, "val-room", { userId: "bob" }));
    const streamB = createMessageStream(wsB);
    await Promise.all([waitForOpen(wsA), waitForOpen(wsB)]);

    // Skip presence messages
    await new Promise((r) => setTimeout(r, 50));

    // Send invalid cursor — should be silently dropped
    wsA.send(JSON.stringify({ type: "cursor:update", x: NaN, y: 10 }));
    wsA.send(JSON.stringify({ type: "cursor:update", x: 10, y: Infinity }));

    // Send valid cursor to flush
    const cursorP = streamB.nextOfType("cursor:update");
    wsA.send(JSON.stringify({ type: "cursor:update", x: 5, y: 5 }));
    const cursor = await cursorP;
    expect((cursor.cursor as any).x).toBe(5);
  });

  it("rejects ops with non-array", async () => {
    server = new OpenBlocksServer();
    await server.start(0);

    const ws = track(connectClient(server.port, "val-ops", { userId: "alice" }));
    const stream = createMessageStream(ws);
    await waitForOpen(ws);
    await stream.nextOfType("storage:init");

    // Init storage
    const initP = stream.nextOfType("storage:init");
    ws.send(JSON.stringify({
      type: "storage:init",
      root: { type: "LiveObject", data: { x: 0 } },
    }));
    await initP;

    // Send invalid ops (not an array)
    ws.send(JSON.stringify({ type: "storage:ops", ops: "not-array" }));
    // Send empty ops
    ws.send(JSON.stringify({ type: "storage:ops", ops: [] }));

    // Send valid ops to verify server still works
    const opsP = stream.nextOfType("storage:ops");
    ws.send(JSON.stringify({
      type: "storage:ops",
      ops: [{ type: "set", path: [], key: "x", value: 1, clock: 1 }],
    }));
    const opsMsg = await opsP;
    expect((opsMsg.ops as any[]).length).toBe(1);
  });
});
