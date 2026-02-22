# @waits/lively-storage

CRDT storage types for Lively real-time collaboration. Provides `LiveObject`, `LiveMap`, and `LiveList` — conflict-free replicated data types with Last-Writer-Wins (LWW) conflict resolution via Lamport clocks.

## Installation

```bash
bun add @waits/lively-storage
```

## API

### LiveObject\<T\>

Key-value store with per-field LWW conflict resolution.

```ts
import { LiveObject } from "@waits/lively-storage";

const obj = new LiveObject({ name: "Alice", score: 0 });
obj.get("name");        // "Alice"
obj.set("score", 42);
obj.update({ name: "Bob", score: 100 });
obj.toObject();         // { name: "Bob", score: 100 }
obj.toImmutable();      // Readonly<T>, cached until next mutation
```

### LiveMap\<V\>

String-keyed map with tombstone-based deletion.

```ts
import { LiveMap } from "@waits/lively-storage";

const map = new LiveMap<number>();
map.set("a", 1);
map.get("a");           // 1
map.delete("a");
map.has("a");           // false
map.size;               // 0
map.entries();          // IterableIterator
map.toImmutable();      // ReadonlyMap<string, V>
```

### LiveList\<T\>

Ordered list using fractional indexing for concurrent inserts.

```ts
import { LiveList } from "@waits/lively-storage";

const list = new LiveList<string>();
list.push("a");
list.insert("b", 0);   // insert at index
list.move(0, 1);        // reorder
list.delete(0);
list.get(0);            // "a"
list.toArray();         // ["a"]
list.toImmutable();     // readonly T[]
```

### StorageDocument

Manages the CRDT tree, op routing, and subscriptions.

```ts
import { StorageDocument, LiveObject } from "@waits/lively-storage";

const root = new LiveObject({ counter: 0, items: new LiveMap() });
const doc = new StorageDocument(root);

// Serialize/deserialize for snapshots
const snapshot = doc.serialize();
const doc2 = StorageDocument.deserialize(snapshot);

// Apply remote ops
doc.applyOps(ops);

// Subscribe to changes
const unsub = doc.subscribe(root, () => console.log("changed"));
const unsubDeep = doc.subscribe(root, () => console.log("deep"), { isDeep: true });

// Hook into generated ops
doc.setOnOpsGenerated((ops) => sendToServer(ops));
```

### LamportClock

Logical clock for causal ordering.

```ts
import { LamportClock } from "@waits/lively-storage";

const clock = new LamportClock();
clock.tick();       // 1
clock.tick();       // 2
clock.merge(5);     // max(2, 5) + 1 = 6
clock.value;        // 6
```

### Fractional Indexing

Generates sort keys for ordered lists without renumbering.

```ts
import { generateKeyBetween, generateNKeysBetween } from "@waits/lively-storage";

const a = generateKeyBetween(null, null);      // middle key
const b = generateKeyBetween(a, null);          // after a
const mid = generateKeyBetween(a, b);           // between a and b
const keys = generateNKeysBetween(a, b, 3);     // 3 keys between a and b
```

## Wire Protocol

```
Client → Server:
  { type: "storage:init", root: SerializedCrdt }
  { type: "storage:ops",  ops: StorageOp[] }

Server → Client:
  { type: "storage:init", root: SerializedCrdt | null }
  { type: "storage:ops",  ops: StorageOp[], clock: number }
```
