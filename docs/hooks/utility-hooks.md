# Utility Hooks

Small, focused hooks for batching mutations, guarding against missing providers, and reacting to connection errors. These are the glue hooks -- they don't own state themselves but make the rest of the SDK safer and more ergonomic to use.

---

## API Reference

| Hook | Signature | Description |
|------|-----------|-------------|
| `useBatch` | `() => <T>(fn: () => T) => T` | Returns a stable function that wraps its callback in `room.batch()`. Groups mutations into a single history entry and a single network message. |
| `useIsInsideRoom` | `() => boolean` | Returns `true` when called inside a `<RoomProvider>`, `false` otherwise. For conditional rendering and guard logic. |
| `useErrorListener` | `(callback: (error: Error) => void) => void` | Fires the callback on WebSocket-level errors. Uses the callbackRef pattern -- no stale closures. |

All hooks are available from `@waits/openblocks-react`.

```ts
import { useBatch, useIsInsideRoom, useErrorListener } from "@waits/openblocks-react";
```

---

## `useBatch`

Returns a **stable** (memoized via `useCallback`) function that wraps any callback in `room.batch()`. Every CRDT mutation inside the batch is combined into:

1. **One network message** -- all ops are sent together instead of individually.
2. **One history entry** -- pressing undo reverses the entire batch, not each mutation separately.

### Signature

```ts
function useBatch(): <T>(fn: () => T) => T
```

| Param | Type | Description |
|-------|------|-------------|
| **Returns** | `<T>(fn: () => T) => T` | Stable function. Pass it a callback containing CRDT mutations. Returns whatever the callback returns. |

> **When to use `useBatch` vs `useMutation`:** `useMutation` already wraps your callback in `room.batch()` automatically. Use `useBatch` when you need batching outside of `useMutation` -- for example, when orchestrating multiple existing mutation functions into a single undo step, or when working with raw CRDT references outside of React's render cycle.

### Example

```tsx
import { useBatch } from "@waits/openblocks-react";

function Canvas() {
  const batch = useBatch();

  function handleDragEnd(id: string, x: number, y: number) {
    batch(() => {
      shape.set("x", x);
      shape.set("y", y);
      shape.set("lastMovedAt", Date.now());
    });
    // All three .set() calls = one undo step + one network message
  }

  return <div onPointerUp={(e) => handleDragEnd(selectedId, e.clientX, e.clientY)} />;
}
```

---

## `useIsInsideRoom`

Returns `true` when the component is rendered inside a `<RoomProvider>`, `false` otherwise. This is a simple `useContext` check against `RoomContext` -- it never throws, unlike `useRoom()` which throws when called outside a provider.

### Signature

```ts
function useIsInsideRoom(): boolean
```

| Param | Type | Description |
|-------|------|-------------|
| **Returns** | `boolean` | `true` if a `<RoomProvider>` ancestor exists, `false` otherwise. |

### Example

```tsx
import { useIsInsideRoom } from "@waits/openblocks-react";

function CollaborationIndicator() {
  const isInRoom = useIsInsideRoom();

  if (!isInRoom) {
    return <span className="text-muted-foreground">Offline</span>;
  }

  return <OnlineUserList />;
}
```

---

## `useErrorListener`

Subscribes to WebSocket-level errors on the room connection. The callback is stored in a ref internally (callbackRef pattern), so you never need to memoize it -- the hook always calls the latest version. The subscription is created on mount and torn down on unmount.

### Signature

```ts
function useErrorListener(callback: (error: Error) => void): void
```

| Param | Type | Description |
|-------|------|-------------|
| `callback` | `(error: Error) => void` | Called whenever a WebSocket error fires on the room connection. |

### Behavior

- Uses `room.subscribe("error", ...)` under the hood.
- The callbackRef pattern means no stale closures -- if your callback references component state, it always sees the latest value.
- Cleans up the subscription on unmount. No memory leaks.

### Example

```tsx
import { useErrorListener } from "@waits/openblocks-react";

function ErrorLogger() {
  useErrorListener((error) => {
    console.error("Room connection error:", error.message);
  });

  return null;
}
```

---

## Real-World Use Cases

### 1. Batch multiple storage mutations in one undo step

Moving a shape involves setting `x`, `y`, and possibly `rotation`. Without batching, each field is a separate undo step -- the user presses Cmd+Z three times to undo one drag. `useBatch` collapses them into a single entry.

```tsx
import { useBatch, useStorage } from "@waits/openblocks-react";
import type { LiveObject, LiveMap } from "@waits/openblocks-react";

function ShapeCanvas() {
  const batch = useBatch();
  const shapes = useStorage((root) => {
    const map = root.get("shapes") as LiveMap<LiveObject>;
    const items: { id: string; x: number; y: number; rotation: number }[] = [];
    map.forEach((shape, id) => {
      items.push({
        id,
        x: shape.get("x") as number,
        y: shape.get("y") as number,
        rotation: shape.get("rotation") as number,
      });
    });
    return items;
  });

  function handleDragEnd(shapeRef: LiveObject, x: number, y: number, rotation: number) {
    batch(() => {
      shapeRef.set("x", x);
      shapeRef.set("y", y);
      shapeRef.set("rotation", rotation);
    });
  }

  if (shapes === null) return <div className="p-4 text-muted-foreground">Loading...</div>;

  return (
    <div className="relative h-screen w-full bg-gray-50">
      {shapes.map((s) => (
        <div
          key={s.id}
          className="absolute h-16 w-16 cursor-grab rounded-lg bg-blue-500 shadow-md"
          style={{ left: s.x, top: s.y, transform: `rotate(${s.rotation}deg)` }}
        />
      ))}
    </div>
  );
}
```

---

### 2. Conditional rendering based on whether inside a room

Components that can render both inside and outside a `<RoomProvider>` -- like a shared header -- use `useIsInsideRoom` to decide whether to show collaboration features.

```tsx
import { useIsInsideRoom, useOthers, useSelf } from "@waits/openblocks-react";

function Header() {
  const isInRoom = useIsInsideRoom();

  return (
    <header className="flex items-center justify-between border-b px-4 py-2">
      <h1 className="text-lg font-semibold">My App</h1>
      {isInRoom ? <CollaboratorAvatars /> : <span className="text-sm text-muted-foreground">Not connected</span>}
    </header>
  );
}

function CollaboratorAvatars() {
  const others = useOthers();
  const self = useSelf();

  return (
    <div className="flex -space-x-2">
      {self && (
        <div
          className="h-8 w-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium text-white"
          style={{ backgroundColor: self.color }}
          title={`${self.displayName} (you)`}
        >
          {self.displayName[0]}
        </div>
      )}
      {others.map((user) => (
        <div
          key={user.userId}
          className="h-8 w-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium text-white"
          style={{ backgroundColor: user.color }}
          title={user.displayName}
        >
          {user.displayName[0]}
        </div>
      ))}
    </div>
  );
}
```

---

### 3. Error toast / logging with `useErrorListener`

Show a toast notification when the WebSocket connection encounters an error. Log it to an external service for observability.

```tsx
import { useErrorListener } from "@waits/openblocks-react";
import { toast } from "sonner";

function ConnectionErrorHandler() {
  useErrorListener((error) => {
    toast.error("Connection issue", {
      description: error.message,
      duration: 5000,
    });

    // Send to logging service
    fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: "error",
        source: "openblocks",
        message: error.message,
        timestamp: Date.now(),
      }),
    }).catch(() => {
      // Logging failure is non-critical
    });
  });

  return null;
}
```

Mount it once at the top of your room tree:

```tsx
<RoomProvider roomId="my-room" userId={userId} displayName={displayName}>
  <ConnectionErrorHandler />
  <App />
</RoomProvider>
```

---

### 4. Combining `useBatch` + `useMutation` for atomic multi-field updates

When you need to call multiple existing `useMutation` hooks as a single atomic operation, wrap them in `useBatch`. Each `useMutation` callback is already batched internally, but calling two separate mutations produces two undo steps. `useBatch` collapses them.

```tsx
import { useBatch, useMutation, useStorage } from "@waits/openblocks-react";
import type { LiveObject, LiveMap } from "@waits/openblocks-react";

function KanbanBoard() {
  const batch = useBatch();

  const archiveCard = useMutation(({ storage }, cardId: string) => {
    const cards = storage.root.get("cards") as LiveMap<LiveObject>;
    const card = cards.get(cardId) as LiveObject;
    card.set("archived", true);
    card.set("archivedAt", Date.now());
  }, []);

  const updateColumnCount = useMutation(({ storage }, columnId: string, delta: number) => {
    const columns = storage.root.get("columns") as LiveMap<LiveObject>;
    const column = columns.get(columnId) as LiveObject;
    const current = column.get("count") as number;
    column.set("count", current + delta);
  }, []);

  function handleArchive(cardId: string, columnId: string) {
    // Both mutations become ONE undo step + ONE network message
    batch(() => {
      archiveCard(cardId);
      updateColumnCount(columnId, -1);
    });
  }

  return (
    <div className="flex gap-4 p-6">
      {/* Column rendering */}
      <button
        className="rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
        onClick={() => handleArchive("card-1", "col-todo")}
      >
        Archive
      </button>
    </div>
  );
}
```

> Without the outer `batch()`, pressing undo would only reverse `updateColumnCount`, leaving the card archived but the count wrong. With `batch()`, both operations revert together.

---

### 5. Graceful error handling with retry UI

Combine `useErrorListener` with component state to show an inline retry banner when the connection encounters errors.

```tsx
import { useErrorListener } from "@waits/openblocks-react";
import { useRoom } from "@waits/openblocks-react";
import { useState, useCallback } from "react";

function RoomWithErrorBoundary({ children }: { children: React.ReactNode }) {
  const [lastError, setLastError] = useState<Error | null>(null);
  const room = useRoom();

  useErrorListener((error) => {
    setLastError(error);
  });

  const handleRetry = useCallback(() => {
    setLastError(null);
    room.connect();
  }, [room]);

  return (
    <div className="relative">
      {lastError && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <p className="text-sm text-red-800">
              Connection error: {lastError.message}
            </p>
          </div>
          <button
            onClick={handleRetry}
            className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}
      {children}
    </div>
  );
}
```

```tsx
// Usage
<RoomProvider roomId="my-room" userId={userId} displayName={displayName}>
  <RoomWithErrorBoundary>
    <App />
  </RoomWithErrorBoundary>
</RoomProvider>
```

---

## Patterns & Tips

### Use `useBatch` when orchestrating multiple mutations

`useMutation` auto-batches within a single callback. But if you call two separate `useMutation` functions sequentially, they produce two separate batches. Wrap them in `useBatch` to collapse into one.

```tsx
const batch = useBatch();
const deleteShape = useMutation(/* ... */);
const updateLayerOrder = useMutation(/* ... */);

function handleDelete(id: string) {
  batch(() => {
    deleteShape(id);
    updateLayerOrder(id);
  });
  // One undo step, one network message
}
```

### Guard components with `useIsInsideRoom`

If a component might render outside a `<RoomProvider>` (e.g., in a shared layout), use `useIsInsideRoom` before calling any room-dependent hooks. Calling `useRoom()`, `useStorage()`, or `useOthers()` outside a provider throws.

```tsx
function MaybeCollaborative() {
  const isInRoom = useIsInsideRoom();

  // Safe -- these hooks are only called when inside a provider
  if (!isInRoom) return <FallbackUI />;
  return <CollaborativeUI />;
}
```

> **Important:** You cannot conditionally call hooks in the same component. Extract the room-dependent hooks into a child component and conditionally render it based on `useIsInsideRoom`.

### Mount `useErrorListener` once, high in the tree

Error listeners are best placed near the root of your room tree, not in individual leaf components. One listener handles all errors for the room.

```tsx
<RoomProvider roomId="my-room" userId={userId} displayName={displayName}>
  <ErrorHandler />   {/* single listener */}
  <App />
</RoomProvider>
```

### The callbackRef pattern means no stale closures

`useErrorListener` stores your callback in a ref and updates it on every render. This means you can safely reference component state without wrapping the callback in `useCallback`.

```tsx
function ErrorTracker() {
  const [errorCount, setErrorCount] = useState(0);

  // No useCallback needed -- the ref always points to the latest closure
  useErrorListener((error) => {
    setErrorCount(errorCount + 1); // always sees current errorCount
    console.error(`Error #${errorCount + 1}:`, error.message);
  });

  return <span className="text-sm text-muted-foreground">{errorCount} errors</span>;
}
```

### `useBatch` return value

`useBatch` returns a function that passes through the return value of your callback. This is useful for computing derived values inside a batch.

```tsx
const batch = useBatch();

const newId = batch(() => {
  const id = crypto.randomUUID();
  shapes.set(id, new LiveObject({ x: 0, y: 0 }));
  layerOrder.push(id);
  return id; // returned from batch()
});

console.log("Created shape:", newId);
```
