# @waits/lively-server

Real-time collaboration server — WebSocket rooms, presence, and cursor relay.

## Quick Start

```ts
import { LivelyServer } from "@waits/lively-server";

const server = new LivelyServer({ port: 1999 });
await server.start();
// Clients connect to ws://localhost:1999/rooms/{roomId}
```

## Auth

Provide a custom `AuthHandler` to authenticate WebSocket upgrades. If auth is configured, query-param `userId`/`displayName` are ignored.

```ts
const server = new LivelyServer({
  auth: {
    async authenticate(req) {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const token = url.searchParams.get("token");
      const user = await verifyToken(token);
      if (!user) return null; // rejects with 401
      return { userId: user.id, displayName: user.name };
    },
  },
});
```

Without auth, clients pass identity via query params:

```
ws://localhost:1999/rooms/my-room?userId=alice&displayName=Alice
```

## Message Handling

All messages must follow a `{ type: string, ...payload }` envelope. The server handles `cursor:update` automatically — everything else is relayed to peers and passed to `onMessage`.

```ts
const server = new LivelyServer({
  onMessage: async (roomId, senderId, message) => {
    console.log(`[${roomId}] ${senderId}:`, message);
    // Persist to database, trigger side effects, etc.
  },
});
```

## Room Events

```ts
const server = new LivelyServer({
  onJoin: (roomId, user) => {
    console.log(`${user.displayName} joined ${roomId}`);
  },
  onLeave: (roomId, user) => {
    console.log(`${user.displayName} left ${roomId}`);
  },
});
```

## External Broadcast

Push messages into a room from outside the WebSocket flow (e.g., an HTTP API handler):

```ts
server.broadcastToRoom("room-id", JSON.stringify({ type: "notify", text: "Hello" }));
```

## Server-side Storage Mutations

Mutate a room's CRDT storage from the server. Ops are collected and broadcast to all connected clients. Server mutations do **not** create undo history entries.

```ts
await server.mutateStorage("room-1", (root) => {
  root.set("serverUpdatedAt", Date.now());
});
```

Returns `false` if the room doesn't exist or storage isn't initialized.

---

## Server-side Live State

Set a live-state key from the server. Uses `"__server__"` as the userId and LWW with `Date.now()` for conflict resolution.

```ts
server.setLiveState("room-1", "status", "locked");
```

Broadcasts `state:update` to all clients. Returns `false` if the room doesn't exist.

---

## Get Room Users

Return all connected users in a room.

```ts
const users: PresenceUser[] = server.getRoomUsers("room-1");
```

Returns an empty array if the room doesn't exist.

---

## API Reference

| Export | Description |
|--------|-------------|
| `LivelyServer` | Main server class — manages rooms, connections, message routing |
| `Room` | Single room — tracks connections, provides `broadcast`/`send` |
| `RoomManager` | Room lifecycle — create, get, cleanup on disconnect |
| `ServerConfig` | Config for `LivelyServer` — port, path, auth, callbacks |
| `AuthHandler` | Interface for custom auth — `authenticate(req)` |
| `PresenceUser` | User in a room — `userId`, `displayName`, `color`, `connectedAt` |
| `CursorData` | Cursor position — `userId`, `displayName`, `color`, `x`, `y`, `lastUpdate` |
| `RoomConfig` | Room tuning — `cleanupTimeoutMs`, `maxConnections` |
| `server.mutateStorage(roomId, cb)` | Server-side CRDT mutation — runs callback against root, broadcasts ops |
| `server.setLiveState(roomId, key, value)` | Set live-state key from server — LWW with `__server__` userId |
| `server.getRoomUsers(roomId)` | Get all connected `PresenceUser[]` in a room |

## Built-in Behavior

- **Presence**: Broadcasts `{ type: "presence", users }` on every join/leave
- **Cursor relay**: `cursor:update` messages are enriched with sender info and relayed to peers (sender excluded)
- **Color assignment**: Deterministic color from userId hash — consistent across reconnects
- **Room cleanup**: Empty rooms are removed after a configurable timeout (default 30s)
