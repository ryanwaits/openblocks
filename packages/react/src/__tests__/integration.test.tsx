// Import ws BEFORE DOM setup to avoid browser detection
import WebSocket from "ws";
import { LivelyServer } from "@waits/lively-server";
import { LivelyClient } from "@waits/lively-client";

import "./setup";
import { describe, it, expect, afterEach } from "bun:test";

const { render, act } = await import("@testing-library/react");
const { createElement } = await import("react");
const { LivelyProvider } = await import("../client-context.js");
const { RoomProvider } = await import("../room-context.js");
const { useStorage } = await import("../use-storage.js");
const { useMutation } = await import("../use-mutation.js");

describe("Integration: React hooks + real server", () => {
  let server: LivelyServer | null = null;
  const clients: LivelyClient[] = [];

  afterEach(async () => {
    for (const c of clients) {
      for (const room of c.getRooms()) {
        c.leaveRoom(room.roomId);
      }
    }
    clients.length = 0;
    if (server) {
      await server.stop();
      server = null;
    }
  });

  function makeClient(port: number) {
    const c = new LivelyClient({
      serverUrl: `ws://127.0.0.1:${port}`,
      WebSocket: WebSocket as any,
      reconnect: false,
    });
    clients.push(c);
    return c;
  }

  it("storage loads and renders via useStorage", async () => {
    server = new LivelyServer();
    await server.start(0);
    const port = server.port;
    const client = makeClient(port);

    // Pre-join and wait for storage at SDK level
    const room = client.joinRoom("test-room", {
      userId: "u1",
      displayName: "User 1",
      initialStorage: { count: 42 },
    });
    const { root } = await room.getStorage();
    expect(root.get("count")).toBe(42);

    // Render React component that reads this storage
    let renderedCount: number | null = null;

    function Display() {
      const count = useStorage((r: any) => r.get("count"));
      renderedCount = count;
      return createElement("div", null, String(count));
    }

    const { unmount } = render(
      createElement(
        LivelyProvider,
        { client },
        createElement(
          RoomProvider,
          {
            roomId: "test-room",
            userId: "u1",
            displayName: "User 1",
            initialStorage: { count: 42 },
          },
          createElement(Display)
        )
      )
    );

    // Wait for storage context to populate
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(renderedCount).toBe(42);

    // Mutate directly and verify React re-renders
    await act(() => {
      root.set("count", 99);
    });

    expect(renderedCount).toBe(99);
    unmount();
  }, 10000);

  it("useMutation writes to storage", async () => {
    server = new LivelyServer();
    await server.start(0);
    const port = server.port;
    const client = makeClient(port);

    const room = client.joinRoom("mut-room", {
      userId: "u1",
      displayName: "User 1",
      initialStorage: { value: "hello" },
    });
    const { root } = await room.getStorage();

    let mutate: ((v: string) => void) | null = null;

    function Mutator() {
      const m = useMutation((ctx: any, v: string) => {
        ctx.storage.root.set("value", v);
      }, []);
      mutate = m;
      return null;
    }

    const { unmount } = render(
      createElement(
        LivelyProvider,
        { client },
        createElement(
          RoomProvider,
          { roomId: "mut-room", userId: "u1", displayName: "User 1" },
          createElement(Mutator)
        )
      )
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    await act(() => {
      mutate!("world");
    });

    expect(root.get("value")).toBe("world");
    unmount();
  }, 10000);
});
