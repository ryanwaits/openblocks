# Cursor Follow Architecture

Figma-style "follow user" — mirror another user's viewport so you see exactly what they see. The SDK provides `useFollowUser` for follow logic, and viewport data rides on the cursor wire protocol.

## Layer Overview

```
┌─────────────────────────────────────────────────────┐
│  @waits/lively-types                            │
│  CursorData { x, y, viewportPos?, viewportScale? }  │
│  ClientCursorMessage (client→server, no user meta)   │
└──────────────────────┬──────────────────────────────┘
                       │
    ┌──────────────────┼──────────────────┐
    ▼                  ▼                  ▼
┌──────────┐   ┌────────────┐   ┌──────────────┐
│  client   │   │   server   │   │    react     │
│  Room     │   │  broadcast │   │  useCursors  │
│  class    │──▶│  + enrich  │──▶│  useUpdate   │
└──────────┘   └────────────┘   │  Cursor      │
                                │  useFollow   │
                                │  User        │
                                └──────────────┘
                                       │
                        ┌──────────────┘
                        ▼
              ┌─────────────────────┐
              │  App layer (example) │
              │  useBoardMutations  │
              │  OnlineUsers UI     │
              └─────────────────────┘
```

## packages/types

Wire protocol definitions. Two key interfaces:

- **`CursorData`** — full state broadcast from server to clients: `userId`, `displayName`, `color`, `x`, `y`, `lastUpdate`, plus optional `viewportPos` and `viewportScale`.
- **`ClientCursorMessage`** — slim client→server payload: only `x`, `y`, `viewportPos?`, `viewportScale?`. Server enriches with user metadata before broadcasting.

## packages/client

**`Room.updateCursor(x, y, viewportPos?, viewportScale?)`** — public API. Throttled at 50ms default. Queues pending updates and sends via WebSocket.

**`Room.sendCursor()`** — formats a `ClientCursorMessage` and writes to the socket.

Incoming `cursor:update` messages are stored in `Room.cursors: Map<string, CursorData>` and a `"cursors"` event is emitted for React hook subscriptions. Cursors are wiped on disconnect/reconnect.

## packages/server

On `cursor:update` receipt:

1. **Validates** — x/y are finite numbers; viewportPos/viewportScale validated separately
2. **Enriches** — attaches `userId`, `displayName`, `color`, `lastUpdate` from the connection
3. **Broadcasts** — sends full `CursorData` to all other clients in the room (excludes sender)

Server is a relay + enrichment hub. Clients never send user metadata themselves.

## packages/react

Two hooks (exported from `@waits/lively-react`):

- **`useCursors()`** — subscribes to the cursors map via `useSyncExternalStore`. Equality check includes `viewportPos` and `viewportScale` fields, so viewport changes trigger re-renders.
- **`useUpdateCursor()`** — stable callback wrapping `room.updateCursor()`. Accepts optional viewport args: `(x, y, viewportPos?, viewportScale?)`.

**These four packages are the library.** Viewport data rides on the cursor wire protocol as opt-in fields.

## packages/react — `useFollowUser`

The SDK provides `useFollowUser()` as a first-class hook in `@waits/lively-react`. It handles all follow logic:

1. **Follow state** — `followUser(userId)` / `stopFollowing()`, broadcasts via presence metadata
2. **Viewport sync** — subscribes to the target's cursor data, reads `viewportPos` + `viewportScale`
3. **Smooth interpolation** — 60fps lerp loop via `requestAnimationFrame`, configurable `lerpFactor`
4. **Auto-exit** — exits when target disconnects (presence-based) or on user interaction (wheel/pointerdown)
5. **Follower tracking** — `followers: string[]` derived from others' presence metadata

See [`useFollowUser` docs](./hooks/use-follow-user.md) for full API reference.

## App layer (examples/nextjs-whiteboard)

### use-board-mutations.ts

Wraps `useUpdateCursor` to automatically attach local viewport state at send time:

```ts
const updateCursor = useCallback(
  (x: number, y: number) => {
    const { pos, scale } = useViewportStore.getState();
    updateCursorFn(x, y, pos, scale);
  },
  [updateCursorFn]
);
```

Every cursor broadcast includes current pan + zoom — no separate viewport message needed.

### online-users.tsx

Pure UI. Avatar click opens dropdown with "Follow [Name]" / "Stop following". Calls `followUser()` / `stopFollowing()` from the SDK hook.

### page.tsx (board/[id])

Wires everything together:

- **State**: `useFollowUser` hook with `onViewportChange` callback
- **Viewport broadcast**: subscribes to viewport store — re-broadcasts cursor+viewport on every pan/zoom
- **Join broadcast**: re-broadcasts current state when a new user joins so they can follow immediately
- **Exit triggers**: Escape key, badge ✕ button, dropdown "Stop following"
- **UI**: "Following X ✕" badge + blue ring on followed user's avatar

## Data Flow

```
User B moves mouse / pans / zooms
  → mutations.updateCursor(x, y) + viewport injected from store
  → Room.sendCursor() over WebSocket (throttled 50ms)
  → Server validates, enriches with user metadata, broadcasts
  → User A's Room receives, stores in cursors map, emits "cursors"
  → useCursors() triggers re-render
  → useFollowUser() reads B's viewportPos + viewportScale
  → canvasRef.setViewport(pos, scale)
  → User A sees B's exact viewport
```

## Consumer Guide

A consumer building on lively would:

1. **Send viewport data** — pass `viewportPos` and `viewportScale` when calling `useUpdateCursor()` (or wrap it like `useBoardMutations` does)
2. **Use `useFollowUser()`** — the SDK hook handles viewport sync, lerp interpolation, auto-exit, and follower tracking. Provide an `onViewportChange` callback to apply the followed user's viewport to your camera.
3. **Build follow UI** — trigger `followUser(userId)` / `stopFollowing()` from your own presence component

The library handles throttling, broadcasting, server enrichment, interpolation, and reactive subscriptions.
