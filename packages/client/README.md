# @waits/lively-client

Client SDK for Lively real-time collaboration. Framework-agnostic, works in browser and Node/Bun.

## Quick Start

```ts
import { LivelyClient } from "@waits/lively-client";

const client = new LivelyClient({
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
import { LivelyClient } from "@waits/lively-client";

const client = new LivelyClient({
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

---

## Follow API

Track which user another user is following. Stored in presence metadata.

```ts
// Follow a user
room.followUser("bob");

// Check who you're following
room.getFollowing(); // "bob"

// Get users following you
room.getFollowers(); // ["charlie", "dave"]

// Stop following
room.stopFollowing();
```

---

## Auth Token

Pass a `token` option to authenticate the WebSocket connection. Appended as `&token=...` query param. Used with server-side `AuthHandler`.

```ts
const room = client.joinRoom("room-1", {
  userId: "alice",
  displayName: "Alice",
  token: "jwt-token-here",
});
```

---

## Storage (CRDT)

Persistent CRDT storage with `LiveObject`, `LiveMap`, and `LiveList`.

```ts
const { root } = await room.getStorage();

// Read
root.get("title"); // "Hello"

// Mutate — auto-synced to server and other clients
root.set("title", "Updated");

// Subscribe to a CRDT node
const unsub = room.subscribe(root, () => {
  console.log("root changed:", root.toObject());
});

// Deep subscribe (fires on nested changes too)
room.subscribe(root, () => { /* ... */ }, { isDeep: true });
```

Provide `initialStorage` to seed an empty room:

```ts
const room = client.joinRoom("room-1", {
  userId: "alice",
  displayName: "Alice",
  initialStorage: { title: "Untitled", items: {} },
});
```

---

## Undo / Redo

Undo/redo for storage mutations. Works with `batch()` for grouped operations.

```ts
room.undo();
room.redo();

// Access the HistoryManager directly
const history = room.getHistory();
history?.canUndo(); // boolean
history?.canRedo(); // boolean
```

---

## Live State

Ephemeral key-value state shared across the room (LWW, not persisted like storage).

```ts
// Set a value
room.setLiveState("mode", "drawing");

// Read
room.getLiveState("mode"); // "drawing"

// Get all states
room.getAllLiveStates(); // Map<string, { value, timestamp, userId }>

// Subscribe to changes on a specific key
const unsub = room.subscribeLiveState("mode", () => {
  console.log("mode changed:", room.getLiveState("mode"));
});
```

---

## Presence Updates

Update presence metadata, location, and online status beyond the initial join.

```ts
room.updatePresence({
  location: "page-2",
  metadata: { color: "red" },
  onlineStatus: "away", // "online" | "away" | "offline"
});

// Get others on a specific location
const peers = room.getOthersOnLocation("page-2");
```

Activity tracking is automatic — users are marked `"away"` after inactivity and `"offline"` after extended inactivity. Configure thresholds via `JoinRoomOptions`:

```ts
const room = client.joinRoom("room-1", {
  userId: "alice",
  displayName: "Alice",
  inactivityTime: 60000,       // ms before "away" (default 60s)
  offlineInactivityTime: 300000, // ms before "offline" (default 5min)
});
```

---

## Error & Status Events

```ts
room.subscribe("status", (status) => {
  // "connecting" | "connected" | "reconnecting" | "disconnected"
});

room.subscribe("error", (err) => {
  console.error(err);
});
```

---

## API Reference

| Class / Function | Description |
|------------------|-------------|
| `LivelyClient(config)` | Entry point. Manages room connections. |
| `client.joinRoom(roomId, opts)` | Join a room, auto-connects. Returns `Room`. |
| `client.leaveRoom(roomId)` | Disconnect and remove room. |
| `client.getRoom(roomId)` | Get room by ID or `undefined`. |
| `client.getRooms()` | All active rooms. |
| `Room` | Single room connection with presence, cursors, messaging, storage. |
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
| `room.subscribe(crdt, cb, opts?)` | Subscribe to CRDT node changes. `{ isDeep: true }` for nested. |
| `room.getStorage()` | Returns `Promise<{ root: LiveObject }>`. |
| `room.followUser(userId)` | Follow another user (stores in presence metadata). |
| `room.stopFollowing()` | Stop following. |
| `room.getFollowing()` | Get followed user ID or `null`. |
| `room.getFollowers()` | Get user IDs of followers. |
| `room.undo()` | Undo last storage mutation. |
| `room.redo()` | Redo last undone mutation. |
| `room.getHistory()` | Get `HistoryManager` or `null`. |
| `room.setLiveState(key, value)` | Set ephemeral shared state. |
| `room.getLiveState(key)` | Get live state value. |
| `room.getAllLiveStates()` | All live states as `Map`. |
| `room.subscribeLiveState(key, cb)` | Subscribe to a live state key. Returns unsubscribe fn. |
| `room.updatePresence(data)` | Update location, metadata, or online status. |
| `room.getOthersOnLocation(id)` | Get others at a specific location. |
| `ConnectionManager` | Low-level WebSocket state machine with reconnect. |
| `ActivityTracker` | Automatic online/away/offline status tracking. |
| `throttle(fn, ms)` | Trailing-edge throttle utility. |
