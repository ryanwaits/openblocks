# CLI

`@waits/openblocks-cli` — local dev server with room persistence and inspection tools.

```bash
npx openblocks dev
```

---

## `openblocks dev`

Starts a local OpenBlocks WebSocket server with automatic room persistence.

```bash
openblocks dev [options]
```

### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-p, --port <number>` | `number` | `1999` | WebSocket server port. |
| `--data-dir <path>` | `string` | `.openblocks` | Directory for persisted room data. |
| `--reset` | `boolean` | `false` | Clear all persisted data before starting. |

### Persistence

Room state is automatically saved to `<data-dir>/rooms/` as JSON files. On restart, rooms are restored from disk — no data loss between sessions.

Writes are debounced (200ms) to avoid excessive disk I/O during rapid edits.

### Keyboard Shortcuts

When running in a TTY, the dev server accepts these keys:

| Key | Action |
|-----|--------|
| `q` | Quit (flushes pending writes first) |
| `Ctrl+C` | Quit (same as `q`) |
| `c` | Clear terminal and reprint banner |

### Example

```bash
# Start on port 3000 with custom data directory
openblocks dev --port 3000 --data-dir ./my-data

# Start fresh — wipe all rooms
openblocks dev --reset
```

---

## `openblocks rooms`

Manage persisted room data. All subcommands accept `--data-dir` (default `.openblocks`).

### `rooms list`

List all persisted rooms with update time and file size.

```bash
openblocks rooms list [--data-dir <path>]
```

Output:

```
Room          Updated       Size
──────────────────────────────────
my-room       3m ago        2.1 KB
editor-abc    1h ago        8.4 KB

2 rooms
```

### `rooms clear [roomId]`

Clear persisted data. Pass a `roomId` to clear a single room, or omit to clear all (with confirmation prompt).

```bash
# Clear a specific room
openblocks rooms clear my-room

# Clear all rooms (prompts y/N)
openblocks rooms clear
```

### `rooms inspect <roomId>`

Inspect the persisted CRDT tree for a room. Prints a colorized tree view showing `LiveObject`, `LiveMap`, and `LiveList` nodes with their values.

```bash
openblocks rooms inspect my-room
```

Output:

```
Room: my-room

LiveObject {
  counter:
    LiveObject {
      value: 42
    }
}
```

---

## Connecting Your App

Point your `OpenBlocksClient` at the dev server:

```ts
import { OpenBlocksClient } from "@waits/openblocks-client";

const client = new OpenBlocksClient({
  serverUrl: "ws://localhost:1999",
});
```

See the [Getting Started guide](./getting-started.md) for full setup instructions.
