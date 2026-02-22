# Server Guide

## Overview

`@waits/lively-server` is a standalone WebSocket server for Lively. It handles room management, presence broadcasting, cursor relay, CRDT storage sync, heartbeat monitoring, live state, and connection lifecycle -- all out of the box.

Zero configuration required for basic usage. One server instance manages many rooms.

## Quick Start

```typescript
import { LivelyServer } from "@waits/lively-server";

const server = new LivelyServer();
await server.start(1234);

console.log(`Lively server listening on port ${server.port}`);

// Later...
await server.stop();
```

That's it. Clients can connect to `ws://localhost:1234/rooms/{roomId}` and rooms are created automatically on first join.

---

## `LivelyServer`

The main class. Creates an HTTP server, upgrades WebSocket connections, and manages the full room lifecycle.

### Constructor

```typescript
const server = new LivelyServer(config?: ServerConfig);
```

All configuration is optional. With no arguments, the server uses sensible defaults.

### Lifecycle

| Method | Description |
|--------|-------------|
| `start(port?: number)` | Start listening. Pass `0` for a random available port. Returns a `Promise<void>`. |
| `stop()` | Gracefully terminate all connections, close all sockets, and stop listening. Returns a `Promise<void>`. |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `port` | `number` | The port the server is listening on. Returns `-1` if not yet listening. |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `broadcastToRoom` | `(roomId: string, data: string, excludeIds?: string[]) => boolean` | Push data into a room from outside the WebSocket flow (e.g., an HTTP API endpoint). Returns `false` if the room doesn't exist. |
| `getRoomManager` | `() => RoomManager` | Access the underlying `RoomManager` for advanced room introspection. |

### Full Example

```typescript
import { LivelyServer } from "@waits/lively-server";

const server = new LivelyServer({
  path: "/rooms",
  auth: {
    async authenticate(req) {
      const token = req.headers["authorization"]?.replace("Bearer ", "");
      if (!token) return null;
      const user = await verifyToken(token);
      return { userId: user.id, displayName: user.name };
    },
  },
  roomConfig: {
    cleanupTimeoutMs: 60_000,
    maxConnections: 50,
  },
  onJoin(roomId, user) {
    console.log(`${user.displayName} joined ${roomId}`);
  },
  onLeave(roomId, user) {
    console.log(`${user.displayName} left ${roomId}`);
  },
  onMessage(roomId, senderId, message) {
    console.log(`Custom message in ${roomId}:`, message);
  },
  onStorageChange(roomId, ops) {
    console.log(`Storage changed in ${roomId}:`, ops.length, "ops");
  },
  async initialStorage(roomId) {
    // Load persisted storage from your database
    return await db.getStorageSnapshot(roomId);
  },
});

await server.start(1234);
```

---

## Server Configuration

```typescript
interface ServerConfig {
  port?: number;
  path?: string;
  auth?: AuthHandler;
  roomConfig?: RoomConfig;
  onMessage?: OnMessageHandler;
  onJoin?: OnJoinHandler;
  onLeave?: OnLeaveHandler;
  onStorageChange?: OnStorageChangeHandler;
  initialStorage?: InitialStorageHandler;
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number` | `0` (random) | Port to listen on. Can also be passed to `start()`. |
| `path` | `string` | `"/rooms"` | URL path prefix. Clients connect to `{path}/{roomId}`. |
| `auth` | `AuthHandler` | `undefined` | Authentication handler. When absent, `userId` and `displayName` are read from query params. |
| `roomConfig.cleanupTimeoutMs` | `number` | `30000` | Delay (ms) before an empty room is destroyed. |
| `roomConfig.maxConnections` | `number` | `undefined` | Max connections per room. Returns `503` when exceeded. |
| `onMessage` | `OnMessageHandler` | `undefined` | Called for custom (non-protocol) messages. |
| `onJoin` | `OnJoinHandler` | `undefined` | Called when a client connects to a room. |
| `onLeave` | `OnLeaveHandler` | `undefined` | Called when a client disconnects from a room. |
| `onStorageChange` | `OnStorageChangeHandler` | `undefined` | Called after storage ops are applied. Use for persistence. |
| `initialStorage` | `InitialStorageHandler` | `undefined` | Async function to load persisted storage when a room is first created. |

---

## Event Handlers

### `onJoin`

Called after a client successfully connects and is added to the room.

```typescript
type OnJoinHandler = (
  roomId: string,
  user: PresenceUser
) => void | Promise<void>;
```

```typescript
const server = new LivelyServer({
  onJoin(roomId, user) {
    console.log(`${user.displayName} (${user.userId}) joined room ${roomId}`);
    console.log(`Color: ${user.color}, Status: ${user.onlineStatus}`);
  },
});
```

### `onLeave`

Called after a client disconnects and is removed from the room.

```typescript
type OnLeaveHandler = (
  roomId: string,
  user: PresenceUser
) => void | Promise<void>;
```

```typescript
const server = new LivelyServer({
  onLeave(roomId, user) {
    analytics.track("room_leave", {
      roomId,
      userId: user.userId,
      duration: Date.now() - user.connectedAt,
    });
  },
});
```

### `onMessage`

Called for any message that doesn't match a built-in protocol type. The message is also relayed to all other clients in the room.

```typescript
type OnMessageHandler = (
  roomId: string,
  senderId: string,
  message: Record<string, unknown>
) => void | Promise<void>;
```

```typescript
const server = new LivelyServer({
  onMessage(roomId, senderId, message) {
    if (message.type === "ai:request") {
      handleAIRequest(roomId, senderId, message);
    }
  },
});
```

### `onStorageChange`

Called after storage operations are applied to the room's CRDT document. This is the hook for persistence.

```typescript
type OnStorageChangeHandler = (
  roomId: string,
  ops: StorageOp[]
) => void | Promise<void>;
```

```typescript
const server = new LivelyServer({
  onStorageChange(roomId, ops) {
    // Persist ops or snapshot to your database
    saveToDatabase(roomId, ops);
  },
});
```

### `initialStorage`

Called once when a room's storage is first accessed. Return a serialized CRDT to hydrate the room, or `null` for empty storage.

```typescript
type InitialStorageHandler = (
  roomId: string
) => Promise<SerializedCrdt | null>;
```

```typescript
const server = new LivelyServer({
  async initialStorage(roomId) {
    const snapshot = await db.query(
      "SELECT data FROM room_storage WHERE room_id = $1",
      [roomId]
    );
    return snapshot?.data ?? null;
  },
});
```

### Auth Handler

The `AuthHandler` interface allows you to validate connections before they join a room.

```typescript
interface AuthHandler {
  authenticate(
    req: IncomingMessage
  ): Promise<{ userId: string; displayName: string } | null>;
}
```

Return `{ userId, displayName }` to allow the connection. Return `null` or throw to reject with a `401`.

```typescript
const server = new LivelyServer({
  auth: {
    async authenticate(req) {
      const token = req.headers["authorization"]?.replace("Bearer ", "");
      if (!token) return null;

      try {
        const payload = jwt.verify(token, SECRET);
        return { userId: payload.sub, displayName: payload.name };
      } catch {
        return null;
      }
    },
  },
});
```

When no `auth` handler is provided, the server falls back to reading `userId` and `displayName` from the WebSocket URL query parameters:

```
ws://localhost:1234/rooms/my-room?userId=user_123&displayName=Alice
```

---

## Room Management

### Auto-Creation

Rooms are created automatically when the first client connects. No explicit room setup required.

### `RoomManager`

The `RoomManager` holds all active rooms and handles their lifecycle.

```typescript
const manager = server.getRoomManager();
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `getOrCreate` | `(roomId: string) => Room` | Get existing room or create a new one. Cancels any pending cleanup. |
| `get` | `(roomId: string) => Room \| undefined` | Get a room by ID. Returns `undefined` if it doesn't exist. |
| `remove` | `(roomId: string) => void` | Immediately remove a room and cancel any cleanup timer. |
| `scheduleCleanup` | `(roomId: string, timeoutMs: number) => void` | Schedule room deletion after a delay. Cancelled if a new client joins. |
| `all` | `() => IterableIterator<Room>` | Iterate over all active rooms. |
| `roomCount` | `number` (getter) | Number of active rooms. |

### Room Cleanup

When the last client leaves a room, the server schedules cleanup after `cleanupTimeoutMs` (default: 30 seconds). If a new client joins before the timer fires, cleanup is cancelled and the room stays alive with its state intact.

### `Room`

Each room tracks its connections, storage document, and live state.

| Property / Method | Type | Description |
|-------------------|------|-------------|
| `id` | `string` | Room identifier. |
| `connections` | `Map<string, Connection>` | All active connections. |
| `size` | `number` | Number of active connections. |
| `storageInitialized` | `boolean` | Whether the room's CRDT storage has been initialized. |
| `liveState` | `LiveStateStore` | Key-value store for ephemeral live state. |
| `getStorageDocument()` | `StorageDocument \| null` | Access the room's CRDT document. |
| `getUsers()` | `PresenceUser[]` | Get all connected users with current presence data. |
| `broadcast(data, excludeIds?)` | `void` | Send a message to all connections (optionally excluding some). |
| `send(connectionId, data)` | `void` | Send a message to a specific connection. |

### Example: Accessing Rooms

```typescript
const manager = server.getRoomManager();

// List all rooms
for (const room of manager.all()) {
  console.log(`Room ${room.id}: ${room.size} connections`);
}

// Get a specific room
const room = manager.get("my-room");
if (room) {
  const users = room.getUsers();
  console.log("Users:", users.map(u => u.displayName));
}

// Broadcast from outside WebSocket flow
server.broadcastToRoom("my-room", JSON.stringify({
  type: "notification",
  text: "Server restart in 5 minutes",
}));
```

---

## `Connection` Type

Each WebSocket connection is tracked with the following shape:

```typescript
interface Connection {
  ws: WebSocket;
  user: PresenceUser;
  location?: string;
  metadata?: Record<string, unknown>;
  onlineStatus: OnlineStatus;
  lastActiveAt: number;
  lastHeartbeat: number;
}
```

### `PresenceUser`

```typescript
type OnlineStatus = "online" | "away" | "offline";

interface PresenceUser {
  userId: string;
  displayName: string;
  color: string;           // Auto-assigned from a palette based on userId hash
  connectedAt: number;     // Timestamp (ms) when the user joined
  onlineStatus: OnlineStatus;
  lastActiveAt: number;    // Updated on every heartbeat and presence update
  isIdle: boolean;
  avatarUrl?: string;
  location?: string;       // App-defined location (e.g., page, tab, section)
  metadata?: Record<string, unknown>;  // Arbitrary user metadata
}
```

Colors are deterministically assigned from a fixed palette based on a hash of `userId`, so the same user always gets the same color.

---

## Real-World Use Cases

### 1. Basic Collaborative App

Minimal setup -- no auth, auto rooms, all built-in features enabled.

```typescript
import { LivelyServer } from "@waits/lively-server";

const server = new LivelyServer();
await server.start(1234);
```

Clients connect with query params:

```
ws://localhost:1234/rooms/my-doc?userId=alice&displayName=Alice
```

### 2. Authenticated Server

Validate JWT tokens before allowing connections.

```typescript
import { LivelyServer } from "@waits/lively-server";
import jwt from "jsonwebtoken";

const server = new LivelyServer({
  auth: {
    async authenticate(req) {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const token =
        req.headers["authorization"]?.replace("Bearer ", "") ||
        url.searchParams.get("token");

      if (!token) return null;

      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
          sub: string;
          name: string;
        };
        return { userId: payload.sub, displayName: payload.name };
      } catch {
        return null; // 401 Unauthorized
      }
    },
  },
});

await server.start(1234);
```

### 3. Persistent Storage

Use `onStorageChange` and `initialStorage` to persist room state across server restarts.

```typescript
import { LivelyServer } from "@waits/lively-server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Debounce helper
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  return (key: string, ...args: Parameters<T>) => {
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => { timers.delete(key); fn(...args); }, ms));
  };
}

const saveSnapshot = debounce(async (roomId: string) => {
  const room = server.getRoomManager().get(roomId);
  if (!room?.storageInitialized) return;

  const doc = room.getStorageDocument()!;
  await supabase
    .from("room_storage")
    .upsert({ room_id: roomId, data: doc.serialize(), updated_at: new Date() });
}, 1000);

const server = new LivelyServer({
  onStorageChange(roomId, _ops) {
    saveSnapshot(roomId, roomId);
  },

  async initialStorage(roomId) {
    const { data } = await supabase
      .from("room_storage")
      .select("data")
      .eq("room_id", roomId)
      .single();
    return data?.data ?? null;
  },
});

await server.start(1234);
```

### 4. Custom Message Routing

Use `onMessage` to intercept app-specific messages (e.g., AI commands, admin actions).

```typescript
import { LivelyServer } from "@waits/lively-server";

const server = new LivelyServer({
  onMessage(roomId, senderId, message) {
    switch (message.type) {
      case "ai:generate":
        // Trigger AI generation, broadcast result back
        generateWithAI(message.prompt as string).then((result) => {
          server.broadcastToRoom(
            roomId,
            JSON.stringify({ type: "ai:result", result, requestedBy: senderId })
          );
        });
        break;

      case "admin:kick":
        // Custom admin logic
        console.log(`Admin ${senderId} kicked user from ${roomId}`);
        break;
    }
  },
});

await server.start(1234);
```

Note: custom messages are automatically relayed to all other clients in the room after `onMessage` fires. If you need to suppress relay, handle it at the client layer.

### 5. Multi-Server Deployment (Conceptual)

Lively runs as a single-process server by default. For horizontal scaling, you can use the available hooks to synchronize state across instances:

- **`onStorageChange`** -- write ops to a shared store (Redis Streams, Kafka)
- **`initialStorage`** -- load the latest snapshot from the shared store
- **`broadcastToRoom`** -- push messages from a pub/sub subscriber into rooms
- **`getRoomManager`** -- inspect room state for health checks and metrics

A typical pattern: each server instance subscribes to a Redis pub/sub channel per room. When `onStorageChange` fires, publish ops to the channel. Other instances receive and apply via `broadcastToRoom`.

---

## Architecture

```
Client A ──ws──> LivelyServer ──ws──> Client B
                       |
                       |── HTTP Server (upgrade only)
                       |
                       |── WebSocket Server (noServer mode)
                       |
                       |── RoomManager
                       |     |
                       |     |── Room "doc-1"
                       |     |     |── Connections (Map<id, Connection>)
                       |     |     |── Presence (PresenceUser[])
                       |     |     |── Storage (StorageDocument / CRDT)
                       |     |     |── LiveState (LiveStateStore)
                       |     |     └── Cleanup Timer
                       |     |
                       |     |── Room "doc-2"
                       |     |     └── ...
                       |     |
                       |     └── Cleanup Timers (Map<roomId, Timer>)
                       |
                       └── Heartbeat Checker (setInterval)
```

### Connection Flow

```
1. Client opens WebSocket to /rooms/{roomId}

2. HTTP Upgrade
   ├── Parse roomId from URL path
   ├── Run auth handler (if configured)
   ├── Check maxConnections (if configured)
   └── Upgrade to WebSocket

3. Connection Established
   ├── Create Connection record (userId, color, timestamps)
   ├── Add to Room (auto-created if first join)
   ├── Broadcast presence to all in room
   ├── Send storage:init snapshot to new connection
   ├── Send state:init snapshot to new connection
   └── Fire onJoin callback

4. Messages
   ├── Built-in protocols handled automatically
   └── Unknown types → onMessage callback + relay

5. Disconnect
   ├── Remove connection from room
   ├── Fire onLeave callback
   ├── Schedule room cleanup if empty
   └── Broadcast updated presence
```

---

## Built-in Protocols

The server automatically handles these message types. They do not trigger `onMessage`.

| Protocol | Direction | Description |
|----------|-----------|-------------|
| `presence` | Server -> Client | Full user list broadcast (sent on join/leave/status change) |
| `presence:update` | Client -> Server | Update own status, idle flag, location, or metadata |
| `cursor:update` | Client -> Server -> Others | Cursor position relay (excluded from sender) |
| `storage:init` | Bidirectional | CRDT storage snapshot. Server sends on join; client can send to initialize. |
| `storage:ops` | Client -> Server -> All | CRDT operations applied to the storage document, then broadcast with clock |
| `state:init` | Server -> Client | Full live state snapshot sent on join |
| `state:update` | Client -> Server -> All | LWW key-value update with timestamp. Supports shallow merge. |
| `heartbeat` | Client -> Server | Connection health ping. Updates `lastHeartbeat` and `lastActiveAt`. |

---

## Patterns & Tips

### Stateless by Default

Room state lives in memory and is lost on restart. Use `initialStorage` + `onStorageChange` for persistence. Without them, restarting the server means all rooms start fresh.

### One Server, Many Rooms

A single `LivelyServer` instance manages all rooms. No need for room-per-process or room-per-port architectures.

### Custom Messages Pass Through

Any message with a `type` field that doesn't match a built-in protocol is passed to `onMessage` and then relayed to all other clients in the room. This means clients can define their own message types without any server-side code.

### Heartbeat Timing

| Parameter | Value |
|-----------|-------|
| Client ping interval | 30 seconds |
| Server check interval | 15 seconds |
| Timeout threshold | 45 seconds |

If a client doesn't send a `heartbeat` message within 45 seconds, the server marks them as `offline` in presence and broadcasts the update. The WebSocket connection stays open -- the client can recover by sending another heartbeat.

### Room Cleanup Grace Period

When the last client leaves, the room isn't destroyed immediately. It enters a grace period (default: 30s) before cleanup. If someone reconnects within that window, the room -- and its storage state -- survives. Configure via `roomConfig.cleanupTimeoutMs`.

### User Colors

Colors are deterministically assigned from a fixed palette of 8 colors, based on a hash of the `userId`. The same user always gets the same color, even across different rooms and server restarts.

### Broadcasting from External Sources

Use `broadcastToRoom` to push messages into a room from outside the WebSocket flow -- for example, from an HTTP API endpoint or a background job:

```typescript
// From an Express/Hono/etc. route handler
app.post("/api/rooms/:roomId/notify", (req, res) => {
  const sent = server.broadcastToRoom(
    req.params.roomId,
    JSON.stringify({ type: "notification", text: req.body.text })
  );
  res.json({ sent });
});
```

### Max Connections

Set `roomConfig.maxConnections` to cap clients per room. When the limit is hit, new WebSocket upgrades receive a `503 Service Unavailable` response.
