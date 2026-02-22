# @waits/lively-yjs

Yjs provider that bridges an Lively `Room` to a `Y.Doc` for collaborative text editing. Used by `@waits/lively-react-tiptap` and `@waits/lively-react-codemirror` under the hood.

```bash
npm install @waits/lively-yjs yjs y-protocols
```

---

## Quick Start

```ts
import { LivelyYjsProvider } from "@waits/lively-yjs";

// `room` is an Lively Room instance (from client.joinRoom() or useRoom())
const provider = new LivelyYjsProvider(room);
provider.connect();

// Access the Y.Doc and Awareness
const ytext = provider.doc.getText("content");
const awareness = provider.awareness;

// Clean up
provider.destroy();
```

---

## API Reference

### Constructor

```ts
new LivelyYjsProvider(room: Room, options?: LivelyYjsProviderOptions)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `room` | `Room` | An Lively `Room` instance. The provider sends/receives Yjs updates over the room's message channel. |
| `options.doc` | `Y.Doc` | Existing Y.Doc to use. If omitted, a new one is created. |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `doc` | `Y.Doc` | The Yjs document. Read-only. |
| `awareness` | `Awareness` | Yjs Awareness instance for cursor/selection state. |
| `synced` | `boolean` | `true` after initial sync-step2 is received. |
| `connected` | `boolean` | `true` between `connect()` and `disconnect()`. |

### Methods

| Method | Description |
|--------|-------------|
| `connect()` | Start syncing. Subscribes to room messages, sends sync-step1, broadcasts awareness. No-op if already connected or destroyed. |
| `disconnect()` | Stop syncing. Removes awareness states, unsubscribes from room events. Keeps the Y.Doc intact. |
| `destroy()` | Disconnect + destroy awareness + clear event listeners. Cannot reconnect after this. |
| `on(event, callback)` | Subscribe to provider events. |
| `off(event, callback)` | Unsubscribe from provider events. |

### Events

| Event | Callback | Description |
|-------|----------|-------------|
| `sync` | `(synced: boolean) => void` | Fired when initial sync completes (sync-step2 received). |
| `awareness-update` | `() => void` | Fired when remote awareness state changes (cursor moves, user joins). |
| `status` | `(status: string) => void` | Fired on room connection status changes. |

---

## Wire Protocol

All Yjs data is base64-encoded and sent as room messages. The provider handles encoding/decoding internally.

| Message Type | Direction | Purpose |
|-------------|-----------|---------|
| `yjs:sync-step1` | Bidirectional | State vector exchange — "what do you have?" |
| `yjs:sync-step2` | Bidirectional | State diff — "here's what you're missing" |
| `yjs:update` | Bidirectional | Incremental document updates |
| `yjs:awareness` | Bidirectional | Cursor/selection state for collaborative editing |

### Sync Flow

```
Client A (new)                    Client B (existing)
    |                                  |
    |── yjs:sync-step1 (state vector) ─>|
    |                                  |
    |<─ yjs:sync-step2 (diff) ─────────|
    |                                  |
    |   (synced = true, emit "sync")   |
    |                                  |
    |── yjs:awareness ────────────────>|
    |<─ yjs:awareness ────────────────│|
```

After initial sync, incremental updates flow as `yjs:update` messages whenever either side modifies the Y.Doc.

---

## Integration with Editors

You typically don't use this package directly. Instead, use the editor-specific packages:

- **TipTap** — [`@waits/lively-react-tiptap`](./react-tiptap.md) provides `useLivelyExtension()` which creates and manages the provider automatically.
- **CodeMirror** — [`@waits/lively-react-codemirror`](./react-codemirror.md) provides `useLivelyCodeMirror()` which does the same.

### Manual Integration

If you're integrating with a different editor or need direct Y.Doc access:

```ts
import { LivelyYjsProvider } from "@waits/lively-yjs";
import * as Y from "yjs";

// Bring your own Y.Doc
const ydoc = new Y.Doc();
const provider = new LivelyYjsProvider(room, { doc: ydoc });

// Set awareness state for collaborative cursors
provider.awareness.setLocalStateField("user", {
  name: "Alice",
  color: "#e74c3c",
});

provider.connect();

// Use any Y.js shared type
const ytext = ydoc.getText("content");
const ymap = ydoc.getMap("metadata");

// Listen for sync
provider.on("sync", (synced) => {
  if (synced) console.log("Initial sync complete");
});
```

---

## Real-World Use Cases

- [nextjs-collab-editor](../examples/nextjs-collab-editor) — Notion-style rich text with TipTap
- [nextjs-notion-editor](../examples/nextjs-notion-editor) — Full Notion clone with slash commands and blocks
- [nextjs-markdown-editor](../examples/nextjs-markdown-editor) — Collaborative markdown with CodeMirror
