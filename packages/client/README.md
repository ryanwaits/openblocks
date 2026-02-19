# @waits/openblocks-client

Client SDK for OpenBlocks real-time collaboration. Framework-agnostic, works in browser and Node/Bun.

## Quick Start

```ts
import { OpenBlocksClient } from "@waits/openblocks-client";

const client = new OpenBlocksClient({
  serverUrl: "ws://localhost:3000",
});

const room = client.joinRoom("my-room", {
  userId: "user-123",
  displayName: "Alice",
});

room.subscribe("presence", (users) => {
  console.log("Online:", users);
});

room.subscribe("cursors", (cursors) => {
  console.log("Cursors:", cursors);
});

room.subscribe("message", (msg) => {
  console.log("Message:", msg);
});
```

## Node/Bun Usage

Pass `ws` as the WebSocket constructor:

```ts
import WebSocket from "ws";
import { OpenBlocksClient } from "@waits/openblocks-client";

const client = new OpenBlocksClient({
  serverUrl: "ws://localhost:3000",
  WebSocket: WebSocket as any,
});
```

## Presence

```ts
const room = client.joinRoom("room-1", { userId: "alice", displayName: "Alice" });

room.subscribe("presence", (users) => {
  const self = room.getSelf();
  const others = room.getOthers();
});
```

## Cursors

```ts
// Send cursor position (throttled, default 50ms)
room.updateCursor(mouseX, mouseY);

// Receive cursor updates from others
room.subscribe("cursors", (cursors) => {
  for (const [userId, cursor] of cursors) {
    // cursor: { userId, displayName, color, x, y, lastUpdate }
  }
});
```

## Custom Messages

```ts
room.send({ type: "object:create", shape: "rect", x: 100, y: 200 });

room.subscribe("message", (msg) => {
  if (msg.type === "object:create") { /* ... */ }
});
```

## Batch

```ts
room.batch(() => {
  room.send({ type: "a", value: 1 });
  room.send({ type: "b", value: 2 });
  // Messages held until batch ends, then sent individually
});
```

## API Reference

| Class / Function | Description |
|------------------|-------------|
| `OpenBlocksClient(config)` | Entry point. Manages room connections. |
| `client.joinRoom(roomId, opts)` | Join a room, auto-connects. Returns `Room`. |
| `client.leaveRoom(roomId)` | Disconnect and remove room. |
| `client.getRoom(roomId)` | Get room by ID or `undefined`. |
| `client.getRooms()` | All active rooms. |
| `Room` | Single room connection with presence, cursors, messaging. |
| `room.connect()` / `room.disconnect()` | Manual lifecycle control. |
| `room.getStatus()` | `"connecting" \| "connected" \| "reconnecting" \| "disconnected"` |
| `room.getSelf()` | Current user's `PresenceUser` or `null`. |
| `room.getPresence()` | All connected users. |
| `room.getOthers()` | All users except self. |
| `room.getCursors()` | `Map<string, CursorData>` of all cursors. |
| `room.updateCursor(x, y)` | Send throttled cursor update. |
| `room.send(msg)` | Send custom message to room. |
| `room.batch(fn)` | Queue sends during `fn`, flush after. |
| `room.subscribe(event, cb)` | Subscribe to events. Returns unsubscribe fn. |
| `ConnectionManager` | Low-level WebSocket state machine with reconnect. |
| `throttle(fn, ms)` | Trailing-edge throttle utility. |
