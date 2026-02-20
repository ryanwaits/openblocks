# CRDT Shorthand Hooks

Convenience hooks that return **CRDT instances** (`LiveObject`, `LiveMap`, `LiveList`) directly from a top-level storage key. These are thin wrappers around `useStorage` that eliminate the boilerplate of writing a selector for the most common access pattern: reading a single key off the storage root.

The returned values are live CRDT objects -- use `.get()`, `.set()`, `.toArray()`, etc. to read and mutate them. Mutations must be inside `useMutation` or `useBatch`.

---

## API Reference

| Hook | Signature | Returns | Re-renders when... | Import |
|------|-----------|---------|---------------------|--------|
| `useObject<T>(key)` | `(key: string) => LiveObject<T> \| null` | `LiveObject<T> \| null` | Any field on the object changes | `@waits/openblocks-react` |
| `useMap<V>(key)` | `(key: string) => LiveMap<string, V> \| null` | `LiveMap<string, V> \| null` | Any entry is set or deleted | `@waits/openblocks-react` |
| `useList<T>(key)` | `(key: string) => LiveList<T> \| null` | `LiveList<T> \| null` | Any item is pushed, inserted, deleted, or moved | `@waits/openblocks-react` |
| `useObjectSuspense<T>(key)` | `(key: string) => LiveObject<T>` | `LiveObject<T>` | Same as `useObject` | `@waits/openblocks-react/suspense` |
| `useMapSuspense<V>(key)` | `(key: string) => LiveMap<string, V>` | `LiveMap<string, V>` | Same as `useMap` | `@waits/openblocks-react/suspense` |
| `useListSuspense<T>(key)` | `(key: string) => LiveList<T>` | `LiveList<T>` | Same as `useList` | `@waits/openblocks-react/suspense` |

All hooks must be called inside a `<RoomProvider>`.

> **Key distinction:** These return **CRDT instances**, not plain JS snapshots. You interact with the returned value through CRDT methods (`.get()`, `.set()`, `.push()`, `.delete()`, etc.), not by reading properties directly.

---

## `useObject<T>(key)`

Returns a `LiveObject<T>` stored at the given top-level key on the storage root. Returns `null` while storage is loading.

### Signature

```ts
function useObject<T extends Record<string, unknown>>(key: string): LiveObject<T> | null
```

| Param | Type | Description |
|-------|------|-------------|
| `key` | `string` | Top-level key on the storage root |
| **Returns** | `LiveObject<T> \| null` | `null` while loading, then the CRDT instance |

### Example

```tsx
import { useObject, useMutation } from "@waits/openblocks-react";

function ThemeDisplay() {
  const settings = useObject<{ theme: string; fontSize: number }>("settings");

  if (settings === null) return <div>Loading...</div>;

  return (
    <div>
      <p>Theme: {settings.get("theme")}</p>
      <p>Font size: {settings.get("fontSize")}</p>
    </div>
  );
}
```

### Equivalent `useStorage` call

```ts
// useObject("settings") is shorthand for:
const settings = useStorage((root) => root.get("settings") as LiveObject<Settings>) ?? null;
```

---

## `useMap<V>(key)`

Returns a `LiveMap<string, V>` stored at the given top-level key on the storage root. Returns `null` while storage is loading.

### Signature

```ts
function useMap<V>(key: string): LiveMap<string, V> | null
```

| Param | Type | Description |
|-------|------|-------------|
| `key` | `string` | Top-level key on the storage root |
| **Returns** | `LiveMap<string, V> \| null` | `null` while loading, then the CRDT instance |

### Example

```tsx
import { useMap } from "@waits/openblocks-react";

function UserCount() {
  const users = useMap<{ name: string; role: string }>("users");

  if (users === null) return null;

  return <span>{users.size} users online</span>;
}
```

### Equivalent `useStorage` call

```ts
// useMap("users") is shorthand for:
const users = useStorage((root) => root.get("users") as LiveMap<string, UserData>) ?? null;
```

---

## `useList<T>(key)`

Returns a `LiveList<T>` stored at the given top-level key on the storage root. Returns `null` while storage is loading.

### Signature

```ts
function useList<T>(key: string): LiveList<T> | null
```

| Param | Type | Description |
|-------|------|-------------|
| `key` | `string` | Top-level key on the storage root |
| **Returns** | `LiveList<T> \| null` | `null` while loading, then the CRDT instance |

### Example

```tsx
import { useList } from "@waits/openblocks-react";
import type { LiveObject } from "@waits/openblocks-react";

function ItemCount() {
  const items = useList<LiveObject>("items");

  if (items === null) return null;

  return <span>{items.length} items</span>;
}
```

### Equivalent `useStorage` call

```ts
// useList("items") is shorthand for:
const items = useStorage((root) => root.get("items") as LiveList<LiveObject>) ?? null;
```

---

## Suspense Variants

Suspense versions never return `null`. They throw a promise while storage is loading, letting React's `<Suspense>` boundary handle the loading state. Import from the `/suspense` sub-path.

```ts
import {
  useObjectSuspense,
  useMapSuspense,
  useListSuspense,
} from "@waits/openblocks-react/suspense";
```

| Standard Hook | Suspense Hook | Return Type Difference |
|---------------|---------------|----------------------|
| `useObject<T>(key)` | `useObjectSuspense<T>(key)` | `LiveObject<T> \| null` to `LiveObject<T>` |
| `useMap<V>(key)` | `useMapSuspense<V>(key)` | `LiveMap<string, V> \| null` to `LiveMap<string, V>` |
| `useList<T>(key)` | `useListSuspense<T>(key)` | `LiveList<T> \| null` to `LiveList<T>` |

**Throws:**
- Suspends (throws a Promise) if storage has not initialized yet
- `Error("useStorageSuspense cannot be used during SSR")` if called during server-side rendering

### Example

```tsx
import { Suspense } from "react";
import { useObjectSuspense } from "@waits/openblocks-react/suspense";

function SettingsPanel() {
  // Never null -- suspends until storage is ready
  const settings = useObjectSuspense<{ theme: string }>("settings");
  return <p>Theme: {settings.get("theme")}</p>;
}

function App() {
  return (
    <Suspense fallback={<div>Loading settings...</div>}>
      <SettingsPanel />
    </Suspense>
  );
}
```

---

## Real-World Use Cases

### 1. Settings panel with `useObject`

A `LiveObject` for app-wide settings. Every connected user sees the same config and can update individual fields without clobbering others.

```tsx
import { useObject, useMutation } from "@waits/openblocks-react";

interface AppSettings {
  theme: "light" | "dark";
  fontSize: number;
  language: string;
  sidebarOpen: boolean;
}

function SettingsPanel() {
  const settings = useObject<AppSettings>("settings");

  const updateSetting = useMutation(
    ({ storage }, key: keyof AppSettings, value: AppSettings[typeof key]) => {
      const s = storage.root.get("settings") as LiveObject;
      s.set(key, value);
    },
    []
  );

  if (settings === null) return <div className="animate-pulse h-48" />;

  return (
    <div className="space-y-4 p-6 bg-white rounded-lg shadow">
      <h2 className="text-lg font-semibold">Settings</h2>

      <label className="flex items-center justify-between">
        <span className="text-sm text-gray-700">Theme</span>
        <select
          value={settings.get("theme")}
          onChange={(e) => updateSetting("theme", e.target.value as "light" | "dark")}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>

      <label className="flex items-center justify-between">
        <span className="text-sm text-gray-700">Font size</span>
        <input
          type="range"
          min={10}
          max={24}
          value={settings.get("fontSize")}
          onChange={(e) => updateSetting("fontSize", Number(e.target.value))}
          className="w-32"
        />
        <span className="text-sm text-gray-500 w-8 text-right">
          {settings.get("fontSize")}px
        </span>
      </label>

      <label className="flex items-center justify-between">
        <span className="text-sm text-gray-700">Sidebar</span>
        <button
          onClick={() => updateSetting("sidebarOpen", !settings.get("sidebarOpen"))}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings.get("sidebarOpen") ? "bg-blue-600" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
              settings.get("sidebarOpen") ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </label>
    </div>
  );
}
```

---

### 2. User registry with `useMap`

A `LiveMap` keyed by user ID, storing profile data. Users can join, update their info, and leave. The map grows and shrinks dynamically.

```tsx
import { useMap, useMutation, LiveObject } from "@waits/openblocks-react";

interface UserProfile {
  name: string;
  avatar: string;
  role: "viewer" | "editor" | "admin";
  joinedAt: number;
}

function UserRegistry({ currentUserId }: { currentUserId: string }) {
  const users = useMap<LiveObject<UserProfile>>("users");

  const registerUser = useMutation(
    ({ storage }, userId: string, name: string, avatar: string) => {
      const map = storage.root.get("users") as LiveMap;
      map.set(
        userId,
        new LiveObject({ name, avatar, role: "viewer", joinedAt: Date.now() })
      );
    },
    []
  );

  const promoteUser = useMutation(({ storage }, userId: string) => {
    const map = storage.root.get("users") as LiveMap;
    const user = map.get(userId) as LiveObject;
    user.set("role", "editor");
  }, []);

  const removeUser = useMutation(({ storage }, userId: string) => {
    const map = storage.root.get("users") as LiveMap;
    map.delete(userId);
  }, []);

  if (users === null) return <div>Loading users...</div>;

  const entries: { id: string; profile: LiveObject<UserProfile> }[] = [];
  users.forEach((profile, id) => entries.push({ id, profile }));

  return (
    <div className="divide-y divide-gray-100">
      {entries.map(({ id, profile }) => (
        <div key={id} className="flex items-center gap-3 py-3 px-4">
          <img
            src={profile.get("avatar")}
            alt={profile.get("name")}
            className="h-8 w-8 rounded-full"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile.get("name")}</p>
            <p className="text-xs text-gray-500">{profile.get("role")}</p>
          </div>
          {id !== currentUserId && (
            <div className="flex gap-1">
              <button
                onClick={() => promoteUser(id)}
                className="text-xs text-blue-600 hover:underline"
              >
                Promote
              </button>
              <button
                onClick={() => removeUser(id)}
                className="text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

### 3. Todo list with `useList`

A `LiveList` of `LiveObjects` for ordered tasks. Supports add, toggle, delete, and drag-to-reorder.

```tsx
import { useList, useMutation, LiveObject } from "@waits/openblocks-react";
import { useState } from "react";

interface TodoItem {
  text: string;
  completed: boolean;
  createdAt: number;
}

function TodoApp() {
  const todos = useList<LiveObject<TodoItem>>("todos");
  const [input, setInput] = useState("");

  const addTodo = useMutation(({ storage }, text: string) => {
    const list = storage.root.get("todos") as LiveList;
    list.push(new LiveObject({ text, completed: false, createdAt: Date.now() }));
  }, []);

  const toggleTodo = useMutation(({ storage }, index: number) => {
    const list = storage.root.get("todos") as LiveList;
    const todo = list.get(index) as LiveObject;
    todo.set("completed", !todo.get("completed"));
  }, []);

  const deleteTodo = useMutation(({ storage }, index: number) => {
    const list = storage.root.get("todos") as LiveList;
    list.delete(index);
  }, []);

  const moveTodo = useMutation(({ storage }, from: number, to: number) => {
    const list = storage.root.get("todos") as LiveList;
    list.move(from, to);
  }, []);

  if (todos === null) return <div className="animate-pulse h-64" />;

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) {
            addTodo(input.trim());
            setInput("");
          }
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add a task..."
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Add
        </button>
      </form>

      <ul className="space-y-1">
        {todos.map((todo, i) => (
          <li
            key={i}
            className="flex items-center gap-2 rounded px-3 py-2 hover:bg-gray-50"
          >
            <input
              type="checkbox"
              checked={todo.get("completed")}
              onChange={() => toggleTodo(i)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span
              className={`flex-1 text-sm ${
                todo.get("completed") ? "line-through text-gray-400" : ""
              }`}
            >
              {todo.get("text")}
            </span>
            {i > 0 && (
              <button
                onClick={() => moveTodo(i, i - 1)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Up
              </button>
            )}
            <button
              onClick={() => deleteTodo(i)}
              className="text-xs text-red-400 hover:text-red-600"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      <p className="text-xs text-gray-500">
        {todos.length} tasks, {todos.toArray().filter((t) => t.get("completed")).length} completed
      </p>
    </div>
  );
}
```

---

### 4. Kanban board combining all three

A `LiveObject` for board metadata, a `LiveMap` for columns, and a `LiveList` inside each column for ordered cards. Demonstrates how the shorthand hooks compose with `useStorage` for nested reads.

```tsx
import { useObject, useMap, useMutation, LiveObject, LiveList } from "@waits/openblocks-react";
import { useStorage } from "@waits/openblocks-react";

interface BoardMeta {
  title: string;
  createdAt: number;
}

interface Card {
  id: string;
  title: string;
  assignee: string;
}

function KanbanBoard() {
  const board = useObject<BoardMeta>("board");
  const columns = useMap<LiveList<LiveObject<Card>>>("columns");

  // For ordered column names, read from the board meta
  const columnOrder = useStorage((root) => {
    const b = root.get("board") as LiveObject;
    return b.get("columnOrder") as string[];
  });

  const addCard = useMutation(
    ({ storage }, columnId: string, title: string) => {
      const cols = storage.root.get("columns") as LiveMap;
      const column = cols.get(columnId) as LiveList;
      column.push(
        new LiveObject({ id: crypto.randomUUID(), title, assignee: "" })
      );
    },
    []
  );

  const moveCard = useMutation(
    ({ storage }, fromCol: string, fromIdx: number, toCol: string, toIdx: number) => {
      const cols = storage.root.get("columns") as LiveMap;
      const fromList = cols.get(fromCol) as LiveList;
      const card = fromList.get(fromIdx) as LiveObject;

      if (fromCol === toCol) {
        fromList.move(fromIdx, toIdx);
      } else {
        fromList.delete(fromIdx);
        const toList = cols.get(toCol) as LiveList;
        toList.insert(
          new LiveObject({
            id: card.get("id"),
            title: card.get("title"),
            assignee: card.get("assignee"),
          }),
          toIdx
        );
      }
    },
    []
  );

  if (board === null || columns === null || columnOrder === null) {
    return <div className="animate-pulse h-96" />;
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">{board.get("title")}</h1>
      <div className="flex gap-4 overflow-x-auto">
        {columnOrder.map((colId) => {
          const cards = columns.get(colId);
          if (!cards) return null;

          return (
            <div
              key={colId}
              className="w-72 shrink-0 rounded-lg bg-gray-100 p-3"
            >
              <h3 className="text-sm font-semibold text-gray-700 mb-2">{colId}</h3>
              <div className="space-y-2">
                {cards.map((card, i) => (
                  <div
                    key={card.get("id")}
                    className="rounded bg-white p-3 shadow-sm text-sm"
                  >
                    <p className="font-medium">{card.get("title")}</p>
                    {card.get("assignee") && (
                      <p className="text-xs text-gray-500 mt-1">
                        {card.get("assignee")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => addCard(colId, "New card")}
                className="mt-2 w-full rounded py-1 text-xs text-gray-500 hover:bg-gray-200"
              >
                + Add card
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

### 5. Suspense dashboard

All three suspense variants in a dashboard layout. Each panel suspends independently behind its own `<Suspense>` boundary.

```tsx
import { Suspense } from "react";
import {
  useObjectSuspense,
  useMapSuspense,
  useListSuspense,
  useMutation,
} from "@waits/openblocks-react/suspense";

function PanelSkeleton() {
  return (
    <div className="animate-pulse space-y-3 rounded-lg border border-gray-200 p-4">
      <div className="h-4 bg-gray-200 rounded w-1/3" />
      <div className="h-4 bg-gray-200 rounded w-2/3" />
      <div className="h-4 bg-gray-200 rounded w-1/2" />
    </div>
  );
}

// -- Panel 1: Project settings via useObjectSuspense --

interface ProjectSettings {
  name: string;
  visibility: "public" | "private";
  maxMembers: number;
}

function SettingsPanel() {
  const settings = useObjectSuspense<ProjectSettings>("projectSettings");

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Project</h3>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-500">Name</dt>
          <dd>{settings.get("name")}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">Visibility</dt>
          <dd>{settings.get("visibility")}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">Max members</dt>
          <dd>{settings.get("maxMembers")}</dd>
        </div>
      </dl>
    </div>
  );
}

// -- Panel 2: Team members via useMapSuspense --

interface Member {
  name: string;
  role: string;
}

function TeamPanel() {
  const members = useMapSuspense<LiveObject<Member>>("members");

  const entries: { id: string; name: string; role: string }[] = [];
  members.forEach((m, id) =>
    entries.push({ id, name: m.get("name"), role: m.get("role") })
  );

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Team ({members.size})
      </h3>
      <ul className="space-y-2">
        {entries.map((e) => (
          <li key={e.id} className="flex items-center justify-between text-sm">
            <span>{e.name}</span>
            <span className="text-xs text-gray-400">{e.role}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// -- Panel 3: Activity feed via useListSuspense --

interface Activity {
  message: string;
  timestamp: number;
}

function ActivityPanel() {
  const feed = useListSuspense<LiveObject<Activity>>("activityFeed");

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Activity ({feed.length})
      </h3>
      <ul className="space-y-2">
        {feed.map((entry, i) => (
          <li key={i} className="text-sm text-gray-600">
            <span>{entry.get("message")}</span>
            <span className="ml-2 text-xs text-gray-400">
              {new Date(entry.get("timestamp")).toLocaleTimeString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// -- Dashboard layout --

function Dashboard() {
  return (
    <div className="grid grid-cols-3 gap-4 p-6">
      <Suspense fallback={<PanelSkeleton />}>
        <SettingsPanel />
      </Suspense>
      <Suspense fallback={<PanelSkeleton />}>
        <TeamPanel />
      </Suspense>
      <Suspense fallback={<PanelSkeleton />}>
        <ActivityPanel />
      </Suspense>
    </div>
  );
}
```

> Each panel suspends independently. Panels whose storage keys resolve faster appear first while slower ones show the skeleton fallback.

---

## Patterns & Tips

### These return CRDT instances, not snapshots

The value you get back is a **live CRDT object** with methods like `.get()`, `.set()`, `.push()`, `.delete()`. It is NOT a plain JS object. You interact with it through its API.

```tsx
const settings = useObject<{ theme: string }>("settings");

// Correct -- use CRDT methods
const theme = settings?.get("theme");

// Wrong -- settings is a LiveObject, not a plain object
// const theme = settings?.theme;  // undefined
```

---

### Mutations must be inside `useMutation` or `useBatch`

Even though you have a reference to the CRDT instance, do not call `.set()` directly in your render or event handlers. Wrap mutations in `useMutation` for proper batching, undo support, and load guards.

```tsx
const settings = useObject<{ theme: string }>("settings");

// Bad -- no batching, no undo grouping
function handleClick() {
  settings?.set("theme", "dark");
}

// Good
const setTheme = useMutation(({ storage }, theme: string) => {
  const s = storage.root.get("settings") as LiveObject;
  s.set("theme", theme);
}, []);
```

---

### Top-level keys only

These hooks read directly from the storage root. They do NOT support dotted paths or nested access.

```tsx
// Works -- "settings" is a top-level key
const settings = useObject("settings");

// Does NOT work -- no nested path support
// const theme = useObject("settings.theme");

// For nested access, use useStorage with a selector
const theme = useStorage((root) => {
  const settings = root.get("settings") as LiveObject;
  return settings.get("theme") as string;
});
```

---

### Handle the `null` loading state

The standard (non-Suspense) variants return `null` until storage initializes. Always guard against it.

```tsx
const settings = useObject<{ theme: string }>("settings");

// Bad -- crashes on first render
return <p>{settings.get("theme")}</p>;

// Good
if (settings === null) return <div>Loading...</div>;
return <p>{settings.get("theme")}</p>;
```

Or use the Suspense variants to eliminate null checks entirely.

---

### Pair with `useStorage` for derived values

These hooks return the raw CRDT instance. If you need a derived/computed value (e.g., count, filtered list, aggregation), use `useStorage` directly for better re-render performance.

```tsx
// Returns the whole LiveMap -- re-renders on ANY change to the map
const users = useMap<UserData>("users");
const count = users?.size; // works, but re-renders on every entry change

// Better -- only re-renders when the count actually changes
const count = useStorage((root) => {
  const users = root.get("users") as LiveMap;
  return users.size;
});
```

---

## When to Use These vs `useStorage`

### Use `useObject` / `useMap` / `useList` when:

- You need the **full CRDT instance** to call multiple methods (`.get()`, `.set()`, `.forEach()`, etc.)
- You are passing the CRDT to child components or mutation hooks
- Your component renders the entire object/map/list, not a derived subset
- You want **less boilerplate** than writing a selector

### Use `useStorage` directly when:

- You need a **derived or computed value** (count, filtered array, aggregation)
- You are reading **nested data** (e.g., `root.get("a").get("b").get("c")`)
- You want **fine-grained re-render control** via the selector
- You are selecting a **primitive** from inside a CRDT (e.g., just the `theme` string, not the whole settings object)

```tsx
// useObject: get the whole settings LiveObject
const settings = useObject<Settings>("settings");

// useStorage: get just the theme string (fewer re-renders)
const theme = useStorage((root) => {
  return (root.get("settings") as LiveObject).get("theme") as string;
});
```

---

## Source

- Standard hooks: [`packages/react/src/use-crdt-shortcuts.ts`](../../packages/react/src/use-crdt-shortcuts.ts)
- Suspense variants: [`packages/react/src/suspense.ts`](../../packages/react/src/suspense.ts) (bottom of file)
