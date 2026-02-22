# Storage & Mutations

Lively uses **CRDTs** (Conflict-free Replicated Data Types) for persistent, collaborative storage. Every mutation is automatically synced across all connected clients using **last-writer-wins (LWW)** conflict resolution with Lamport clocks. Changes survive disconnects, page refreshes, and empty rooms -- they are persisted in the room's storage document, not ephemeral like presence or live state.

This is the core value prop: define your data schema with `LiveObject`, `LiveMap`, and `LiveList`, read it with `useStorage`, mutate it with `useMutation`, and Lively handles sync, conflict resolution, and undo/redo automatically.

---

## `useStorage`

Reads a value from the room's shared CRDT storage via a **selector function**. The selector receives the storage root (a `LiveObject`) and returns whatever slice of data you need. The component re-renders only when the selected value changes (shallow equality check).

### Signature

```ts
function useStorage<T>(selector: (root: LiveObject) => T): T | null
```

| Param | Type | Description |
|-------|------|-------------|
| `selector` | `(root: LiveObject) => T` | Pure function that extracts a value from the storage root. Called on every storage change. |
| **Returns** | `T \| null` | `null` while storage is loading, then the selected value. |

> **Loading state:** `useStorage` returns `null` until the server sends the initial `storage:init` snapshot. Always handle the `null` case in your component.

### Examples

#### Simple value

```tsx
import { useStorage } from "@waits/lively-react";

function Counter() {
  const count = useStorage((root) => root.get("count"));

  if (count === null) return <div>Loading...</div>;
  return <div>Count: {count}</div>;
}
```

#### Nested access

```tsx
function UserName() {
  const name = useStorage((root) => {
    const profile = root.get("profile") as LiveObject;
    return profile.get("name") as string;
  });

  if (name === null) return null;
  return <span>{name}</span>;
}
```

#### Computed / derived values

```tsx
function TodoStats() {
  const stats = useStorage((root) => {
    const todos = root.get("todos") as LiveMap<LiveObject>;
    let total = 0;
    let completed = 0;

    todos.forEach((todo) => {
      total++;
      if (todo.get("completed")) completed++;
    });

    return { total, completed, remaining: total - completed };
  });

  if (stats === null) return null;
  return <p>{stats.remaining} of {stats.total} remaining</p>;
}
```

#### Selecting a collection as an array

```tsx
function TodoList() {
  const todos = useStorage((root) => {
    const map = root.get("todos") as LiveMap<LiveObject>;
    const result: { id: string; text: string; completed: boolean }[] = [];
    map.forEach((todo, id) => {
      result.push({
        id,
        text: todo.get("text") as string,
        completed: todo.get("completed") as boolean,
      });
    });
    return result;
  });

  if (todos === null) return <div>Loading...</div>;
  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>{todo.text}</li>
      ))}
    </ul>
  );
}
```

### Suspense variant

If you prefer Suspense over `null` checks, use `useStorageSuspense` from `@waits/lively-react/suspense`:

```tsx
import { useStorageSuspense } from "@waits/lively-react/suspense";

function Counter() {
  // Never null -- suspends until storage is ready
  const count = useStorageSuspense((root) => root.get("count"));
  return <div>Count: {count}</div>;
}

// Wrap in Suspense boundary
<Suspense fallback={<div>Loading...</div>}>
  <Counter />
</Suspense>
```

---

## `useMutation`

Returns a stable callback that mutates shared storage. The callback is automatically wrapped in `room.batch()`, so all mutations within a single call become **one sync message** and **one undo step**.

### Signature

```ts
function useMutation<Args extends unknown[], R>(
  callback: (ctx: { storage: { root: LiveObject } }, ...args: Args) => R,
  deps: unknown[]
): (...args: Args) => R
```

| Param | Type | Description |
|-------|------|-------------|
| `callback` | `(ctx, ...args) => R` | Mutation logic. First argument is the context with `storage.root`. Additional arguments are passed through from the returned function. |
| `deps` | `unknown[]` | Dependency array, same semantics as `useCallback`. |
| **Returns** | `(...args: Args) => R` | Stable function that executes the mutation when called. |

> **Throws** if called before storage has loaded. Always ensure `useStorage` has returned a non-null value before invoking a mutation.

### Examples

#### Basic mutation

```tsx
import { useMutation } from "@waits/lively-react";

function Counter() {
  const count = useStorage((root) => root.get("count"));

  const increment = useMutation(({ storage }) => {
    const current = storage.root.get("count") as number;
    storage.root.set("count", current + 1);
  }, []);

  if (count === null) return null;
  return <button onClick={increment}>Count: {count}</button>;
}
```

#### Mutation with arguments

```tsx
const addTodo = useMutation(({ storage }, text: string) => {
  const todos = storage.root.get("todos") as LiveMap<LiveObject>;
  const id = crypto.randomUUID();
  todos.set(id, new LiveObject({ text, completed: false, createdAt: Date.now() }));
}, []);

// Usage
addTodo("Buy groceries");
```

#### Multiple mutations in one callback = one undo step

```tsx
const moveShape = useMutation(({ storage }, id: string, x: number, y: number) => {
  const shapes = storage.root.get("shapes") as LiveMap<LiveObject>;
  const shape = shapes.get(id) as LiveObject;
  shape.set("x", x);
  shape.set("y", y);
  shape.set("rotation", 0);
  // All three .set() calls are batched into one sync message and one undo step
}, []);
```

#### Using external deps

```tsx
function ColorPicker({ shapeId }: { shapeId: string }) {
  const setColor = useMutation(({ storage }, color: string) => {
    const shapes = storage.root.get("shapes") as LiveMap<LiveObject>;
    const shape = shapes.get(shapeId) as LiveObject;
    shape.set("fill", color);
  }, [shapeId]); // shapeId is a dependency

  return <input type="color" onChange={(e) => setColor(e.target.value)} />;
}
```

### Pattern: define mutations as named hooks

For larger apps, extract mutations into reusable hooks rather than defining them inline:

```tsx
// hooks/use-todo-mutations.ts
import { useMutation, LiveObject, LiveMap } from "@waits/lively-react";

export function useAddTodo() {
  return useMutation(({ storage }, text: string) => {
    const todos = storage.root.get("todos") as LiveMap<LiveObject>;
    const id = crypto.randomUUID();
    todos.set(id, new LiveObject({ text, completed: false }));
  }, []);
}

export function useToggleTodo() {
  return useMutation(({ storage }, id: string) => {
    const todos = storage.root.get("todos") as LiveMap<LiveObject>;
    const todo = todos.get(id) as LiveObject;
    todo.set("completed", !todo.get("completed"));
  }, []);
}

export function useDeleteTodo() {
  return useMutation(({ storage }, id: string) => {
    const todos = storage.root.get("todos") as LiveMap<LiveObject>;
    todos.delete(id);
  }, []);
}
```

```tsx
// components/TodoApp.tsx
import { useAddTodo, useToggleTodo, useDeleteTodo } from "../hooks/use-todo-mutations";

function TodoApp() {
  const todos = useStorage((root) => /* ... */);
  const addTodo = useAddTodo();
  const toggleTodo = useToggleTodo();
  const deleteTodo = useDeleteTodo();

  // ...
}
```

---

## CRDT Types Reference

All CRDT types extend `AbstractCrdt` and share these characteristics:
- Mutations emit ops that are sent to the server and broadcast to other clients
- Conflict resolution uses Lamport clocks (LWW -- highest clock wins)
- Inverse ops are automatically captured for undo/redo support
- Instances can be nested arbitrarily (a `LiveMap` of `LiveObjects` containing `LiveLists`, etc.)

### `LiveObject<T>`

A JSON-like object where **each field has independent conflict resolution**. If User A sets `color` while User B sets `position`, both changes are preserved -- they have different keys and separate clocks.

#### Constructor

```ts
new LiveObject<T>(initial?: Partial<T>)
```

```tsx
import { LiveObject } from "@waits/lively-react";

const shape = new LiveObject({
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  fill: "#3b82f6",
});
```

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `get(key)` | `get<K extends keyof T>(key: K): T[K]` | Returns the value for `key`. |
| `set(key, value)` | `set<K extends keyof T>(key: K, value: T[K]): void` | Sets `key` to `value`. Emits an op, notifies subscribers, and captures an inverse for undo. |
| `update(partial)` | `update(partial: Partial<T>): void` | Sets multiple fields at once. Equivalent to calling `set()` for each entry in the partial. |
| `toObject()` | `toObject(): T` | Returns a plain JS object snapshot of all fields. |
| `toImmutable()` | `toImmutable(): Readonly<T>` | Returns a frozen object snapshot. Cached until the next mutation. |

> **No `delete` method.** `LiveObject` is designed for structured data with known keys. If you need dynamic key addition/removal, use `LiveMap`.

#### When to use

Structured data with known keys: user profiles, settings, document metadata, individual shapes on a canvas.

#### Example: nested LiveObjects

```tsx
const initialStorage = {
  settings: new LiveObject({
    theme: new LiveObject({ primary: "#3b82f6", background: "#ffffff" }),
    notifications: new LiveObject({ email: true, push: false }),
  }),
};

// Reading nested values
const primaryColor = useStorage((root) => {
  const settings = root.get("settings") as LiveObject;
  const theme = settings.get("theme") as LiveObject;
  return theme.get("primary") as string;
});

// Mutating nested values
const setPrimaryColor = useMutation(({ storage }, color: string) => {
  const settings = storage.root.get("settings") as LiveObject;
  const theme = settings.get("theme") as LiveObject;
  theme.set("primary", color);
}, []);
```

---

### `LiveMap<V>`

A key-value map where **keys are dynamic** (unknown at design time). Supports add, update, and delete of entries. Tombstone-based deletion ensures deletes propagate correctly across clients.

#### Constructor

```ts
new LiveMap<V>(entries?: Iterable<[string, V]>)
```

```tsx
import { LiveMap, LiveObject } from "@waits/lively-react";

const todos = new LiveMap<LiveObject>([
  ["todo-1", new LiveObject({ text: "Buy milk", completed: false })],
  ["todo-2", new LiveObject({ text: "Write docs", completed: true })],
]);
```

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `get(key)` | `get(key: string): V \| undefined` | Returns the value for `key`, or `undefined` if not found or deleted. |
| `set(key, value)` | `set(key: string, value: V): void` | Sets `key` to `value`. Inserts or overwrites. Emits an op. |
| `delete(key)` | `delete(key: string): void` | Tombstone-deletes the entry for `key`. The key is marked as deleted internally (not removed), ensuring the delete wins in LWW resolution. |
| `has(key)` | `has(key: string): boolean` | Returns `true` if `key` exists and is not deleted. |
| `size` | `get size(): number` | Number of live (non-deleted) entries. |
| `forEach(cb)` | `forEach(cb: (value: V, key: string) => void): void` | Iterates over all live entries. |
| `keys()` | `keys(): IterableIterator<string>` | Iterator over live keys. |
| `values()` | `values(): IterableIterator<V>` | Iterator over live values. |
| `entries()` | `entries(): IterableIterator<[string, V]>` | Iterator over live `[key, value]` pairs. |
| `toImmutable()` | `toImmutable(): ReadonlyMap<string, V>` | Returns a frozen `Map` snapshot. Cached until the next mutation. |

#### When to use

Collections where items have IDs: todo items, board objects, chat messages, user records. Any time you need to add/remove items dynamically by key.

#### Example: todo list with LiveMap of LiveObjects

```tsx
import { useStorage, useMutation, LiveObject, LiveMap } from "@waits/lively-react";

function TodoApp() {
  const todos = useStorage((root) => {
    const map = root.get("todos") as LiveMap<LiveObject>;
    const items: { id: string; text: string; completed: boolean }[] = [];
    map.forEach((todo, id) => {
      items.push({
        id,
        text: todo.get("text") as string,
        completed: todo.get("completed") as boolean,
      });
    });
    return items;
  });

  const addTodo = useMutation(({ storage }, text: string) => {
    const todos = storage.root.get("todos") as LiveMap<LiveObject>;
    const id = crypto.randomUUID();
    todos.set(id, new LiveObject({ text, completed: false, createdAt: Date.now() }));
  }, []);

  const toggleTodo = useMutation(({ storage }, id: string) => {
    const todos = storage.root.get("todos") as LiveMap<LiveObject>;
    const todo = todos.get(id) as LiveObject;
    todo.set("completed", !todo.get("completed"));
  }, []);

  const deleteTodo = useMutation(({ storage }, id: string) => {
    const todos = storage.root.get("todos") as LiveMap<LiveObject>;
    todos.delete(id);
  }, []);

  if (todos === null) return <div>Loading...</div>;

  return (
    <div>
      <button onClick={() => addTodo("New task")}>Add</button>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
            />
            <span>{todo.text}</span>
            <button onClick={() => deleteTodo(todo.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

### `LiveList<T>`

An **ordered array** with conflict-free insert, delete, and move operations. Uses fractional indexing under the hood, so concurrent inserts at different positions never conflict. Two users can insert items simultaneously and both insertions are preserved in a deterministic order.

#### Constructor

```ts
new LiveList<T>(initial?: T[])
```

```tsx
import { LiveList, LiveObject } from "@waits/lively-react";

const layers = new LiveList([
  new LiveObject({ id: "bg", type: "rect", zIndex: 0 }),
  new LiveObject({ id: "title", type: "text", zIndex: 1 }),
]);
```

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `push(item)` | `push(item: T): void` | Appends an item to the end of the list. |
| `insert(item, index)` | `insert(item: T, index: number): void` | Inserts an item at `index`, shifting subsequent items. |
| `delete(index)` | `delete(index: number): void` | Removes the item at `index`. |
| `move(from, to)` | `move(from: number, to: number): void` | Moves the item at `from` to position `to`. |
| `get(index)` | `get(index: number): T \| undefined` | Returns the item at `index`. |
| `length` | `get length(): number` | Number of items in the list. |
| `forEach(cb)` | `forEach(cb: (value: T, index: number) => void): void` | Iterates over all items. |
| `map(cb)` | `map<U>(cb: (value: T, index: number) => U): U[]` | Maps over all items, returns a plain array. |
| `toArray()` | `toArray(): T[]` | Returns a plain JS array snapshot. |
| `toImmutable()` | `toImmutable(): readonly T[]` | Returns a frozen array snapshot. Cached until the next mutation. |

#### When to use

Ordered collections where position matters: kanban columns, z-ordered layers, playlists, comment threads, form field ordering.

#### Example: reorderable list

```tsx
import { useStorage, useMutation, LiveObject, LiveList } from "@waits/lively-react";

function LayerPanel() {
  const layers = useStorage((root) => {
    const list = root.get("layers") as LiveList<LiveObject>;
    return list.map((layer, i) => ({
      index: i,
      id: layer.get("id") as string,
      name: layer.get("name") as string,
    }));
  });

  const moveLayer = useMutation(({ storage }, from: number, to: number) => {
    const list = storage.root.get("layers") as LiveList<LiveObject>;
    list.move(from, to);
  }, []);

  const addLayer = useMutation(({ storage }, name: string) => {
    const list = storage.root.get("layers") as LiveList<LiveObject>;
    list.push(new LiveObject({ id: crypto.randomUUID(), name }));
  }, []);

  const deleteLayer = useMutation(({ storage }, index: number) => {
    const list = storage.root.get("layers") as LiveList<LiveObject>;
    list.delete(index);
  }, []);

  if (layers === null) return null;

  return (
    <div>
      <button onClick={() => addLayer("New Layer")}>Add Layer</button>
      <ul>
        {layers.map((layer) => (
          <li key={layer.id}>
            {layer.name}
            <button onClick={() => moveLayer(layer.index, Math.max(0, layer.index - 1))}>Up</button>
            <button onClick={() => moveLayer(layer.index, layer.index + 1)}>Down</button>
            <button onClick={() => deleteLayer(layer.index)}>Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Choosing the Right Type

| Need | Use | Example |
|------|-----|---------|
| Fixed structure with known keys | `LiveObject` | User profile, settings, shape properties |
| Dynamic key-value collection | `LiveMap` | Todo items by ID, board objects, user records |
| Ordered collection where position matters | `LiveList` | Z-ordered layers, playlist, kanban columns |
| Nested structure | `LiveObject` inside `LiveMap` | Board objects where each object has typed properties |
| Ordered items with typed properties | `LiveList` of `LiveObjects` | Form fields, comment thread, document blocks |

**Rule of thumb:** Start with `LiveMap<LiveObject>` for most collections. Use `LiveList` only when ordering is part of your domain model. Use `LiveObject` at the root and for individual records.

---

## Setting Up `initialStorage`

The `initialStorage` prop on `<RoomProvider>` defines the CRDT schema for a room. It is written to storage on first connection if the room's storage is empty. Subsequent connections ignore it.

```tsx
import { RoomProvider, LiveObject, LiveMap, LiveList } from "@waits/lively-react";

function App() {
  return (
    <RoomProvider
      roomId="my-room"
      userId={userId}
      displayName={displayName}
      initialStorage={{
        count: 0,
        settings: new LiveObject({
          theme: "light",
          fontSize: 14,
        }),
        todos: new LiveMap<LiveObject>(),
        layers: new LiveList<LiveObject>(),
      }}
    >
      <MyApp />
    </RoomProvider>
  );
}
```

> **Important:** `initialStorage` should match your data access patterns. If `useStorage` selects `root.get("todos")` and expects a `LiveMap`, make sure `initialStorage` includes `todos: new LiveMap()`. Mismatches cause runtime errors.

---

## Real-World Use Cases

### 1. Todo App

`LiveMap` of `LiveObjects`, each with `text`, `completed`, and `createdAt` fields.

```tsx
// Initial storage
const initialStorage = {
  todos: new LiveMap<LiveObject>(),
};

// Read
const todos = useStorage((root) => {
  const map = root.get("todos") as LiveMap<LiveObject>;
  const items: Todo[] = [];
  map.forEach((todo, id) => {
    items.push({
      id,
      text: todo.get("text") as string,
      completed: todo.get("completed") as boolean,
      createdAt: todo.get("createdAt") as number,
    });
  });
  return items.sort((a, b) => a.createdAt - b.createdAt);
});

// Mutate
const addTodo = useMutation(({ storage }, text: string) => {
  const todos = storage.root.get("todos") as LiveMap<LiveObject>;
  todos.set(crypto.randomUUID(), new LiveObject({
    text,
    completed: false,
    createdAt: Date.now(),
  }));
}, []);
```

### 2. Whiteboard

`LiveMap` of `LiveObjects` for shapes (random access by ID), `LiveList` for z-ordering.

```tsx
const initialStorage = {
  shapes: new LiveMap<LiveObject>(),
  layerOrder: new LiveList<string>(), // ordered shape IDs
};

const updateShape = useMutation(({ storage }, id: string, props: Partial<Shape>) => {
  const shapes = storage.root.get("shapes") as LiveMap<LiveObject>;
  const shape = shapes.get(id) as LiveObject;
  shape.update(props); // sets multiple fields, all in one batch
}, []);

const bringToFront = useMutation(({ storage }, id: string) => {
  const order = storage.root.get("layerOrder") as LiveList<string>;
  const idx = order.toArray().indexOf(id);
  if (idx !== -1) {
    order.move(idx, order.length - 1);
  }
}, []);
```

### 3. Document Editor

`LiveList` of paragraph `LiveObjects` where order is the document structure.

```tsx
const initialStorage = {
  blocks: new LiveList<LiveObject>([
    new LiveObject({ type: "paragraph", text: "", bold: false }),
  ]),
};

const insertBlock = useMutation(({ storage }, index: number, type: string) => {
  const blocks = storage.root.get("blocks") as LiveList<LiveObject>;
  blocks.insert(new LiveObject({ type, text: "", bold: false }), index);
}, []);

const updateBlock = useMutation(({ storage }, index: number, text: string) => {
  const blocks = storage.root.get("blocks") as LiveList<LiveObject>;
  const block = blocks.get(index) as LiveObject;
  block.set("text", text);
}, []);
```

### 4. Settings Panel

Single `LiveObject` with typed fields. Simple reads, simple writes.

```tsx
const initialStorage = {
  settings: new LiveObject({
    theme: "light",
    fontSize: 14,
    language: "en",
    sidebarOpen: true,
  }),
};

const theme = useStorage((root) => {
  const settings = root.get("settings") as LiveObject;
  return settings.get("theme") as string;
});

const setTheme = useMutation(({ storage }, theme: string) => {
  const settings = storage.root.get("settings") as LiveObject;
  settings.set("theme", theme);
}, []);
```

---

## Patterns & Tips

### Always define `initialStorage`

Without `initialStorage`, the room starts with an empty root `LiveObject`. Accessing `root.get("todos")` returns `undefined`, and calling methods on it throws. Define your schema upfront.

### Use `useMutation`, not direct CRDT calls

In React components, always mutate through `useMutation`. It handles batching (one sync message, one undo step) and throws a clear error if storage is not loaded yet.

```tsx
// Bad -- no batching, no undo grouping, no load guard
const room = useRoom();
function handleClick() {
  const root = getStorageRoot();
  root.set("x", 10);
  root.set("y", 20);
}

// Good
const update = useMutation(({ storage }) => {
  storage.root.set("x", 10);
  storage.root.set("y", 20);
}, []);
```

### Selector optimization

`useStorage` re-runs the selector on every storage change (deep subscription). Select only what you need to minimize re-renders.

```tsx
// Bad -- re-renders on ANY storage change
const everything = useStorage((root) => root.toObject());

// Good -- re-renders only when "count" changes
const count = useStorage((root) => root.get("count"));

// Good -- derive a primitive or small object
const todoCount = useStorage((root) => {
  const todos = root.get("todos") as LiveMap;
  return todos.size;
});
```

> Shallow equality is used to compare the previous and next selected values. Returning a new object or array reference every time defeats caching. For derived arrays, ensure the selector returns the same reference when the underlying data has not changed.

### Batching

Multiple mutations inside one `useMutation` callback = one sync message + one undo step:

```tsx
const resetShape = useMutation(({ storage }, id: string) => {
  const shapes = storage.root.get("shapes") as LiveMap<LiveObject>;
  const shape = shapes.get(id) as LiveObject;
  // All four mutations are a single atomic operation
  shape.set("x", 0);
  shape.set("y", 0);
  shape.set("width", 100);
  shape.set("height", 100);
}, []);
```

### LiveObject `update()` for multi-field writes

Instead of calling `set()` multiple times, use `update()` for cleaner code. It calls `set()` for each key internally, so batching and undo behavior are identical.

```tsx
const updateShape = useMutation(({ storage }, id: string, props: Partial<Shape>) => {
  const shapes = storage.root.get("shapes") as LiveMap<LiveObject>;
  const shape = shapes.get(id) as LiveObject;
  shape.update(props); // cleaner than multiple .set() calls
}, []);

// Usage
updateShape("shape-1", { x: 200, y: 300, fill: "#ef4444" });
```

### Undo/redo is automatic

Every CRDT mutation automatically captures inverse operations. Pair with `useHistory` for full undo/redo support:

```tsx
import { useHistory, useMutation } from "@waits/lively-react";

function Canvas() {
  const { undo, redo, canUndo, canRedo } = useHistory();

  const deleteShape = useMutation(({ storage }, id: string) => {
    const shapes = storage.root.get("shapes") as LiveMap<LiveObject>;
    shapes.delete(id);
  }, []);

  // Undo after delete restores the shape with all its properties.
  // No manual snapshot logic required.
}
```

See [`use-history.md`](./use-history.md) for full undo/redo documentation.

---

## Common Pitfalls

### Forgetting to handle `null`

`useStorage` returns `null` while loading. Calling methods on `null` crashes your component.

```tsx
// Bad -- crashes on first render
const count = useStorage((root) => root.get("count")) as number;
return <div>{count + 1}</div>;

// Good
const count = useStorage((root) => root.get("count"));
if (count === null) return <div>Loading...</div>;
return <div>{(count as number) + 1}</div>;
```

### Mutating outside `useMutation`

Direct CRDT mutations outside of `useMutation` or `room.batch()` are not batched. Each call is a separate network message and a separate undo step.

### Returning new references from selectors

Selectors that always return a new array or object bypass the shallow equality check, causing infinite re-renders.

```tsx
// Bad -- new array reference every time
const todos = useStorage((root) => {
  return [...(root.get("items") as LiveList).toArray()];
});

// Better -- toArray() returns a new array but the shallow check
// compares elements, so it only re-renders when items actually change
const todos = useStorage((root) => {
  return (root.get("items") as LiveList).toArray();
});
```

### Missing keys in `initialStorage`

If you access a key that does not exist on the root, `get()` returns `undefined`. This is not an error at the CRDT level, but your selector or mutation may throw when you try to call methods on `undefined`.
