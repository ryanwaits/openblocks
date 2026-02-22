# Suspense Integration

`useStorageSuspense` is a Suspense-compatible version of `useStorage`. Instead of returning `null` while storage loads, it **suspends** (throws a promise), letting React's `<Suspense>` boundary handle the loading state. This gives you cleaner component code with zero null checks.

---

## Import Path

```typescript
import { useStorageSuspense } from "@waits/lively-react/suspense";
```

> The `/suspense` sub-path is a **separate entry point**. It is declared in the package's `exports` field and ships its own bundle. You do not need to import from the root entry point when using suspense hooks.

---

## API Reference

### `useStorageSuspense<T>(selector)`

Reads a value from the room's shared CRDT storage via a selector function. Suspends (throws a promise) while storage is loading. Re-renders only when the selected value changes (shallow-equal check).

| Param | Type | Description |
|-------|------|-------------|
| `selector` | `(root: LiveObject) => T` | Pure function mapping the storage root to the desired slice |

**Returns:** `T` (never `null` or `undefined` while loading)

**Throws:**
- Suspends (throws a Promise) if storage has not initialized yet
- `Error("useStorageSuspense cannot be used during SSR")` if called during server-side rendering
- `Error("useRoom must be used within a <RoomProvider>")` if called outside a `<RoomProvider>`

---

## `useStorageSuspense` vs `useStorage`

| | `useStorage(selector)` | `useStorageSuspense(selector)` |
|---|---|---|
| **Import** | `@waits/lively-react` | `@waits/lively-react/suspense` |
| **Loading behavior** | Returns `null` | Suspends (throws a Promise) |
| **Return type** | `T \| null` | `T` |
| **Requires `<Suspense>` boundary** | No | Yes |
| **Null checks needed** | Yes | No |
| **SSR support** | Returns `null` on server | Throws an error |

---

## Basic Usage

### Without Suspense (traditional)

```tsx
import { useStorage } from "@waits/lively-react";

function TodoList() {
  const todos = useStorage((root) => root.get("todos"));

  if (todos === null) return <Spinner />;  // manual loading check

  return (
    <ul>
      {todos.map((t) => (
        <li key={t.get("id")}>{t.get("text")}</li>
      ))}
    </ul>
  );
}
```

### With Suspense

```tsx
import { Suspense } from "react";
import { useStorageSuspense } from "@waits/lively-react/suspense";

function TodoList() {
  const todos = useStorageSuspense((root) => root.get("todos"));
  // todos is always defined here -- no null check needed
  return (
    <ul>
      {todos.map((t) => (
        <li key={t.get("id")}>{t.get("text")}</li>
      ))}
    </ul>
  );
}

function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <TodoList />
    </Suspense>
  );
}
```

---

## `ClientSideSuspense`

An SSR-safe wrapper that defers rendering until the client has mounted. On the server (and on the first client render), it shows the `fallback`. After mount, it renders `children()` inside a `<Suspense>` boundary.

```ts
import { ClientSideSuspense } from "@waits/lively-react";
```

### Signature

```ts
function ClientSideSuspense(props: {
  children: () => ReactNode;   // render function -- called only on client
  fallback: ReactNode;         // shown during SSR + initial client render + loading
}): ReactElement;
```

> **Why is `children` a function?** If `children` were a regular `ReactNode`, React would evaluate all hooks inside it during server-side rendering. By using a render function, the hooks are only called after client-side mount -- when the room providers are available.

### Example -- SSR-safe room component

```tsx
import { ClientSideSuspense } from "@waits/lively-react";
import { useStorageSuspense } from "@waits/lively-react/suspense";

function Editor() {
  const doc = useStorageSuspense((root) => root.get("document"));
  return <textarea defaultValue={doc.get("content")} />;
}

function EditorSkeleton() {
  return <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />;
}

// Works in Next.js App Router, Remix, or any SSR framework
export default function Page() {
  return (
    <RoomProvider roomId="doc-1" userId={uid} displayName={name}>
      <ClientSideSuspense fallback={<EditorSkeleton />}>
        {() => <Editor />}
      </ClientSideSuspense>
    </RoomProvider>
  );
}
```

### How it works

1. **Server render:** `mounted` is `false` → renders `fallback`
2. **First client render (hydration):** `mounted` is still `false` → renders `fallback` (matches server output)
3. **After `useEffect`:** `setMounted(true)` → renders `<Suspense fallback={fallback}>{children()}</Suspense>`
4. **Storage loading:** If `children()` calls a suspense hook that throws, `<Suspense>` catches it and shows `fallback`
5. **Storage ready:** Component renders with data

> **Same API as Liveblocks.** If you're migrating from `@liveblocks/react`, `ClientSideSuspense` is a drop-in replacement.

---

## Suspense CRDT Shortcuts

Three additional suspense hooks for direct CRDT access (thin wrappers around `useStorageSuspense`):

| Hook | Signature | Returns |
|------|-----------|---------|
| `useObjectSuspense<T>(key)` | `(key: string) => LiveObject<T>` | `LiveObject<T>` |
| `useMapSuspense<V>(key)` | `(key: string) => LiveMap<string, V>` | `LiveMap<string, V>` |
| `useListSuspense<T>(key)` | `(key: string) => LiveList<T>` | `LiveList<T>` |

```ts
import { useObjectSuspense, useMapSuspense, useListSuspense } from "@waits/lively-react/suspense";
```

These never return `null` -- they suspend while storage loads instead. See [crdt-shortcuts.md](./crdt-shortcuts.md) for full documentation and use cases.

---

## Real-World Use Cases

### Dashboard with independent panels

Each panel suspends independently. Panels that load faster appear first while slower ones show their own fallback.

```tsx
function Dashboard() {
  return (
    <div className="grid grid-cols-3 gap-4">
      <Suspense fallback={<PanelSkeleton />}>
        <TasksPanel />
      </Suspense>
      <Suspense fallback={<PanelSkeleton />}>
        <ChatPanel />
      </Suspense>
      <Suspense fallback={<PanelSkeleton />}>
        <ActivityPanel />
      </Suspense>
    </div>
  );
}

function TasksPanel() {
  const tasks = useStorageSuspense((root) => root.get("tasks"));
  return <TaskList tasks={tasks} />;
}
```

> Wrapping each panel in its own `<Suspense>` boundary lets them load progressively instead of blocking the entire dashboard behind a single spinner.

---

### Code-split rooms

Lazy-load room components. A single `<Suspense>` boundary handles both the code split AND the storage loading.

```tsx
const WhiteboardRoom = React.lazy(() => import("./rooms/Whiteboard"));

function App() {
  return (
    <RoomProvider roomId="board-1" userId={uid} displayName={name}>
      <Suspense fallback={<FullPageLoader />}>
        <WhiteboardRoom />
      </Suspense>
    </RoomProvider>
  );
}

// Inside WhiteboardRoom -- no loading checks needed
function WhiteboardRoom() {
  const shapes = useStorageSuspense((root) => root.get("shapes"));
  return <Canvas shapes={shapes} />;
}
```

---

### Skeleton screens

Use the Suspense fallback to show a skeleton UI while storage loads, then swap to the real content. Cleaner than conditional rendering.

```tsx
function CardSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-4 bg-gray-200 rounded w-1/2" />
    </div>
  );
}

function ProjectCard() {
  const project = useStorageSuspense((root) => root.get("project"));
  return (
    <div>
      <h2>{project.get("name")}</h2>
      <p>{project.get("description")}</p>
    </div>
  );
}

// Usage
<Suspense fallback={<CardSkeleton />}>
  <ProjectCard />
</Suspense>
```

---

### Nested data access

When you need deep reads, Suspense eliminates cascading null checks.

```tsx
// Without Suspense -- cascading null checks
function ColumnView({ boardId }: { boardId: string }) {
  const columns = useStorage((root) => {
    const boards = root.get("boards");
    if (!boards) return null;
    const board = boards.get(boardId);
    if (!board) return null;
    return board.get("columns");
  });
  if (columns === null) return <Spinner />;
  return <ColumnList columns={columns} />;
}

// With Suspense -- clean, direct access
function ColumnView({ boardId }: { boardId: string }) {
  const columns = useStorageSuspense((root) =>
    root.get("boards").get(boardId).get("columns")
  );
  return <ColumnList columns={columns} />;
}
```

---

## When to Use vs `useStorage`

### Use `useStorageSuspense` when:

- You want **cleaner components** with no loading-state boilerplate
- You already use `<Suspense>` for other data (code splitting, data fetching)
- You are building a **new app** and can structure boundaries from the start
- You want **skeleton fallbacks** managed declaratively in the component tree

### Use `useStorage` when:

- You are **retrofitting** existing code that does not use Suspense
- You need **fine-grained loading control** (e.g., inline spinners, partial rendering)
- You want to avoid introducing `<Suspense>` boundaries into the tree
- You need SSR support (suspense entry point throws during server rendering)

---

## Patterns & Tips

### Place Suspense boundaries strategically

Too high in the tree = one giant loading flash for the whole page. Too low = dozens of individual spinners.

```tsx
// Too high -- entire app blocked
<Suspense fallback={<FullPageSpinner />}>
  <Header />      {/* doesn't need storage */}
  <Sidebar />     {/* doesn't need storage */}
  <Canvas />      {/* needs storage */}
</Suspense>

// Too low -- spinner per shape
{shapes.map((s) => (
  <Suspense key={s.id} fallback={<ShapeSkeleton />}>
    <Shape id={s.id} />
  </Suspense>
))}

// Right -- boundary around the data-dependent subtree
<Header />
<Sidebar />
<Suspense fallback={<CanvasSkeleton />}>
  <Canvas />
</Suspense>
```

---

### Pair with ErrorBoundary for connection failures

Suspense handles the loading state. An `ErrorBoundary` handles the error state. Together they cover the full lifecycle.

```tsx
import { ErrorBoundary } from "react-error-boundary";

<ErrorBoundary fallback={<ConnectionError />}>
  <Suspense fallback={<Spinner />}>
    <CollaborativeEditor />
  </Suspense>
</ErrorBoundary>
```

> The `ErrorBoundary` should wrap the `<Suspense>` boundary so it catches errors thrown during both loading and rendering.

---

### Combine with `React.lazy()` for code-split + data-loading

A single `<Suspense>` boundary handles both the dynamic import and the storage initialization.

```tsx
const Editor = React.lazy(() => import("./Editor"));

<Suspense fallback={<EditorSkeleton />}>
  <Editor />  {/* suspends for code split, then for storage */}
</Suspense>
```

---

### Non-storage hooks work the same regardless of entry point

`useSelf`, `useOthers`, `useCursors`, `useMutation`, and all other hooks behave identically whether you import them from `@waits/lively-react` or `@waits/lively-react/suspense`. Only the storage access differs.

```tsx
import {
  useStorageSuspense,
  useSelf,
  useOthers,
  useMutation,
  useCursors,
} from "@waits/lively-react/suspense";

// All of these work exactly the same as the root entry point
const me = useSelf();
const others = useOthers();
const cursors = useCursors();
```

---

## Other Exports from the Suspense Entry Point

The `/suspense` sub-path re-exports everything you need so you can import from a single path. You do not need to also import from the root entry point.

### Hooks

| Export | Description |
|--------|-------------|
| `useStorageSuspense` | Suspense-compatible storage selector |
| `useObjectSuspense` | Suspense shortcut for `LiveObject` at a top-level key |
| `useMapSuspense` | Suspense shortcut for `LiveMap` at a top-level key |
| `useListSuspense` | Suspense shortcut for `LiveList` at a top-level key |
| `useStatus` | Connection status (`connecting`, `connected`, `disconnected`) |
| `useSyncStatus` | High-level sync status (`synchronized`, `synchronizing`, `not-synchronized`) |
| `useLostConnectionListener` | Callback when connection is lost |
| `useErrorListener` | Callback on WebSocket errors |
| `useSelf` | Current user's presence data |
| `useMyPresence` | Tuple of `[self, updatePresence]` |
| `useUpdateMyPresence` | Stable function to update own presence |
| `useOthers` | List of other connected users |
| `useOthersMapped` | Mapped projection of other users |
| `useOthersUserIds` | Sorted user ID array (re-renders only on join/leave) |
| `useOthersListener` | Imperative callback on enter/leave/update |
| `useMutation` | Create a storage mutation callback |
| `useBatch` | Wrap mutations in a single batch |
| `useCursors` | Other users' cursor positions |
| `useUpdateCursor` | Send local cursor position |
| `useBroadcastEvent` | Broadcast a custom event to the room |
| `useEventListener` | Listen for custom events from the room |
| `useOthersOnLocation` | Users at a specific location |
| `usePresenceEvent` | Subscribe to presence events |
| `useLiveState` | Ephemeral shared state |
| `useLiveStateData` | Read-only live state |
| `useSetLiveState` | Write-only live state |
| `useUndo` | Undo last mutation |
| `useRedo` | Redo last undone mutation |
| `useCanUndo` | Whether undo is available |
| `useCanRedo` | Whether redo is available |
| `useHistory` | Access the history manager |
| `createRoomContext` | Typed hook factory |
| `ClientSideSuspense` | SSR-safe Suspense wrapper |
| `useIsInsideRoom` | Check if inside a RoomProvider |

### Providers

| Export | Description |
|--------|-------------|
| `LivelyProvider` | Top-level client provider |
| `useClient` | Access the Lively client instance |
| `RoomProvider` | Join a room and provide it to child hooks |
| `useRoom` | Access the current `Room` instance |
| `useStorageRoot` | Raw storage root (prefer `useStorageSuspense`) |

### CRDT Types

| Export | Description |
|--------|-------------|
| `LiveObject` | Collaborative key-value object |
| `LiveMap` | Collaborative Map |
| `LiveList` | Collaborative ordered list |

### Wire Types

| Export | Description |
|--------|-------------|
| `ConnectionStatus` | Union type for connection states |
| `SyncStatus` | Union type for sync states |
| `PresenceUser` | Shape of a presence user object |
| `CursorData` | Shape of cursor position data |
| `OnlineStatus` | `"online" \| "away" \| "offline"` |
| `PresenceUpdatePayload` | Partial presence update shape |
| `OthersEvent` | Discriminated union for others listener |

---

## How It Works (Internals)

For contributors or anyone debugging behavior:

1. `useStorageSuspense` reads `StorageContext` from the nearest `<RoomProvider>`.
2. If the context is `null` (storage not yet initialized), it calls `room.getStorage()` and **throws the resulting Promise**. React catches this and renders the nearest `<Suspense>` fallback.
3. When storage initializes, `RoomProvider` calls `setStorage(s)` which updates the `StorageContext`. React retries the suspended component.
4. On retry, `StorageContext` is non-null, so the hook proceeds to `useSyncExternalStore` with a deep subscription on the storage root.
5. The selector is stored in a ref (`selectorRef`) so it can change between renders without re-subscribing. Results are cached with `shallowEqual` to prevent unnecessary re-renders.

```
Component renders
  -> StorageContext is null?
     YES -> throw room.getStorage() promise
            -> React shows <Suspense> fallback
            -> storage initializes, context updates
            -> React retries component
     NO  -> useSyncExternalStore subscribes to storage
         -> selector(root) returns T
         -> component renders with data
```

> The thrown promise is `room.getStorage().then(() => {})` -- the `.then(() => {})` ensures the resolved value is `void`, which is what React's Suspense protocol expects.
