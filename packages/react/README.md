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
