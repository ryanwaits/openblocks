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
    await waitForOpen(wsA);

    // Should receive storage:init with null
    const initA = await nextMessageOfType(wsA, "storage:init");
    expect(initA.root).toBeNull();

    // Client A initializes storage
    const initMsg = {
      type: "storage:init",
      root: { type: "LiveObject", data: { counter: 0 } },
    };
    const initBroadcast = nextMessageOfType(wsA, "storage:init");
    wsA.send(JSON.stringify(initMsg));
    const initResult = await initBroadcast;
    expect(initResult.root).toBeTruthy();

    // Client B connects — should get snapshot
    const wsB = track(connectClient(server.port, "room1", { userId: "bob" }));
    await waitForOpen(wsB);
    const snapshotB = await nextMessageOfType(wsB, "storage:init");
    expect(snapshotB.root).toBeTruthy();
    const rootData = (snapshotB.root as any).data;
    expect(rootData.counter).toBe(0);

    // Client A sends ops
    const opsP_A = nextMessageOfType(wsA, "storage:ops");
    const opsP_B = nextMessageOfType(wsB, "storage:ops");
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
    await waitForOpen(ws);
    await nextMessageOfType(ws, "storage:init"); // null

    // First init
    const p1 = nextMessageOfType(ws, "storage:init");
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
    await waitForOpen(ws);
    await nextMessageOfType(ws, "storage:init");

    const initP = nextMessageOfType(ws, "storage:init");
    ws.send(
      JSON.stringify({
        type: "storage:init",
        root: { type: "LiveObject", data: { x: 0 } },
      })
    );
    await initP;

    const opsP = nextMessageOfType(ws, "storage:ops");
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
    await waitForOpen(ws);

    const msg = await nextMessageOfType(ws, "storage:init");
    expect(msg.root).toBeTruthy();
    expect((msg.root as any).data.fromDB).toBe(true);
    expect(initialStorage).toHaveBeenCalledTimes(1);
    expect(initialStorage.mock.calls[0][0]).toBe("room1");
  });
});
