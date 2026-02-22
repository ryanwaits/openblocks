# `useLiveState`

Ephemeral shared state for all clients in a room. Think `useState`, but every participant sees the same value in real time. When the last client disconnects, the state is gone — nothing is persisted to storage or a database.

Conflict resolution is **last-writer-wins (LWW)** based on timestamps. Updates are debounced (default 50ms) to avoid flooding the network.

---

## API Reference

### `useLiveState<T>(key, initialValue, opts?)`

The primary hook. Returns a `[value, setter]` tuple, just like `useState`.

| Param | Type | Description |
|-------|------|-------------|
| `key` | `string` | Unique key identifying this piece of shared state |
| `initialValue` | `T` | Fallback value used until the first server update arrives |
| `opts.syncDuration` | `number` | Debounce interval in ms before sending to the server. Default: `50` |

**Returns:** `[T, (value: T | ((prev: T) => T)) => void]`

```tsx
const [slide, setSlide] = useLiveState("currentSlide", 0);
```

> The setter supports both direct values and updater functions, identical to React's `useState`.

---

### `useLiveStateData<T>(key)`

Read-only subscription. Returns the current value for `key`, or `undefined` if no value has been set.

| Param | Type | Description |
|-------|------|-------------|
| `key` | `string` | The state key to subscribe to |

**Returns:** `T | undefined`

```tsx
const slide = useLiveStateData<number>("currentSlide");
```

> Use this when a component only *displays* shared state but never writes to it. Avoids re-renders caused by a setter reference changing.

---

### `useSetLiveState<T>(key)`

Write-only setter. Returns a stable function reference that sets the value for `key`.

| Param | Type | Description |
|-------|------|-------------|
| `key` | `string` | The state key to write to |

**Returns:** `(value: T, opts?: { merge?: boolean }) => void`

```tsx
const setSlide = useSetLiveState<number>("currentSlide");
```

The optional `{ merge: true }` performs a **shallow merge** on the server when both the existing value and the new value are objects. This is useful for updating a subset of fields without clobbering the rest:

```tsx
const setGameState = useSetLiveState<{ turn: number; phase: string }>("game");

// Only updates `phase`, preserves `turn`
setGameState({ phase: "scoring" }, { merge: true });
```

---

## When to Use It

### **Presentation mode**

One user controls which slide (or page, or section) everyone else sees. The whole point is synchronized viewing — if the presenter advances, everyone follows. Ephemeral is fine because the slide deck itself is persisted elsewhere; the "current position" is transient.

```tsx
function PresenterControls() {
  const [slide, setSlide] = useLiveState("currentSlide", 0);

  return (
    <div>
      <span>Slide {slide + 1}</span>
      <button onClick={() => setSlide((s) => Math.max(0, s - 1))}>Prev</button>
      <button onClick={() => setSlide((s) => s + 1)}>Next</button>
    </div>
  );
}

function AudienceView({ slides }: { slides: ReactNode[] }) {
  const slide = useLiveStateData<number>("currentSlide");
  return <div>{slides[slide ?? 0]}</div>;
}
```

---

### **Shared timer or game state**

A countdown timer, the current turn, or a round number. Everyone needs to see the same value, but once the game session ends the data is irrelevant.

```tsx
function TurnTracker() {
  const [turn, setTurn] = useLiveState("currentTurn", 0);
  const players = ["Alice", "Bob", "Carol"];

  return (
    <div>
      <p>Current turn: {players[turn % players.length]}</p>
      <button onClick={() => setTurn((t) => t + 1)}>
        Next turn
      </button>
    </div>
  );
}
```

---

### **"Someone is typing" indicator**

Classic collaborative UX. Ephemeral by nature — no one cares who was typing an hour ago.

```tsx
function TypingIndicator() {
  const typingUsers = useLiveStateData<Record<string, boolean>>("typing");

  const active = typingUsers
    ? Object.entries(typingUsers).filter(([, v]) => v).map(([name]) => name)
    : [];

  if (active.length === 0) return null;
  return <p>{active.join(", ")} typing...</p>;
}

function ChatInput({ userId }: { userId: string }) {
  const setTyping = useSetLiveState<Record<string, boolean>>("typing");

  return (
    <input
      onFocus={() => setTyping({ [userId]: true }, { merge: true })}
      onBlur={() => setTyping({ [userId]: false }, { merge: true })}
    />
  );
}
```

> Note the use of `{ merge: true }` so each user only updates their own key within the shared object.

---

### **Collaborative selection / highlight**

"User X is looking at row 5" or "User Y selected the intro paragraph." Lets everyone see where attention is focused without persisting that attention state.

```tsx
function DataTable({ rows }: { rows: Row[] }) {
  const [selectedRow, setSelectedRow] = useLiveState<string | null>(
    "selectedRow",
    null
  );

  return (
    <table>
      {rows.map((row) => (
        <tr
          key={row.id}
          className={row.id === selectedRow ? "ring-2 ring-blue-500" : ""}
          onClick={() => setSelectedRow(row.id)}
        >
          <td>{row.name}</td>
        </tr>
      ))}
    </table>
  );
}
```

---

## When NOT to Use It

### **Per-user view preferences**

Filter tabs, sort order, dark mode, sidebar collapsed state. These are **local to each user**. You do not want User A switching to "dark mode" and having it flip for User B. Use plain `useState` (or a local store) instead.

```tsx
// BAD -- every user shares the same filter
const [filter, setFilter] = useLiveState("filter", "all");

// GOOD -- each user has their own filter
const [filter, setFilter] = useState("all");
```

---

### **Data that must survive a page refresh or empty room**

If the data disappearing when the last user leaves is a **bug**, not a feature, use persisted CRDT storage instead. Examples: document content, task lists, canvas objects.

```tsx
// BAD -- items vanish when the room empties
const [todos, setTodos] = useLiveState("todos", []);

// GOOD -- persisted via CRDT storage
const todos = useStorage((root) => root.get("todos"));
const addTodo = useMutation((storage, text: string) => {
  storage.get("todos").push(text);
});
```

---

### **High-frequency positional updates (60fps)**

Mouse position, drag coordinates, pointer trails. These need throttled binary-friendly channels, not debounced JSON messages. Lively has dedicated cursor tracking for this.

```tsx
// BAD -- 50ms debounce drops frames, JSON overhead
const [pos, setPos] = useLiveState("mousePos", { x: 0, y: 0 });
onMouseMove = (e) => setPos({ x: e.clientX, y: e.clientY });

// GOOD -- use the built-in cursor system
const cursors = useCursors();
```

---

## Patterns & Tips

### Updater function for safe concurrent updates

When multiple clients might update the same key simultaneously, use the updater function form to read the latest local value before writing:

```tsx
const [count, setCount] = useLiveState("counter", 0);

// Safe — reads the latest value before incrementing
setCount((prev) => prev + 1);

// Risky — `count` might be stale from a previous render
setCount(count + 1);
```

> This reads from a local ref (`latestRef`), so it always reflects the most recent value the client has seen, even between React renders.

---

### Split readers and writers

| Hook | Re-renders on | Good for |
|------|--------------|----------|
| `useLiveState` | Value changes | Components that both read and write |
| `useLiveStateData` | Value changes | Display-only components (no setter in scope) |
| `useSetLiveState` | Never (stable ref) | Buttons, triggers, event handlers that only write |

Splitting avoids unnecessary re-renders. A toolbar button that sets the current slide does not need to re-render every time the slide changes:

```tsx
// This component never re-renders due to slide changes
function JumpToEndButton({ totalSlides }: { totalSlides: number }) {
  const setSlide = useSetLiveState<number>("currentSlide");
  return <button onClick={() => setSlide(totalSlides - 1)}>Jump to end</button>;
}
```

---

### Tuning the debounce

The `syncDuration` option on `useLiveState` controls how long the hook waits after the last call before sending the update over the wire.

| Value | Use case |
|-------|----------|
| `0` | Immediate send. Use for discrete events (button clicks, toggle switches). |
| `50` (default) | Good balance for most interactive state. |
| `150-300` | Text input, search queries. Reduces traffic while typing. |
| `500+` | Rarely needed. Consider whether this should be local state instead. |

```tsx
// Immediate — user clicks a button, everyone should see it now
const [phase, setPhase] = useLiveState("phase", "lobby", { syncDuration: 0 });

// Slower debounce — search box that filters a shared view
const [query, setQuery] = useLiveState("searchQuery", "", { syncDuration: 200 });
```

---

### Merge mode for partial object updates

When the state value is an object and you only want to update some fields, pass `{ merge: true }` to the setter returned by `useSetLiveState`. The server performs a shallow merge (`{ ...existing, ...incoming }`) so other fields are preserved.

```tsx
const setState = useSetLiveState<{ round: number; phase: string; timer: number }>("game");

// Only touches `timer`, leaves `round` and `phase` intact
setState({ timer: 30 }, { merge: true });
```

> Merge is only available on `useSetLiveState`. The setter from `useLiveState` always replaces the full value. If you need merge semantics, use `useSetLiveState` directly.

---

### Wire protocol (internals)

For contributors or anyone debugging network traffic:

| Message | Direction | Payload |
|---------|-----------|---------|
| `state:update` | Client to server | `{ type, key, value, timestamp, merge? }` |
| `state:update` | Server to all clients | `{ type, key, value, timestamp, userId }` |
| `state:init` | Server to joining client | `{ type, states: Record<string, { value, timestamp, userId }> }` |

The server applies LWW: an incoming update is accepted only if its `timestamp >= existing.timestamp`. Rejected updates are silently dropped. On acceptance, the server broadcasts the new value (post-merge if applicable) to all connected clients, including the sender.
