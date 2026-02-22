import { describe, it, expect, afterEach } from "bun:test";
import WebSocket from "ws";
import { LivelyServer } from "../server";
import type { AuthHandler } from "../types";

const validToken = "valid-secret";

const tokenAuth: AuthHandler = {
  async authenticate(req) {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");
    if (token !== validToken) return null;
    return { userId: "auth-user-1", displayName: "Authenticated User" };
  },
};

function nextMessage(ws: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    ws.once("message", (data) => {
      resolve(JSON.parse(data.toString()));
    });
  });
}

describe("Auth", () => {
  let server: LivelyServer | null = null;

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
  });

  it("rejects connection without valid token", async () => {
    server = new LivelyServer({ auth: tokenAuth });
    await server.start(0);

    const ws = new WebSocket(
      `ws://127.0.0.1:${server.port}/rooms/room1`
    );

    const closed = await new Promise<{ code: number }>((resolve) => {
      ws.on("close", (code) => resolve({ code }));
      ws.on("error", () => {}); // suppress error
    });

    // Connection was rejected — should not be open
    expect(ws.readyState).not.toBe(WebSocket.OPEN);
  });

  it("accepts connection with valid token", async () => {
    server = new LivelyServer({ auth: tokenAuth });
    await server.start(0);

    const ws = new WebSocket(
      `ws://127.0.0.1:${server.port}/rooms/room1?token=${validToken}`
    );

    await new Promise<void>((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });

    const msg = await nextMessage(ws);
    expect(msg.type).toBe("presence");
    const users = msg.users as any[];
    expect(users).toHaveLength(1);
    expect(users[0].userId).toBe("auth-user-1");
    expect(users[0].displayName).toBe("Authenticated User");

    ws.terminate();
  });

  it("auth handler userId overrides query params", async () => {
    server = new LivelyServer({ auth: tokenAuth });
    await server.start(0);

    // Pass userId in query params AND valid token — auth result should win
    const ws = new WebSocket(
      `ws://127.0.0.1:${server.port}/rooms/room1?token=${validToken}&userId=query-user&displayName=QueryUser`
    );

    await new Promise<void>((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });

    const msg = await nextMessage(ws);
    expect(msg.type).toBe("presence");
    const users = msg.users as any[];
    expect(users[0].userId).toBe("auth-user-1"); // from auth handler, NOT query param
    expect(users[0].displayName).toBe("Authenticated User");

    ws.terminate();
  });
});
