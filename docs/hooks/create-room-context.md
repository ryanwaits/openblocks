# `createRoomContext` -- Typed Hook Factory

A factory function that returns a fully typed set of all Lively React hooks. You define your app's `Presence` and `Storage` types once, call `createRoomContext<TPresence, TStorage>()`, and get back hooks where `useStorage`, `useSelf`, `useMyPresence`, and `useUpdateMyPresence` are narrowed to your types. All other hooks are re-exported as-is. Zero runtime overhead -- the factory just wraps hooks with type casts.

---

## API Signature

```ts
import { createRoomContext } from "@waits/lively-react";

function createRoomContext<
  TPresence extends Record<string, unknown> = Record<string, unknown>,
  TStorage extends Record<string, unknown> = Record<string, unknown>,
>(): TypedRoomContext<TPresence, TStorage>;
```

| Param | Type | Description |
|-------|------|-------------|
| `TPresence` | `Record<string, unknown>` | Shape of your app's presence data (cursor position, selected tool, etc.) |
| `TStorage` | `Record<string, unknown>` | Shape of your app's CRDT storage root |
| **Returns** | `TypedRoomContext` | Object containing all Lively hooks, with typed variants where applicable |

Both generic params default to `Record<string, unknown>`, so calling `createRoomContext()` with no type args gives you the same untyped hooks as direct imports.

---

## Return Type

The returned object contains every hook in the Lively React package:

### Providers

| Key | Type | Typed? | Description |
|-----|------|:------:|-------------|
| `RoomProvider` | component | No | Room context provider -- same as direct import |
| `useRoom` | `() => Room` | No | Access the raw `Room` instance |
| `useIsInsideRoom` | `() => boolean` | No | Check if the component is inside a `RoomProvider` |
| `useStorageRoot` | `() => LiveObject \| null` | No | Access the raw storage root |

### Storage

| Key | Type | Typed? | Description |
|-----|------|:------:|-------------|
| `useStorage` | `(selector: (root: LiveObject<TStorage>) => T) => T \| null` | **Yes** | Selector receives a `LiveObject<TStorage>` instead of untyped `LiveObject` |
| `useMutation` | `(callback, deps) => (...args) => R` | No | Batched mutation callback |
| `useBatch` | `() => (fn: () => void) => void` | No | Manual batching |

### Presence

| Key | Type | Typed? | Description |
|-----|------|:------:|-------------|
| `useSelf` | `() => (PresenceUser & { presence: TPresence }) \| null` | **Yes** | Current user with typed `presence` field |
| `useMyPresence` | `() => [self, update]` | **Yes** | Tuple of typed self + typed updater |
| `useUpdateMyPresence` | `() => (data: Partial<TPresence>) => void` | **Yes** | Typed presence updater |
| `useOthers` | `() => PresenceUser[]` | No | All other users in the room |
| `useOther` | `(userId) => PresenceUser \| null` | No | Single other user by ID |
| `useOthersMapped` | `(selector) => T[]` | No | Map over others with a selector |
| `useOthersUserIds` | `() => string[]` | No | Just the user IDs of others |
| `useOthersListener` | `(callback) => void` | No | Subscribe to others changes |

### Connection

| Key | Type | Typed? | Description |
|-----|------|:------:|-------------|
| `useStatus` | `() => ConnectionStatus` | No | Current connection status |
| `useSyncStatus` | `() => SyncStatus` | No | Storage sync status |
| `useLostConnectionListener` | `(callback) => void` | No | Fires when connection drops |
| `useErrorListener` | `(callback) => void` | No | Fires on connection errors |

### Events

| Key | Type | Typed? | Description |
|-----|------|:------:|-------------|
| `useBroadcastEvent` | `() => (event) => void` | No | Send custom events to other clients |
| `useEventListener` | `(callback) => void` | No | Subscribe to custom events |

### Undo / Redo

| Key | Type | Typed? | Description |
|-----|------|:------:|-------------|
| `useHistory` | `() => { undo, redo, canUndo, canRedo }` | No | Combined undo/redo controls |
| `useUndo` | `() => () => void` | No | Undo callback |
| `useRedo` | `() => () => void` | No | Redo callback |
| `useCanUndo` | `() => boolean` | No | Reactive undo availability |
| `useCanRedo` | `() => boolean` | No | Reactive redo availability |

### Live State

| Key | Type | Typed? | Description |
|-----|------|:------:|-------------|
| `useLiveState` | `(key, initial, opts?) => [T, setter]` | No | Ephemeral shared state |
| `useLiveStateData` | `(key) => T \| undefined` | No | Read-only live state |
| `useSetLiveState` | `(key) => setter` | No | Write-only live state |

### Cursors

| Key | Type | Typed? | Description |
|-----|------|:------:|-------------|
| `useCursors` | `() => CursorData[]` | No | All other users' cursor positions |
| `useUpdateCursor` | `() => (pos) => void` | No | Send cursor position updates |

### Location & Presence Events

| Key | Type | Typed? | Description |
|-----|------|:------:|-------------|
| `useOthersOnLocation` | `(locationId) => PresenceUser[]` | No | Other users at a specific location |
| `usePresenceEvent` | `(event, callback) => void` | No | Subscribe to presence state changes |

---

## Setup

### 1. Define your types

```ts
// lib/lively.ts
import { createRoomContext, LiveMap, LiveObject, LiveList } from "@waits/lively-react";

// What each user's presence looks like
type Presence = {
  cursor: { x: number; y: number } | null;
  selectedTool: "select" | "draw" | "text";
};

// The CRDT storage root shape
type Storage = {
  shapes: LiveMap<LiveObject>;
  layerOrder: LiveList<string>;
  settings: LiveObject;
};
```

### 2. Create the context

```ts
export const {
  RoomProvider,
  useStorage,
  useMutation,
  useSelf,
  useMyPresence,
  useUpdateMyPresence,
  useOthers,
  useHistory,
  useCursors,
  useUpdateCursor,
  useBroadcastEvent,
  useEventListener,
  useStatus,
  // ... destructure only what you need, or spread the whole object
} = createRoomContext<Presence, Storage>();
```

### 3. Use typed hooks everywhere

```tsx
// components/Canvas.tsx
import { useStorage, useMutation, useSelf } from "../lib/lively";

function Canvas() {
  // selector root is LiveObject<Storage> -- root.get("shapes") is type-aware
  const shapeCount = useStorage((root) => {
    const shapes = root.get("shapes") as LiveMap<LiveObject>;
    return shapes.size;
  });

  // self.presence is typed as Presence
  const self = useSelf();
  const tool = self?.presence.selectedTool; // "select" | "draw" | "text"

  if (shapeCount === null) return <div>Loading...</div>;
  return <div>{shapeCount} shapes on canvas</div>;
}
```

---

## Real-World Use Cases

### 1. Complete app setup -- whiteboard with typed presence and storage

Full file structure showing the typed context pattern end-to-end.

```ts
// lib/lively.ts
import { createRoomContext, LiveMap, LiveObject, LiveList } from "@waits/lively-react";

type Presence = {
  cursor: { x: number; y: number } | null;
  selectedIds: string[];
  tool: "select" | "pen" | "rect" | "text";
};

type Storage = {
  shapes: LiveMap<LiveObject>;
  layerOrder: LiveList<string>;
  boardName: string;
};

export const {
  RoomProvider,
  useStorage,
  useMutation,
  useBatch,
  useSelf,
  useMyPresence,
  useUpdateMyPresence,
  useOthers,
  useOther,
  useHistory,
  useCursors,
  useUpdateCursor,
  useBroadcastEvent,
  useEventListener,
  useStatus,
} = createRoomContext<Presence, Storage>();
```

```tsx
// app/board/[id]/page.tsx
import { RoomProvider } from "@/lib/lively";
import { LiveMap, LiveList } from "@waits/lively-react";
import { Canvas } from "./Canvas";
import { Toolbar } from "./Toolbar";
import { CursorOverlay } from "./CursorOverlay";

export default function BoardPage({ params }: { params: { id: string } }) {
  return (
    <RoomProvider
      roomId={`board-${params.id}`}
      userId={userId}
      displayName={displayName}
      initialStorage={{
        shapes: new LiveMap(),
        layerOrder: new LiveList(),
        boardName: "Untitled",
      }}
    >
      <Toolbar />
      <Canvas />
      <CursorOverlay />
    </RoomProvider>
  );
}
```

```tsx
// app/board/[id]/Toolbar.tsx
import { useUpdateMyPresence, useHistory, useSelf } from "@/lib/lively";

function Toolbar() {
  const updatePresence = useUpdateMyPresence();
  const { undo, redo, canUndo, canRedo } = useHistory();
  const self = useSelf();

  // self?.presence.tool is typed as "select" | "pen" | "rect" | "text"
  const activeTool = self?.presence.tool ?? "select";

  return (
    <div className="flex gap-2">
      {(["select", "pen", "rect", "text"] as const).map((tool) => (
        <button
          key={tool}
          className={activeTool === tool ? "bg-blue-500 text-white" : ""}
          onClick={() => updatePresence({ tool })}
        >
          {tool}
        </button>
      ))}
      <button onClick={undo} disabled={!canUndo}>Undo</button>
      <button onClick={redo} disabled={!canRedo}>Redo</button>
    </div>
  );
}
```

```tsx
// app/board/[id]/CursorOverlay.tsx
import { useCursors, useOthers } from "@/lib/lively";

function CursorOverlay() {
  const cursors = useCursors();
  const others = useOthers();

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {cursors.map((cursor) => {
        const user = others.find((u) => u.userId === cursor.userId);
        if (!user) return null;
        return (
          <div
            key={cursor.userId}
            className="absolute"
            style={{
              left: cursor.x,
              top: cursor.y,
              color: user.color,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M0 0 L16 6 L6 16 Z" fill="currentColor" />
            </svg>
            <span className="ml-2 text-xs">{user.displayName}</span>
          </div>
        );
      })}
    </div>
  );
}
```

---

### 2. Multi-room app with different storage shapes per room

Different room types need different storage schemas. Create separate typed contexts for each.

```ts
// lib/lively-canvas.ts
import { createRoomContext, LiveMap, LiveObject } from "@waits/lively-react";

type CanvasPresence = {
  cursor: { x: number; y: number } | null;
  tool: "select" | "draw";
};

type CanvasStorage = {
  shapes: LiveMap<LiveObject>;
};

export const canvas = createRoomContext<CanvasPresence, CanvasStorage>();
```

```ts
// lib/lively-doc.ts
import { createRoomContext, LiveList, LiveObject } from "@waits/lively-react";

type DocPresence = {
  cursor: { line: number; col: number } | null;
  selection: { start: number; end: number } | null;
};

type DocStorage = {
  blocks: LiveList<LiveObject>;
  title: string;
};

export const doc = createRoomContext<DocPresence, DocStorage>();
```

```tsx
// pages/canvas/[id].tsx
import { canvas } from "@/lib/lively-canvas";

function CanvasPage({ id }: { id: string }) {
  return (
    <canvas.RoomProvider roomId={`canvas-${id}`} userId={userId} displayName={name}>
      <CanvasEditor />
    </canvas.RoomProvider>
  );
}

function CanvasEditor() {
  // root is LiveObject<CanvasStorage> -- root.get("shapes") is typed
  const shapes = canvas.useStorage((root) => {
    const map = root.get("shapes") as LiveMap<LiveObject>;
    const result: string[] = [];
    map.forEach((_, id) => result.push(id));
    return result;
  });

  const self = canvas.useSelf();
  // self.presence.tool is "select" | "draw"

  if (shapes === null) return <div>Loading...</div>;
  return <div>{shapes.length} shapes</div>;
}
```

```tsx
// pages/doc/[id].tsx
import { doc } from "@/lib/lively-doc";

function DocPage({ id }: { id: string }) {
  return (
    <doc.RoomProvider roomId={`doc-${id}`} userId={userId} displayName={name}>
      <DocEditor />
    </doc.RoomProvider>
  );
}

function DocEditor() {
  // root is LiveObject<DocStorage> -- root.get("blocks") is typed
  const blockCount = doc.useStorage((root) => {
    const blocks = root.get("blocks") as LiveList<LiveObject>;
    return blocks.length;
  });

  const self = doc.useSelf();
  // self.presence.cursor is { line, col } | null
  // self.presence.selection is { start, end } | null

  if (blockCount === null) return <div>Loading...</div>;
  return <div>{blockCount} blocks</div>;
}
```

---

### 3. Shared hooks module pattern

For larger apps, re-export the typed context as named hooks so consumers don't need to know about the factory.

```ts
// lib/lively.ts
import { createRoomContext, LiveMap, LiveObject } from "@waits/lively-react";

type Presence = {
  cursor: { x: number; y: number } | null;
  isTyping: boolean;
};

type Storage = {
  todos: LiveMap<LiveObject>;
  settings: LiveObject;
};

const ctx = createRoomContext<Presence, Storage>();

// Re-export everything as named exports
export const RoomProvider = ctx.RoomProvider;
export const useRoom = ctx.useRoom;
export const useStorage = ctx.useStorage;
export const useMutation = ctx.useMutation;
export const useBatch = ctx.useBatch;
export const useSelf = ctx.useSelf;
export const useMyPresence = ctx.useMyPresence;
export const useUpdateMyPresence = ctx.useUpdateMyPresence;
export const useOthers = ctx.useOthers;
export const useOther = ctx.useOther;
export const useOthersMapped = ctx.useOthersMapped;
export const useOthersUserIds = ctx.useOthersUserIds;
export const useOthersListener = ctx.useOthersListener;
export const useStatus = ctx.useStatus;
export const useSyncStatus = ctx.useSyncStatus;
export const useLostConnectionListener = ctx.useLostConnectionListener;
export const useErrorListener = ctx.useErrorListener;
export const useBroadcastEvent = ctx.useBroadcastEvent;
export const useEventListener = ctx.useEventListener;
export const useHistory = ctx.useHistory;
export const useUndo = ctx.useUndo;
export const useRedo = ctx.useRedo;
export const useCanUndo = ctx.useCanUndo;
export const useCanRedo = ctx.useCanRedo;
export const useLiveState = ctx.useLiveState;
export const useLiveStateData = ctx.useLiveStateData;
export const useSetLiveState = ctx.useSetLiveState;
export const useCursors = ctx.useCursors;
export const useUpdateCursor = ctx.useUpdateCursor;
export const useOthersOnLocation = ctx.useOthersOnLocation;
export const usePresenceEvent = ctx.usePresenceEvent;
```

Now every file in the app imports from `@/lib/lively` instead of `@waits/lively-react`, and all hooks are pre-typed:

```tsx
// components/TodoList.tsx
import { useStorage, useMutation, useUpdateMyPresence } from "@/lib/lively";

function TodoList() {
  const todos = useStorage((root) => {
    const map = root.get("todos") as LiveMap<LiveObject>;
    const items: { id: string; text: string }[] = [];
    map.forEach((todo, id) => {
      items.push({ id, text: todo.get("text") as string });
    });
    return items;
  });

  const updatePresence = useUpdateMyPresence();
  // updatePresence accepts Partial<Presence> -- { cursor?, isTyping? }
  // passing { bogusField: true } is a type error

  const addTodo = useMutation(({ storage }, text: string) => {
    const todos = storage.root.get("todos") as LiveMap<LiveObject>;
    todos.set(crypto.randomUUID(), new LiveObject({ text, completed: false }));
  }, []);

  if (todos === null) return <div>Loading...</div>;
  return (
    <ul>
      {todos.map((t) => (
        <li key={t.id}>{t.text}</li>
      ))}
    </ul>
  );
}
```

---

## Patterns & Tips

### Define types in a single file

Keep `Presence` and `Storage` types next to the `createRoomContext` call. This is the single source of truth for your app's collaborative data model. Every hook consumer inherits these types automatically.

### Destructure only what you need

The factory returns 30+ hooks. Destructure only the ones your module uses -- tree-shaking handles the rest.

```ts
// A component file that only reads storage
export const { useStorage, useMutation } = createRoomContext<Presence, Storage>();
```

### Call the factory once, not per component

`createRoomContext` should be called **once** at module scope and the result exported. Calling it inside a component creates new wrapper functions on every render.

```ts
// Good -- module scope
const ctx = createRoomContext<Presence, Storage>();

// Bad -- inside a component
function MyComponent() {
  const ctx = createRoomContext<Presence, Storage>(); // new wrappers every render
}
```

### Typed hooks are type-only -- no runtime cost

The typed wrappers (`useStorageTyped`, `useSelfTyped`, etc.) delegate directly to the underlying hooks with a `as` cast. There is no additional logic, no proxy, no wrapper component. The JavaScript output is identical to calling the hooks directly.

---

## Comparison: Typed Context vs Direct Imports

| | Direct import | `createRoomContext` |
|---|---|---|
| **Import path** | `@waits/lively-react` | Your app's `lib/lively.ts` |
| **`useStorage` selector** | `(root: LiveObject) => T` -- untyped root | `(root: LiveObject<TStorage>) => T` -- typed root |
| **`useSelf` return** | `PresenceUser \| null` | `(PresenceUser & { presence: TPresence }) \| null` |
| **`useUpdateMyPresence`** | `(data: Partial<Record<string, unknown>>) => void` | `(data: Partial<TPresence>) => void` |
| **Runtime behavior** | Identical | Identical |
| **Bundle size impact** | Baseline | Zero additional cost (type casts are erased) |
| **Setup effort** | None | One-time: define types + call factory |
| **Type safety** | Manual casts in every selector | Automatic from the factory |

**Rule of thumb:** If your app has more than a couple components using Lively hooks, use `createRoomContext`. The upfront cost is one file; the payoff is type safety across every hook call site without manual casts.
