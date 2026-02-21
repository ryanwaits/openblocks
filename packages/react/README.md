# @waits/openblocks-react

React hooks and providers for OpenBlocks real-time collaboration.

## Install

```sh
bun add @waits/openblocks-react
```

Requires `react >= 18` as a peer dependency.

---

## Setup

```tsx
import { OpenBlocksClient } from "@waits/openblocks-client";
import { OpenBlocksProvider, RoomProvider } from "@waits/openblocks-react";

// Create once at module level — not inside a component
const client = new OpenBlocksClient({ serverUrl: "ws://localhost:2001" });

function App() {
  return (
    <OpenBlocksProvider client={client}>
      <RoomProvider
        roomId="my-room"
        userId={currentUser.id}
        displayName={currentUser.name}
        initialStorage={{ count: 0 }}
      >
        <Canvas />
      </RoomProvider>
    </OpenBlocksProvider>
  );
}
```

---

## Providers

### `<OpenBlocksProvider>`

Makes a shared `OpenBlocksClient` available to all nested hooks. Must wrap `<RoomProvider>`.

```ts
interface OpenBlocksProviderProps {
  client: OpenBlocksClient;
  children: ReactNode;
}
```

### `<RoomProvider>`

Joins a room and exposes it to child hooks. Creates the room synchronously on first render; leaves on unmount.

```ts
interface RoomProviderProps {
  roomId: string;
  userId: string;
  displayName: string;
  initialStorage?: Record<string, unknown>; // written on first connect if storage is empty
  cursorThrottleMs?: number;                // default: 50
  inactivityTime?: number;                  // ms before marking user as away
  offlineInactivityTime?: number;           // ms before marking user as offline
  location?: string;                        // location identifier for this client
  presenceMetadata?: Record<string, unknown>; // arbitrary presence metadata
  token?: string;                           // auth token sent as query param on WS connect
  children: ReactNode;
}
```

---

## Hooks

### `useStatus`

```ts
function useStatus(): "connecting" | "connected" | "reconnecting" | "disconnected"
```

Returns the current WebSocket connection status. Re-renders on every status change.

```tsx
const status = useStatus();
if (status !== "connected") return <p>{status}</p>;
```

---

### `useLostConnectionListener`

```ts
function useLostConnectionListener(callback: () => void): void
```

Fires `callback` once when the connection drops from `"connected"` to `"reconnecting"`. Does not fire on intentional disconnect. Callback is stored in a ref — no need to memoize.

```tsx
useLostConnectionListener(() => toast("Connection lost, reconnecting…"));
```

---

### `useSelf`

```ts
function useSelf(): PresenceUser | null
```

Returns the current user's own presence data. Returns `null` before the first presence broadcast from the server.

```ts
interface PresenceUser {
  userId: string;
  displayName: string;
  color: string;
}
```

```tsx
const self = useSelf();
if (!self) return null;
return <Avatar name={self.displayName} color={self.color} />;
```

---

### `useOthers`

```ts
function useOthers(): PresenceUser[]
```

Returns all other users currently in the room. Re-renders only when the list changes (shallow-equal check).

```tsx
const others = useOthers();
return <ul>{others.map(u => <li key={u.userId}>{u.displayName}</li>)}</ul>;
```

---

### `useOther`

```ts
function useOther<T = PresenceUser>(
  userId: string,
  selector?: (u: PresenceUser) => T
): T | null
```

Returns a single other user by `userId`, optionally transformed by `selector`. Returns `null` if the user is not in the room.

```tsx
const name = useOther("user-abc", u => u.displayName); // string | null
const user = useOther("user-abc");                      // PresenceUser | null
```

---

### `useOthersMapped`

```ts
function useOthersMapped<T>(selector: (user: PresenceUser) => T): T[]
```

Maps all other users through `selector`. Re-renders only when the mapped output changes — more efficient than `useOthers` + a manual map when you only need a slice of each user.

```tsx
const names = useOthersMapped(u => u.displayName);
```

---

### `useStorage`

```ts
function useStorage<T>(selector: (root: LiveObject) => T): T | null
```

Reads a value from shared CRDT storage via a selector. Returns `null` while storage is loading (before the first `storage:init` from the server). Re-renders only when the selected value changes (shallow-equal check).

```tsx
const count = useStorage(root => root.get("count") as number);
if (count === null) return <p>Loading…</p>;
return <p>Count: {count}</p>;
```

---

### `useMutation`

```ts
function useMutation<Args extends unknown[], R>(
  callback: (ctx: { storage: { root: LiveObject } }, ...args: Args) => R,
  deps: unknown[]
): (...args: Args) => R
```

Returns a stable callback that mutates shared storage inside a `room.batch()`. Throws if called before storage has loaded — wait until `useStorage` returns a non-null value before triggering mutations.

```tsx
const increment = useMutation(({ storage }) => {
  const count = storage.root.get("count") as number;
  storage.root.set("count", count + 1);
}, []);

// With arguments:
const rename = useMutation(({ storage }, name: string) => {
  storage.root.set("title", name);
}, []);
```

---

### `useCursors`

```ts
function useCursors(): Map<string, CursorData>
```

Returns a `Map<userId, CursorData>` of all cursor positions in the room (including the current user). Re-renders only when positions actually change.

```ts
interface CursorData { x: number; y: number }
```

```tsx
const cursors = useCursors();
return (
  <>
    {[...cursors.entries()].map(([userId, pos]) => (
      <Cursor key={userId} x={pos.x} y={pos.y} />
    ))}
  </>
);
```

---

### `useUpdateCursor`

```ts
function useUpdateCursor(): (x: number, y: number) => void
```

Returns a stable function to broadcast the current user's cursor position. Coordinates should be relative to the container you want to track.

```tsx
const updateCursor = useUpdateCursor();
<div onMouseMove={e => updateCursor(e.clientX, e.clientY)} />
```

---

### `useBroadcastEvent`

```ts
function useBroadcastEvent<T extends { type: string }>(): (event: T) => void
```

Returns a stable function to broadcast a custom ephemeral event to all other users in the room. Events are not persisted. Pair with `useEventListener` on the receiving end.

```tsx
const broadcast = useBroadcastEvent<{ type: "confetti" }>();
<button onClick={() => broadcast({ type: "confetti" })}>Celebrate</button>
```

---

### `useEventListener`

```ts
function useEventListener<T extends Record<string, unknown>>(
  callback: (event: T) => void
): void
```

Subscribes to custom events broadcast by other users via `useBroadcastEvent`. The callback is stored in a ref and does not need to be memoized or included in dependency arrays.

```tsx
useEventListener<{ type: "confetti" }>(event => {
  if (event.type === "confetti") triggerConfetti();
});
```

---

### `useOthersUserIds`

```ts
function useOthersUserIds(): string[]
```

Returns a sorted array of userIds for all other users in the room. Only re-renders on join/leave, not on presence data changes. More efficient than `useOthers` when you only need identity.

```tsx
const ids = useOthersUserIds();
return <>{ids.map(id => <Cursor key={id} userId={id} />)}</>;
```

---

### `useMyPresence`

```ts
function useMyPresence(): [PresenceUser | null, (data: Partial<PresenceUpdatePayload>) => void]
```

Convenience wrapper combining `useSelf()` and `useUpdateMyPresence()` into a single `[self, update]` tuple.

```tsx
const [me, updatePresence] = useMyPresence();
if (me) updatePresence({ location: "settings" });
```

---

### `useUpdateMyPresence`

```ts
function useUpdateMyPresence(): (data: Partial<PresenceUpdatePayload>) => void
```

Returns a stable function to update the current user's presence data (location, metadata, onlineStatus).

```tsx
const updatePresence = useUpdateMyPresence();
updatePresence({ location: "page-1" });
```

---

### `useOthersListener`

```ts
function useOthersListener(callback: (event: OthersEvent) => void): void
```

Fires a callback whenever another user enters, leaves, or updates their presence. The callback receives a discriminated union: `{ type: "enter" | "leave" | "update"; user: PresenceUser; others: PresenceUser[] }`. Uses callbackRef pattern -- no stale closures.

```tsx
useOthersListener(event => {
  if (event.type === "enter") toast(`${event.user.displayName} joined`);
});
```

---

### `useBatch`

```ts
function useBatch(): <T>(fn: () => T) => T
```

Returns a stable function that wraps its callback in `room.batch()`. Batched mutations combine into a single history entry and one network message.

```tsx
const batch = useBatch();
batch(() => {
  root.set("x", 1);
  root.set("y", 2);
});
```

---

### `useObject`

```ts
function useObject<T extends Record<string, unknown>>(key: string): LiveObject<T> | null
```

Returns a `LiveObject<T>` stored at the given top-level storage key, or `null` while loading.

```tsx
const settings = useObject<{ theme: string }>("settings");
// Read: settings?.get("theme")
```

---

### `useMap`

```ts
function useMap<V>(key: string): LiveMap<string, V> | null
```

Returns a `LiveMap<string, V>` stored at the given top-level storage key, or `null` while loading.

```tsx
const users = useMap<UserData>("users");
// Read: users?.get("u1")
```

---

### `useList`

```ts
function useList<T>(key: string): LiveList<T> | null
```

Returns a `LiveList<T>` stored at the given top-level storage key, or `null` while loading.

```tsx
const items = useList<string>("items");
// Read: items?.toArray()
```

---

### `useErrorListener`

```ts
function useErrorListener(callback: (error: Error) => void): void
```

Fires a callback when a WebSocket-level error occurs on the room connection. Uses callbackRef pattern.

```tsx
useErrorListener(err => console.error("Room error:", err.message));
```

---

### `useSyncStatus`

```ts
function useSyncStatus(): "synchronized" | "synchronizing" | "not-synchronized"
```

Returns a high-level sync status derived from connection state and storage loading. `"synchronized"` = connected + storage loaded, `"synchronizing"` = connecting/loading, `"not-synchronized"` = disconnected.

```tsx
const sync = useSyncStatus();
if (sync === "not-synchronized") return <OfflineBanner />;
```

---

### `useOthersOnLocation`

```ts
function useOthersOnLocation(locationId: string): PresenceUser[]
```

Returns other users at a specific location. Subscribes to presence and filters by `location` field.

```tsx
const viewers = useOthersOnLocation("page-1");
return <p>{viewers.length} others on this page</p>;
```

---

### `usePresenceEvent`

```ts
function usePresenceEvent(
  event: "stateChange",
  callback: (user: PresenceUser, prevStatus: string, newStatus: string) => void
): void
```

Fires callback when another user's `onlineStatus` changes. Useful for detecting away/offline transitions.

```tsx
usePresenceEvent("stateChange", (user, prev, next) => {
  console.log(`${user.displayName}: ${prev} → ${next}`);
});
```

---

### `useLiveState`

```ts
function useLiveState<T>(
  key: string,
  initialValue: T,
  opts?: { syncDuration?: number }
): [T, (value: T | ((prev: T) => T)) => void]
```

Like `useState` but shared across all room participants. Ephemeral key-value state synced via the room. `syncDuration` controls debounce in ms (default: 50).

```tsx
const [color, setColor] = useLiveState("bgColor", "#fff");
<button onClick={() => setColor("#f00")}>Red</button>
```

---

### `useLiveStateData`

```ts
function useLiveStateData<T>(key: string): T | undefined
```

Read-only subscription to a live state key. Returns `undefined` if no value has been set.

```tsx
const color = useLiveStateData<string>("bgColor");
```

---

### `useSetLiveState`

```ts
function useSetLiveState<T>(key: string): (value: T, opts?: { merge?: boolean }) => void
```

Returns a stable setter function for a live state key. Write-only counterpart to `useLiveStateData`.

```tsx
const setColor = useSetLiveState<string>("bgColor");
setColor("#0f0");
```

---

### `useUndo`

```ts
function useUndo(): () => void
```

Returns a stable callback that triggers undo on the room's storage history.

```tsx
const undo = useUndo();
<button onClick={undo}>Undo</button>
```

---

### `useRedo`

```ts
function useRedo(): () => void
```

Returns a stable callback that triggers redo on the room's storage history.

```tsx
const redo = useRedo();
<button onClick={redo}>Redo</button>
```

---

### `useCanUndo` / `useCanRedo`

```ts
function useCanUndo(): boolean
function useCanRedo(): boolean
```

Returns whether undo/redo is available. Re-renders when this changes.

```tsx
const canUndo = useCanUndo();
<button disabled={!canUndo} onClick={undo}>Undo</button>
```

---

### `useHistory`

```ts
function useHistory(): {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}
```

Combined hook returning all undo/redo utilities in a single object.

```tsx
const { undo, redo, canUndo, canRedo } = useHistory();
```

---

### `useFollowUser`

```ts
function useFollowUser(opts?: UseFollowUserOptions): UseFollowUserReturn
```

Follow mode hook. Tracks follow relationships via presence metadata (visible to all clients). Auto-exits follow mode when the target disconnects or the user interacts (wheel/pointerdown).

```ts
interface UseFollowUserOptions {
  onViewportChange?: (pos: { x: number; y: number }, scale: number) => void;
  exitOnInteraction?: boolean; // default: true
  onAutoExit?: (reason: "disconnected" | "interaction") => void;
}

interface UseFollowUserReturn {
  followingUserId: string | null;
  followUser: (userId: string) => void;
  stopFollowing: () => void;
  followers: string[];       // userIds following you
  isBeingFollowed: boolean;
}
```

```tsx
const { followingUserId, followUser, stopFollowing, followers } = useFollowUser({
  onViewportChange: (pos, scale) => panTo(pos, scale),
  onAutoExit: (reason) => toast(`Stopped following (${reason})`),
});

return (
  <>
    {others.map(u => (
      <button key={u.userId} onClick={() => followUser(u.userId)}>
        Follow {u.displayName}
      </button>
    ))}
    {followingUserId && <button onClick={stopFollowing}>Stop following</button>}
  </>
);
```

---

### `createRoomContext`

```ts
function createRoomContext<
  TPresence extends Record<string, unknown>,
  TStorage extends Record<string, unknown>,
>(): { RoomProvider, useStorage, useSelf, useMyPresence, ... }
```

Factory that returns typed versions of all hooks scoped to your app's presence and storage types. Zero runtime overhead -- just narrows generics.

```tsx
type Presence = { cursor: { x: number; y: number } | null };
type Storage = { count: number; items: LiveList<string> };

const {
  RoomProvider,
  useStorage,
  useSelf,
  useMyPresence,
} = createRoomContext<Presence, Storage>();
```

---

### `ClientSideSuspense`

```tsx
<ClientSideSuspense fallback={<Spinner />}>
  {() => <CollaborativeEditor />}
</ClientSideSuspense>
```

SSR-safe Suspense wrapper. Renders `fallback` during SSR and the initial client render, then renders `children()` inside `<Suspense>`. `children` is a render function so hooks inside are not evaluated during SSR.

```ts
interface ClientSideSuspenseProps {
  children: () => ReactNode;
  fallback: ReactNode;
}
```

---

## Suspense entry point

Import from `@waits/openblocks-react/suspense` to use `useStorageSuspense` — a variant of `useStorage` that throws a promise instead of returning `null` while loading. Wrap the consuming component in `<Suspense>`.

```tsx
import { useStorageSuspense } from "@waits/openblocks-react/suspense";

// Inside a <Suspense fallback={<p>Loading…</p>}> boundary:
function Canvas() {
  const count = useStorageSuspense(root => root.get("count") as number);
  // count is always T here — never null
  return <p>Count: {count}</p>;
}
```

The suspense entry re-exports all other hooks for single-import convenience — you do not need to import from both entry points.

> `useStorageSuspense` cannot be used during SSR. It will throw if a server snapshot is requested.

---

## CRDT types

`LiveObject`, `LiveMap`, and `LiveList` are re-exported from this package for convenience:

```ts
import { LiveObject, LiveMap, LiveList } from "@waits/openblocks-react";
```
