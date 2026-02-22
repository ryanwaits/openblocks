# `useHistory` -- Undo / Redo

Automatic undo/redo for any CRDT mutation. No manual tracking -- the SDK captures inverse operations whenever you mutate storage. Call `liveObject.set()`, `liveMap.delete()`, or `liveList.insert()` and the undo stack updates itself.

---

## API Reference

| Hook | Signature | Description |
|------|-----------|-------------|
| `useHistory()` | `() => { undo, redo, canUndo, canRedo }` | Convenience hook that combines all four hooks below into a single object. |
| `useUndo()` | `() => () => void` | Returns a stable callback that undoes the last operation (or batch). |
| `useRedo()` | `() => () => void` | Returns a stable callback that redoes the last undone operation. |
| `useCanUndo()` | `() => boolean` | Reactive boolean -- re-renders your component when undo availability changes. |
| `useCanRedo()` | `() => boolean` | Reactive boolean -- re-renders your component when redo availability changes. |

All hooks must be called inside a `<RoomProvider>`.

```tsx
import { useHistory } from "@waits/lively-react";

function Toolbar() {
  const { undo, redo, canUndo, canRedo } = useHistory();

  return (
    <>
      <button onClick={undo} disabled={!canUndo}>Undo</button>
      <button onClick={redo} disabled={!canRedo}>Redo</button>
    </>
  );
}
```

Or use the individual hooks when you only need a subset:

```tsx
import { useUndo, useCanUndo } from "@waits/lively-react";

function UndoButton() {
  const undo = useUndo();
  const canUndo = useCanUndo();
  return <button onClick={undo} disabled={!canUndo}>Undo</button>;
}
```

---

## How It Works (Under the Hood)

1. When you call `liveObject.set("color", "red")`, the SDK **snapshots the old value** (`"blue"`) before applying the mutation.
2. `computeInverseOp` produces the inverse operation: `{ type: "set", path, key: "color", value: "blue" }`. This is pushed onto the undo stack along with the forward op.
3. Calling `undo()` pops the entry off the undo stack, pushes it onto the redo stack, and **replays the inverse ops** through `storageDoc.applyLocalOps()`. The ops get fresh Lamport clocks so they win LWW conflict resolution.
4. Calling `redo()` pops from the redo stack, pushes back onto undo, and replays the **forward ops**.
5. Any new mutation **clears the redo stack** -- just like every text editor you have used.
6. `room.batch()` groups multiple ops into a single `HistoryEntry` so they undo/redo as one atomic step.

> **Inverse ops are computed for every CRDT method:** `LiveObject.set`, `LiveMap.set`, `LiveMap.delete`, `LiveList.insert`, `LiveList.delete`, and `LiveList.move`. No manual action recording needed.

---

## Batching

Multiple mutations inside `room.batch()` become a **single undo step**.

```tsx
import { useMutation } from "@waits/lively-react";

// useMutation automatically wraps your callback in room.batch()
const moveCard = useMutation(({ storage }, cardId: string, fromCol: string, toCol: string) => {
  const columns = storage.root.get("columns") as LiveMap;
  const fromList = columns.get(fromCol) as LiveList;
  const toList = columns.get(toCol) as LiveList;

  // Find and remove from source column
  const index = findCardIndex(fromList, cardId);
  const card = fromList.get(index);
  fromList.delete(index);

  // Insert into destination column
  toList.push(card);
}, []);
```

Because `useMutation` wraps the callback in `room.batch()`, the delete + insert above is a **single undo step**. Pressing undo moves the card back in one action.

If you are not using `useMutation`, call `room.batch()` directly:

```tsx
const room = useRoom();

room.batch(() => {
  liveObject.set("x", 200);
  liveObject.set("y", 300);
  liveObject.set("rotation", 45);
});
// All three .set() calls = one undo step
```

> **Without `batch()`**, each `.set()` in a loop is a separate undo step. The user would have to press Cmd+Z three times to undo a single drag operation.

---

## Real-World Use Cases

### 1. Whiteboard / Design Tool

Users drag, resize, and recolor objects constantly. Undo should reverse an entire drag operation, not each pixel of movement.

```tsx
import { useHistory, useMutation } from "@waits/lively-react";
import { useEffect } from "react";

function Canvas() {
  const { undo, redo } = useHistory();

  // Wire keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (e.metaKey && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  // Drag end commits the final position as a single batch
  const updatePosition = useMutation(({ storage }, id: string, x: number, y: number) => {
    const shapes = storage.root.get("shapes") as LiveMap;
    const shape = shapes.get(id) as LiveObject;
    shape.set("x", x);
    shape.set("y", y);
  }, []);

  return <div onPointerUp={(e) => updatePosition(selectedId, e.clientX, e.clientY)} />;
}
```

The `useMutation` wrapper batches `set("x")` and `set("y")` into one undo step -- undoing snaps the shape back to its original position.

---

### 2. Collaborative Document Editor

Text formatting changes -- bold, color, indent -- are captured automatically. `useMutation` + the SDK's inverse capture means zero extra work.

```tsx
const toggleBold = useMutation(({ storage }, blockId: string) => {
  const blocks = storage.root.get("blocks") as LiveMap;
  const block = blocks.get(blockId) as LiveObject;
  block.set("bold", !block.get("bold"));
}, []);

// That's it. Undo just works.
```

No action objects. No reducer. No manual snapshot diffing. The SDK recorded that `bold` was `false` before you set it to `true`, and undo sets it back.

---

### 3. Kanban Board

Dragging a card between columns involves two operations: delete from column A, insert into column B. These must undo as a single step.

```tsx
const moveCard = useMutation(({ storage }, cardId: string, from: string, to: string) => {
  const columns = storage.root.get("columns") as LiveMap;

  // Remove from source
  const fromList = columns.get(from) as LiveList;
  const idx = findIndex(fromList, cardId);
  fromList.delete(idx);

  // Add to destination
  const toList = columns.get(to) as LiveList;
  toList.push(new LiveObject({ id: cardId, title: "..." }));

  // Because useMutation wraps in batch(), this is ONE undo step.
  // Undo re-inserts into source column and removes from destination.
}, []);
```

> **Key insight:** The inverse ops are `unshift`ed during batch recording, so they replay in reverse order. The undo first removes from the destination, then re-inserts into the source -- the correct order.

---

### 4. Form Builder

Adding a field, reordering fields, deleting a field -- each action is one undo step.

```tsx
const addField = useMutation(({ storage }, fieldType: string) => {
  const fields = storage.root.get("fields") as LiveList;
  fields.push(new LiveObject({ type: fieldType, label: "", required: false }));
}, []);

const deleteField = useMutation(({ storage }, index: number) => {
  const fields = storage.root.get("fields") as LiveList;
  fields.delete(index);
}, []);

const reorderField = useMutation(({ storage }, from: number, to: number) => {
  const fields = storage.root.get("fields") as LiveList;
  fields.move(from, to);
}, []);

// Each of these produces a single undo step.
// Undo after deleteField re-inserts the field at its original position with all its data.
```

---

## Patterns & Tips

### Wire keyboard shortcuts in a `useEffect`

```tsx
const { undo, redo } = useHistory();

useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    const isMod = e.metaKey || e.ctrlKey;
    if (isMod && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      undo();
    }
    if (isMod && e.key === "z" && e.shiftKey) {
      e.preventDefault();
      redo();
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, [undo, redo]);
```

### Disable buttons with `canUndo` / `canRedo`

```tsx
const { undo, redo, canUndo, canRedo } = useHistory();

<button onClick={undo} disabled={!canUndo}>Undo</button>
<button onClick={redo} disabled={!canRedo}>Redo</button>
```

`useCanUndo` and `useCanRedo` use `useSyncExternalStore` internally, so your component only re-renders when the boolean actually changes.

### History is per-user only

You cannot undo another user's changes. Each client has its own `HistoryManager` instance tracking only its local mutations.

### Max history entries

The default cap is **100 entries**. When the undo stack exceeds this limit, the oldest entry is evicted (FIFO). This is configurable via `HistoryConfig`:

```ts
// In the storage layer
new HistoryManager({ maxEntries: 200 });
```

### History clears on disconnect/reconnect

When the connection drops and reconnects, the undo/redo stacks are cleared. Stale inverse ops could conflict with changes that arrived while disconnected.

---

## Common Pitfalls

### Don't call `undo()` inside a `useMutation`

`undo()` is a separate action that pops from the history stack. Calling it inside a mutation (which is batched) leads to unpredictable behavior. Keep undo/redo triggers in event handlers or effects, not in mutation callbacks.

```tsx
// Bad
const doSomething = useMutation(({ storage }) => {
  storage.root.set("x", 10);
  undo(); // Don't do this
}, []);

// Good
const updateX = useMutation(({ storage }) => {
  storage.root.set("x", 10);
}, []);

const handleClick = () => updateX();
const handleUndo = () => undo();
```

### Forgetting `room.batch()` in non-hook code

If you are not using `useMutation` and you mutate multiple fields in a loop, each `.set()` is a **separate undo step**. Wrap in `room.batch()`:

```tsx
// Bad -- 3 separate undo steps
liveObject.set("x", 100);
liveObject.set("y", 200);
liveObject.set("width", 50);

// Good -- 1 undo step
room.batch(() => {
  liveObject.set("x", 100);
  liveObject.set("y", 200);
  liveObject.set("width", 50);
});
```

### New mutations clear the redo stack

Just like any text editor: if you undo twice and then make a new edit, the two redo entries are gone. This is by design and matches user expectations, but can surprise you in tests.
