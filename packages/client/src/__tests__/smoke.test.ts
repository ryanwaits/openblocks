import { describe, it, expect, afterEach } from "bun:test";
import WebSocket from "ws";
import { LivelyServer } from "@waits/lively-server";
import { Room } from "../room";

describe("Smoke: Room + real server", () => {
  let server: LivelyServer | null = null;
  const rooms: Room[] = [];

  afterEach(async () => {
    for (const room of rooms) room.disconnect();
    rooms.length = 0;
    if (server) {
      await server.stop();
      server = null;
    }
  });

  function track(room: Room): Room {
    rooms.push(room);
    return room;
  }

  function waitForStatus(room: Room, target: string): Promise<void> {
    return new Promise((resolve) => {
      if (room.getStatus() === target) return resolve();
      const unsub = room.subscribe("status", (s) => {
        if (s === target) {
          unsub();
          resolve();
        }
      });
    });
  }

  function waitForPresence(room: Room, count: number): Promise<void> {
    return new Promise((resolve) => {
      if (room.getPresence().length === count) return resolve();
      const unsub = room.subscribe("presence", (users) => {
        if (users.length === count) {
          unsub();
          resolve();
        }
      });
    });
  }

  it("connects, receives presence, getSelf() works", async () => {
    server = new LivelyServer();
    await server.start(0);

    const room = track(
      new Room({
        serverUrl: `ws://127.0.0.1:${server.port}`,
        roomId: "smoke-room",
        userId: "alice",
        displayName: "Alice",
        WebSocket: WebSocket as any,
        reconnect: false,
      })
    );

    room.connect();
    await waitForStatus(room, "connected");
    await waitForPresence(room, 1);

    const self = room.getSelf();
    expect(self).not.toBeNull();
    expect(self!.userId).toBe("alice");
    expect(self!.displayName).toBe("Alice");
    expect(typeof self!.color).toBe("string");
  });

  it("two clients see each other in presence", async () => {
    server = new LivelyServer();
    await server.start(0);

    const room1 = track(
      new Room({
        serverUrl: `ws://127.0.0.1:${server.port}`,
        roomId: "smoke-room",
        userId: "alice",
        displayName: "Alice",
        WebSocket: WebSocket as any,
        reconnect: false,
      })
    );

    const room2 = track(
      new Room({
        serverUrl: `ws://127.0.0.1:${server.port}`,
        roomId: "smoke-room",
        userId: "bob",
        displayName: "Bob",
        WebSocket: WebSocket as any,
        reconnect: false,
      })
    );

    room1.connect();
    await waitForStatus(room1, "connected");

    room2.connect();
    await waitForStatus(room2, "connected");

    await waitForPresence(room1, 2);
    await waitForPresence(room2, 2);

    expect(room1.getOthers()).toHaveLength(1);
    expect(room1.getOthers()[0].userId).toBe("bob");
    expect(room2.getOthers()).toHaveLength(1);
    expect(room2.getOthers()[0].userId).toBe("alice");
  });
});
