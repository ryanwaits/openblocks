# Architecture

## Package Dependency Graph

```
types (no deps)
  ↑
storage (types)
  ↑
client (storage, types)           server (storage, types, ws)
  ↑                                 ↑
react (client, types)             cli (server)
  ↑
ui (react, types)

yjs (client, y-protocols)
  ↑
react-tiptap (react, yjs, tiptap, y-prosemirror)
react-codemirror (react, yjs, codemirror, y-codemirror.next)
```

## Packages

### @waits/lively-types

Zero-dependency wire protocol and shared data structures.

**Key exports:**
- `PresenceUser` — `{ userId, displayName, color, connectedAt }`
- `CursorData` — `{ userId, displayName, color, x, y, lastUpdate, viewportPos?, viewportScale? }`
- `ConnectionStatus` — `"connecting" | "connected" | "reconnecting" | "disconnected"`
- `StorageOp` — union of `SetOp`, `DeleteOp`, `ListInsertOp`, `ListDeleteOp`, `ListMoveOp` (each with `path[]` and `clock`)
- `SerializedCrdt` — `SerializedLiveObject | SerializedLiveMap | SerializedLiveList | primitive`
- Wire messages: `StorageInitMessage`, `StorageOpsMessage`, `PresenceMessage`, `CursorUpdateMessage`, `ClientCursorMessage`

---

### @waits/lively-storage

Client-side CRDT data structures with conflict-free mutation semantics.

**Key exports:**
- `LiveObject<T>` — mutable key-value object. LWW per field via Lamport clock. Methods: `get()`, `set()`, `update()`, `toImmutable()`, `subscribe()`
- `LiveMap<V>` — unordered key-value map with tombstones. Methods: `get()`, `set()`, `delete()`, `has()`, `entries()`, `toImmutable()`
- `LiveList<T>` — ordered list using fractional indexing. Methods: `push()`, `insert()`, `delete()`, `move()`, `get()`, `toArray()`, `toImmutable()`
- `StorageDocument` — root container managing the CRDT tree, subscriptions, and op generation
- `generateKeyBetween(prev, next)` — fractional index utility for conflict-free ordering

**Conflict resolution:**
- LiveObject/LiveMap: LWW per field — higher Lamport clock wins
- LiveList: fractional index ordering (position-aware insertion, no conflicts)

**Subscriptions:** shallow (single node) or deep (node + all descendants via `isDeep: true`)

---

### @waits/lively-client

WebSocket connection management, room lifecycle, storage sync, presence & cursor relay.

**Key exports:**
- `LivelyClient` — entry point managing multiple rooms
  - `new LivelyClient({ serverUrl, reconnect?, maxRetries? })`
  - `joinRoom(roomId, { userId, displayName, cursorThrottleMs?, initialStorage? })`
  - `leaveRoom(roomId)`, `getRoom(roomId)`
- `Room` — a joined room with bidirectional sync
  - **Connection:** `connect()`, `disconnect()`, `getStatus()`
  - **Presence:** `getSelf()`, `getPresence()`, `getOthers()`
  - **Cursors:** `getCursors()`, `updateCursor(x, y, viewportPos?, viewportScale?)` (throttled, default 50ms)
  - **Storage:** `getStorage()` → `{ root: LiveObject }`
  - **Batching:** `batch(fn)` — groups all ops in `fn` into a single message
  - **Events:** `subscribe("status" | "presence" | "cursors" | "message", cb)` or `subscribe(crdt, cb, { isDeep? })`
- Re-exports: `LiveObject`, `LiveMap`, `LiveList`, `StorageDocument` from storage

**Reconnection:** exponential backoff (250ms base → 30s max) via `ConnectionManager`.

---

### @waits/lively-server

WebSocket server — room management, storage authority, presence/cursor relay.

**Key exports:**
- `LivelyServer` — HTTP + WebSocket server
  - Constructor config: `{ path?, auth?, roomConfig?, onMessage?, onJoin?, onLeave?, onStorageChange?, initialStorage? }`
  - `start(port?)`, `stop()`, `broadcastToRoom(roomId, data, excludeIds?)`
- `Room` (server-side) — tracks connections, manages shared `StorageDocument`
- `RoomManager` — room lifecycle. Empty rooms auto-clean after `cleanupTimeoutMs` (default 30s)

**Message handling:**
1. `storage:init` — first client seeds room storage (race-guarded). Calls `initialStorage(roomId)` callback if provided.
2. `storage:ops` — applies ops to room's `StorageDocument`, broadcasts to all clients, fires `onStorageChange`
3. `cursor:update` — validates, enriches with user metadata, broadcasts to all *except* sender
4. Custom messages — fires `onMessage`, relays to other clients

**Auth:** optional `authenticate(req)` handler. Falls back to query params (`userId`, `displayName`).

---

### @waits/lively-react

React 18+ hooks for seamless integration.

**Providers:**
- `LivelyProvider` — top-level, wraps `client` instance
- `RoomProvider` — room-scoped, joins on mount, leaves on unmount (strict-mode safe)

**Storage hooks:**
- `useStorage(selector)` — reactive selector over storage root, re-renders on shallow-equal changes. Returns `null` until loaded.
- `useStorageSuspense(selector)` — same but suspends (from `@waits/lively-react/suspense`)
- `useMutation(callback, deps)` — stable callback wrapping mutations in `room.batch()`
- `useStorageRoot()` — raw `{ root: LiveObject } | null`

**Presence hooks:**
- `useSelf()` — current user
- `useOthers()` — all other users (shallow-equal memoized)
- `useOther(userId, selector?)` — single user by ID
- `useOthersMapped(selector)` — mapped array with stable references

**Connection & cursor hooks:**
- `useStatus()` — connection status
- `useLostConnectionListener(cb)` — fires on disconnect
- `useCursors()` — `Map<userId, CursorData>` (includes viewport fields)
- `useUpdateCursor()` — `(x, y, viewportPos?, viewportScale?) => void`

**Event hooks:**
- `useBroadcastEvent(event)` — send typed custom message
- `useEventListener(event, cb)` — listen for custom messages

All hooks use `useSyncExternalStore` with shallow-equality memoization.

---

### @waits/lively-ui

Pre-built styled components for presence and cursors.

- `Cursor` — single remote cursor indicator with colored arrow + name label
- `CursorOverlay` — wrapper rendering all remote cursors over children
- `Avatar` — circular avatar with initials
- `AvatarStack` — compact stack with `+N` overflow
- `ConnectionBadge` — green/yellow/red/gray status dot
- `useCursorTracking(containerRef)` — attaches mousemove listener, returns `updateCursor`
- `CollabPills` — colored name pills for all users in the room

---

### @waits/lively-cli

Local development server with room persistence and inspection tools.

- `lively dev` — starts WebSocket server (default port 1999) with auto-persistence to `.lively/rooms/`
- `lively rooms list|clear|inspect` — manage persisted room data
- Keyboard shortcuts: `q` to quit, `c` to clear terminal

---

### @waits/lively-yjs

Yjs provider that bridges an Lively `Room` to a `Y.Doc` for collaborative text editing.

**Key exports:**
- `LivelyYjsProvider` — constructor takes `(Room, { doc?: Y.Doc })`. Methods: `connect()`, `disconnect()`, `destroy()`. Getters: `synced`, `connected`. Properties: `doc`, `awareness`.
- Events: `sync`, `awareness-update`, `status`
- Wire protocol: `yjs:sync-step1`, `yjs:sync-step2`, `yjs:update`, `yjs:awareness` — all base64-encoded over the room message channel

---

### @waits/lively-react-tiptap

TipTap editor integration with collaborative editing, toolbar, slash commands, and block extensions.

**Key exports:**
- `useLivelyExtension(options?)` — returns a TipTap `Extension` wiring Yjs sync, cursors, and undo
- `yjsUndo(editor)`, `yjsRedo(editor)` — call Yjs undo/redo directly
- `Toolbar` — fixed toolbar with heading, formatting, list, and history buttons
- `FloatingToolbar` — selection-triggered inline toolbar (bold, italic, underline, strike, code, highlight, link)
- `createSlashCommandExtension(items?)` — `/` command menu with 13 defaults across 3 sections
- `BlockHandle` — hover handle with context menu (delete, duplicate, move up/down)
- `Callout` — block node (info/warning/tip/danger types)
- `ImagePlaceholder` — image node with URL input placeholder
- `createCodeBlockExtension(lowlight)` — syntax-highlighted code blocks with language picker (28 languages)

---

### @waits/lively-react-codemirror

CodeMirror 6 integration with collaborative editing, markdown-aware toolbar, and status bar.

**Key exports:**
- `useLivelyCodeMirror(options?)` — creates a collaborative CodeMirror editor. Returns `{ containerRef, viewRef, languageName }`
- `typoraTheme` — Zed-inspired editor theme
- `typoraHighlightStyle` — syntax highlighting for markdown and code
- `FloatingToolbar` — markdown-aware selection toolbar (bold, italic, strikethrough, code)
- `StatusBar` — bottom bar showing line:col, language, and online user count
- `codeblockPlugin` — line decoration for fenced code blocks

---

## Wire Protocol

**Client → Server:**
| Message | Fields |
|---|---|
| `storage:init` | `root: SerializedCrdt` (first client only) |
| `storage:ops` | `ops: StorageOp[]` |
| `cursor:update` | `x, y, viewportPos?, viewportScale?` |
| Custom | `{ type: string, ... }` relayed to others |

**Server → Client:**
| Message | Fields |
|---|---|
| `presence` | `users: PresenceUser[]` |
| `storage:init` | `root: SerializedCrdt \| null` |
| `storage:ops` | `ops: StorageOp[], clock: number` |
| `cursor:update` | `cursor: CursorData` (enriched with user metadata) |
| Custom | Relayed from other clients |

---

## Data Flow

### Join → Load → Ready

```
<RoomProvider roomId userId displayName>
  ↓
client.joinRoom(roomId, opts) → Room created → room.connect()
  ↓
WebSocket opens: ws://server/rooms/{roomId}?userId=...&displayName=...
  ↓
Server authenticates, creates Room if needed, broadcasts presence
  ↓
Server sends { type: "storage:init", root: <serialized> }
  ↓
Client deserializes into StorageDocument, resolves getStorage()
  ↓
useStorage() hooks trigger re-render → app is live
```

### Mutate → Broadcast → Sync

```
useMutation callback fires
  ↓
room.batch() wraps mutations → LiveObject/List/Map generate ops with Lamport clock
  ↓
Ops applied locally (optimistic) → subscribers notified → re-render
  ↓
Batched ops sent as { type: "storage:ops", ops: [...] }
  ↓
Server applies to authoritative StorageDocument, broadcasts to all clients
  ↓
Remote clients apply ops (idempotent, clock-gated) → their hooks re-render
```

### Presence & Cursors

```
User joins/leaves → server auto-broadcasts { type: "presence", users: [...] }
  ↓
useOthers() / useSelf() re-render

Mouse move → updateCursor(x, y) [throttled 50ms]
  ↓
Server enriches with userId/displayName/color, broadcasts to others
  ↓
useCursors() re-renders → Cursor components update
```

---

## Example Apps

### nextjs-todo
Simple collaborative todo list. `LiveObject` root with `items: LiveList<LiveObject>`. Demonstrates basic CRDT usage, `useMutation`, and presence.

### nextjs-whiteboard
Full collaborative canvas — shapes, connectors, sticky notes, text, frames, AI command bar. Extends the core with Zustand for local viewport state, Supabase for persistence (via `onStorageChange`/`initialStorage` callbacks), and app-layer features like cursor follow mode.

### nextjs-collab-editor
Notion-style collaborative rich text editor using `@waits/lively-react-tiptap`. Demonstrates `useLivelyExtension`, `Toolbar`, `FloatingToolbar`, slash commands, block handle, callouts, and image placeholders.

### nextjs-notion-editor
Full Notion-clone editor with `@waits/lively-react-tiptap`. Slash commands, callouts, code blocks with syntax highlighting, and collaborative cursors.

### nextjs-markdown-editor
Collaborative markdown editor using `@waits/lively-react-codemirror`. Tabbed file interface, Typora-inspired theme, floating toolbar, status bar, and `codeblockPlugin` for fenced code styling.
