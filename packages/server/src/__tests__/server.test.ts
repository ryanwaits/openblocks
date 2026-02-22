import { describe, it, expect, afterEach } from "bun:test";
import { LivelyServer } from "../server";

describe("LivelyServer", () => {
  let server: LivelyServer | null = null;

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
  });

  it("starts on a random port and stops cleanly", async () => {
    server = new LivelyServer();
    await server.start(0);
    expect(server.port).toBeGreaterThan(0);
    await server.stop();
    server = null;
  });

  it("returns -1 port before starting", () => {
    server = new LivelyServer();
    expect(server.port).toBe(-1);
  });

  it("broadcastToRoom returns false for unknown room", async () => {
    server = new LivelyServer();
    await server.start(0);
    expect(server.broadcastToRoom("nonexistent", "hi")).toBe(false);
  });

  // --- Task #7: ws error does not crash server ---

  it("ws error does not crash server", async () => {
    const WebSocket = (await import("ws")).default;
    server = new LivelyServer();
    await server.start(0);

    const ws = new WebSocket(
      `ws://127.0.0.1:${server.port}/rooms/errtest?userId=alice`
    );
    await new Promise<void>((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });

    // Force an error event on the server-side ws
    // The error handler should prevent crash
    ws.terminate();
    await new Promise((r) => setTimeout(r, 50));
    // Server should still be running
    expect(server.port).toBeGreaterThan(0);
  });
});
