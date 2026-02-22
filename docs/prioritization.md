# Feature Prioritization & Gap Analysis

Audit of lively SDK against Velt's realtime collaboration surface. Goal: identify matches, gaps, and enhancements to build a best-in-class DX for collaborative apps.

---

## Feature Matrix

| Feature | Velt | Lively | Status |
|---------|------|------------|--------|
| Presence (online users) | Full | Partial | Enhance |
| Cursors | Full | Full | Enhance |
| Follow Me Mode | Full | Full | Shipped — [`useFollowUser`](./hooks/use-follow-user.md) |
| Live Selection | Full | None | Build |
| Live State Sync | Full | None | Build |
| Single Editor Mode | Full | None | Build |
| Multiplayer Editing (CRDT) | Yjs-based | Custom CRDT + Yjs integration | Shipped — [`@waits/lively-yjs`](./packages/yjs.md), [`react-tiptap`](./packages/react-tiptap.md), [`react-codemirror`](./packages/react-codemirror.md) |
| Video Player Sync | Full | None | Build |
| Huddle (Audio/Video) | Full | None | Defer |
| Undo/Redo | App-layer | Full | Shipped — CRDT undo/redo + Yjs undo/redo via [`yjsUndo`/`yjsRedo`](./packages/react-tiptap.md) |
| Version History | Full | None | Build |
| Comments/Annotations | Full | None | Defer |

---

## 1. Presence Enhancements

### Current State
- `useSelf()`, `useOthers()`, `useOther()`, `useOthersMapped()`
- `AvatarStack`, `Avatar`, `ConnectionBadge` components
- Server auto-broadcasts presence on join/leave
- Deterministic color assignment

### Gaps

**1a. Inactivity & Away Detection**
Users marked "online" until disconnect. No idle/away/offline states.

- Add `onlineStatus: "online" | "away" | "offline"` to `PresenceUser`
- Track mouse/keyboard activity client-side with configurable `inactivityTime` (default 5min)
- Tab visibility API: `visibilitychange` → immediately mark "away"
- Separate `offlineInactivityTime` for full offline threshold
- Server heartbeat: client pings every N seconds, server marks offline on timeout

**1b. Location/Document Awareness**
No concept of "where" a user is within the app.

- Add optional `location` metadata to presence: `{ page?: string, section?: string, elementId?: string }`
- `useOthersOnLocation(locationId)` — filter presence by location
- Enable multi-room presence aggregation (user online in org, viewing specific doc)

**1c. Presence Data Subscriptions**
No way to subscribe to filtered presence streams or state transitions.

- `usePresenceData({ statuses: ['online'] })` — filtered presence stream
- `usePresenceEvent('stateChange', cb)` — fires on online/away/offline transitions
- `onPresenceUserClick` callback on `AvatarStack`

**1d. Richer PresenceUser**
Currently: `{ userId, displayName, color, connectedAt }`

- Add: `avatarUrl?`, `onlineStatus`, `isIdle`, `lastActiveAt`, `location?`, `metadata?`
- `metadata` is a generic `Record<string, unknown>` for app-specific presence data (e.g., current tool, selected object)

### Package Changes
- **types**: extend `PresenceUser`, add `OnlineStatus` type
- **client**: heartbeat timer, activity tracking, tab visibility listener
- **server**: heartbeat validation, timeout-based status transitions
- **react**: `usePresenceData()`, `usePresenceEvent()`, update existing hooks to include new fields
- **ui**: update `Avatar` for status dot indicator, add `onUserClick` to `AvatarStack`

### Priority: **P0** — foundational for every other feature

---

## 2. Cursor Enhancements

### Current State
- Full cursor tracking + broadcasting with throttling
- `CursorOverlay`, `Cursor` components
- `useCursorTracking()` hook
- Viewport pos/scale on wire protocol

### Gaps

**2a. Avatar Mode**
Currently cursors show arrow + name label. No avatar option.

- `<CursorOverlay mode="name" | "avatar" />` prop
- `Cursor` renders circular avatar image beside pointer when mode is "avatar"

**2b. Element-Scoped Cursors**
Cursors render globally. No way to restrict to specific containers.

- `allowedElementIds` prop on `CursorOverlay` — only show cursors within specified elements
- `useCursorTracking(containerRef, { elementId })` — scope tracking to specific DOM elements
- Data attribute approach: `data-lively-cursor="true"` on elements that should track

**2c. Cursor Inactivity**
Stale cursors persist until user disconnects.

- Add `inactivityTime` config (default 5min) — hide cursor after no movement
- Tab blur → immediately hide cursor
- Fade-out animation before removal

**2d. Cursor Events**
No callback when cursors change.

- `onCursorChange?: (cursors: Map<string, CursorData>) => void` on `CursorOverlay`
- `useCursorEvent(userId, cb)` — fires when specific user's cursor updates

**2e. Responsive Cursor Positioning**
Cursors use absolute coordinates. No adaptation for different viewport sizes.

- Normalize cursor positions relative to container dimensions (percentage-based)
- Viewport-aware rendering for responsive layouts

### Package Changes
- **ui**: avatar mode, element scoping, inactivity fade, event callbacks
- **client**: inactivity timer, percentage-based coordinate option
- **react**: `useCursorEvent()` hook

### Priority: **P1** — polishes existing functionality

---

## 3. Follow Me Mode (Flock Mode)

### Current State
- Wire protocol carries `viewportPos` + `viewportScale` on cursor messages
- SDK-level `useFollowUser()` hook in `@waits/lively-react` — see [docs](./hooks/use-follow-user.md)
- Smooth 60fps viewport interpolation with configurable `lerpFactor`
- Auto-exit on target disconnect or user interaction
- Follower tracking via presence metadata

### Implementation Plan (Shipped)

**3a. Core Hook: `useFollowUser()`**
```ts
const {
  followingUserId,     // who you're following (null if none)
  followUser,          // (userId: string) => void
  stopFollowing,       // () => void
  followers,           // string[] — who is following you
  isBeingFollowed,     // boolean
} = useFollowUser({
  onAutoExit?: (reason: 'disconnected' | 'stopped') => void,
  onFollow?: (userId: string) => void,
});
```

**3b. Follow State on Wire**
- Add `following?: string` to presence metadata — broadcast who you're following
- Server relays follow relationships so all clients know the follow graph
- New message type: `follow:start { targetUserId }`, `follow:stop`

**3c. Viewport Application**
- `useFollowUser` reads target's `viewportPos`/`viewportScale` from cursors
- Consumer provides `applyViewport(pos, scale)` callback
- SDK handles: auto-exit on disconnect, debounced viewport application, exit on user interaction

**3d. Navigation Sync (optional)**
- `onNavigate?: (pageInfo: { path: string }) => void` callback
- Leader broadcasts current route via presence metadata
- Follower receives and can navigate (app-layer routing)

**3e. UI Component**
- `<FollowBadge />` — shows "Following X" with dismiss button
- Integrate with `AvatarStack` — click avatar to follow

### Package Changes
- **types**: `FollowState`, follow-related messages
- **client**: follow/unfollow methods on Room, follow graph tracking
- **react**: `useFollowUser()`, `useFollowers()`
- **ui**: `FollowBadge`, avatar click-to-follow

### Priority: **P1** — high-value, builds on existing wire protocol

---

## 4. Live Selection

### Current State
None. No concept of which element a user is interacting with.

### Implementation Plan

Broadcast focused/selected element state across clients.

**4a. Core Hook: `useLiveSelection()`**
```ts
const {
  setSelection,        // (elementId: string | null) => void
  selections,          // Map<userId, { elementId, user: PresenceUser }>
} = useLiveSelection();
```

**4b. Selection Indicator Component**
```tsx
<LiveSelectionOverlay
  indicatorType="avatar" | "label"
  indicatorPosition="start" | "end"
  inactivityTime={300000}
/>
```
- Renders colored border + user badge around focused elements
- Auto-detects `input`, `textarea`, `contenteditable` focus events
- Opt-in via `data-lively-selection="true"` for custom elements

**4c. Automatic Form Tracking**
- `enableDefaultTracking()` — auto-track focus on standard form elements
- `disableDefaultTracking()` — manual only
- Per-element: `data-lively-selection-enabled="true"` / `"false"`

**4d. Wire Protocol**
- Selection state rides on presence metadata (not a separate channel)
- `{ selectedElementId?: string, selectionTimestamp: number }`
- LWW per user — latest selection wins

### Package Changes
- **types**: `SelectionData` type
- **client**: selection state management on Room
- **react**: `useLiveSelection()`, `useOtherSelections()`
- **ui**: `LiveSelectionOverlay`, `SelectionIndicator`

### Priority: **P2** — valuable for form-heavy apps, less critical for canvas apps

---

## 5. Live State Sync

### Current State
- CRDT storage (`LiveObject`, `LiveMap`, `LiveList`) for persistent state
- Custom messages (`room.send()`, `useBroadcastEvent()`) for ephemeral data
- No lightweight reactive state sync primitive

### Implementation Plan

A `useState`-like hook that syncs across clients — simpler than CRDT for ephemeral/non-conflicting state.

**5a. Core Hook: `useLiveState()`**
```ts
const [value, setValue] = useLiveState<T>(
  key: string,           // unique identifier
  initialValue: T,       // default value
  options?: {
    syncDuration?: number,    // debounce ms (default 50)
    persist?: boolean,        // save to storage doc (default false)
    scope?: 'room' | 'user', // per-room or per-user state
  }
);
```

- Drop-in `useState` replacement with cross-client sync
- LWW conflict resolution (server timestamp)
- Ephemeral by default (lost on room close), opt-in persistence
- Debounced sync to reduce message volume

**5b. Imperative API**
```ts
room.setLiveState(key, value, { merge?: boolean });
room.getLiveState(key); // subscribe
room.fetchLiveState(key); // one-shot
```

**5c. Zustand Middleware**
```ts
import { liveStateMiddleware } from '@waits/lively-react/zustand';

const useStore = create(
  liveStateMiddleware(
    (set) => ({ count: 0, increment: () => set(s => ({ count: s.count + 1 })) }),
    {
      allowedKeys: ['count'],  // only sync specific keys
      stateId: 'my-state',
    }
  )
);
```

- Transparent sync of Zustand store slices across clients
- Whitelist/blacklist which state keys sync
- Automatic debouncing

**5d. Server-Side Broadcast**
```ts
server.broadcastLiveState(roomId, key, value);
```

- Push state from server to all clients (admin actions, automated systems)
- REST API endpoint for external services

**5e. Wire Protocol**
- New message type: `state:update { key, value, timestamp, merge? }`
- New message type: `state:init { states: Record<string, { value, timestamp }> }`
- Server is authority — timestamps for LWW

### Package Changes
- **types**: `LiveStateMessage`, `LiveStateInit`
- **client**: live state management on Room, debounced sync
- **server**: state store per room, broadcast API, REST endpoint
- **react**: `useLiveState()`, Zustand middleware
- **react/zustand**: separate entrypoint for middleware

### Priority: **P0** — the single most impactful DX improvement. `useLiveState` makes lively accessible to any React app, not just CRDT-heavy ones.

---

## 6. Single Editor Mode

### Current State
None. All users can edit simultaneously.

### Implementation Plan

Lock-based editing where one user edits and others observe.

**6a. Core Hook: `useSingleEditor()`**
```ts
const {
  isEditor,               // am I the editor?
  editor,                 // PresenceUser | null (current editor)
  requestAccess,          // () => void
  cancelRequest,          // () => void
  releaseAccess,          // () => void
  acceptRequest,          // (userId) => void
  rejectRequest,          // (userId) => void
  pendingRequests,        // PresenceUser[]
  accessTimer,            // { remaining: number } | null
} = useSingleEditor({
  timeout?: number,              // auto-release after N seconds
  onAccessRequested?: (user) => void,
  onAccessGranted?: () => void,
  onAccessRevoked?: (reason) => void,
  containerIds?: string[],       // scope to specific DOM regions
});
```

**6b. Access Request Workflow**
1. Viewer calls `requestAccess()` → server relays to editor
2. Editor sees request via `pendingRequests` / `onAccessRequested`
3. Editor calls `acceptRequest(userId)` → server transfers lock
4. Or `rejectRequest(userId)` → viewer notified

**6c. Timeout & Heartbeat**
- Optional timeout auto-releases lock if editor idle
- Heartbeat keeps lock alive — missed heartbeats trigger auto-release
- Tab-level locking: only the active tab holds the lock

**6d. Auto-Sync Form Values**
- `data-lively-sync="true"` on form elements
- Editor's input values broadcast to viewers in real-time
- Viewers see read-only synchronized state

**6e. UI Component**
```tsx
<SingleEditorPanel />
```
- Shows current editor, request button, timer, pending requests

### Package Changes
- **types**: `EditorLockMessage`, `AccessRequestMessage`
- **client**: lock management on Room
- **server**: lock authority, heartbeat validation, timeout
- **react**: `useSingleEditor()`
- **ui**: `SingleEditorPanel`

### Priority: **P2** — niche but important for document editors, admin panels

---

## 7. CRDT / Storage Enhancements

### Current State
- `LiveObject`, `LiveMap`, `LiveList` with Lamport clock LWW
- `StorageDocument` with serialize/deserialize
- Batch operations, deep subscriptions
- CRDT undo/redo via `useUndo()`/`useRedo()`/`useHistory()`
- Yjs integration via `@waits/lively-yjs` for text CRDT — used by `react-tiptap` and `react-codemirror`

### Gaps

**7a. Undo/Redo**
- `useUndo()` / `useRedo()` hooks
- `useCanUndo()` / `useCanRedo()` for UI state
- Op-based history stack on `StorageDocument`
- `room.batch()` creates a single undo entry
- Configurable history depth (default 100)

**7b. Version History**
- `room.saveVersion(name)` — snapshot current state
- `room.getVersions()` — list all snapshots
- `room.restoreVersion(id)` — restore from snapshot
- Server-side storage of version snapshots
- `useVersionHistory()` hook

**7c. LiveText (Collaborative Text)**
- New CRDT type for rich text editing
- Integration targets: Tiptap, CodeMirror, Slate, BlockNote
- Character-level conflict resolution
- Cursor/selection ranges broadcast to other users
- This is the largest single feature — consider Yjs integration or custom implementation

**7d. Typed Storage Hooks**
```ts
// Current: untyped
const count = useStorage(root => root.get("count"));

// Enhanced: typed store pattern
const store = useCrdtStore<{ count: number }>({
  id: 'counter',
  type: 'object',
  initialValue: { count: 0 },
});
// store.value.count — typed access
// store.update({ count: 1 }) — typed mutation
```

**7e. Encryption Provider**
```ts
const client = new LivelyClient({
  serverUrl: '...',
  encryption: {
    encrypt: async (data) => encrypted,
    decrypt: async (data) => decrypted,
  },
});
```
- E2E encryption for storage and messages
- Provider pattern — consumer brings their own crypto

### Package Changes
- **storage**: undo/redo stack, version snapshots, LiveText
- **client**: version history methods, encryption hooks
- **server**: version storage, encryption relay
- **react**: `useUndo()`, `useRedo()`, `useVersionHistory()`, `useCrdtStore()`
- **react/tiptap**, **react/codemirror**: editor integration packages

### Priority
- Undo/Redo: **P0** — table-stakes for any editor
- Version History: **P1** — high value, moderate effort
- LiveText: **P1** — unlocks rich text collaboration (biggest effort)
- Typed Storage: **P2** — DX improvement
- Encryption: **P3** — enterprise feature

---

## 8. Video Player Sync

### Current State
None.

### Implementation Plan

Sync video playback state across all users in a room.

**8a. Hook: `useVideoSync()`**
```ts
const { ref, state } = useVideoSync<HTMLVideoElement>({
  role?: 'leader' | 'follower' | 'any', // who controls playback
});
// Attach ref to <video> element
```

**8b. Data Attribute Approach**
```html
<video data-lively-sync="true" src="..." />
```
- Zero-config: attribute triggers auto-sync
- Broadcasts: play, pause, seek, playback rate
- Leader/follower model or last-action-wins

**8c. Wire Protocol**
- Rides on live state sync: `{ type: 'video:state', playing, currentTime, playbackRate }`
- Periodic time sync for drift correction

### Package Changes
- **react**: `useVideoSync()` hook
- **ui**: optional `SyncVideoPlayer` wrapper component

### Priority: **P3** — niche feature, easy to build on top of live state sync

---

## 9. Broadcast & Event Enhancements

### Current State
- `room.send(message)` for custom messages
- `useBroadcastEvent()` / `useEventListener()` hooks
- Server relays to all other clients

### Gaps

**9a. Typed Event Channels**
```ts
// Define event schema at room level
type MyEvents = {
  'emoji-reaction': { emoji: string, targetId: string };
  'typing-indicator': { isTyping: boolean };
};

const broadcast = useBroadcastEvent<MyEvents>();
broadcast('emoji-reaction', { emoji: '👍', targetId: 'msg-1' });

useEventListener<MyEvents>('emoji-reaction', (data) => {
  // data is typed as { emoji: string, targetId: string }
});
```

**9b. Typing Indicators**
```ts
const { isTyping, setTyping, othersTyping } = useTypingIndicator(channelId);
```
- Built-in debounced typing indicator
- Auto-clears after configurable timeout
- `othersTyping: PresenceUser[]`

**9c. Emoji Reactions**
```ts
const { react, reactions } = useReactions(targetId);
react('👍');
// reactions: Map<emoji, PresenceUser[]>
```

### Package Changes
- **types**: generic event type system
- **react**: `useTypingIndicator()`, `useReactions()`, typed broadcast hooks

### Priority: **P2** — nice DX improvements, easy to build

---

## Implementation Roadmap

### Sprint 1: Foundation (P0)

| # | Feature | Package(s) | Effort |
|---|---------|------------|--------|
| 1 | Presence: inactivity/away/offline states | types, client, server, react | M |
| 2 | Presence: richer `PresenceUser` with metadata | types, client, server, react | S |
| 3 | `useLiveState()` hook | types, client, server, react | L |
| 4 | Undo/Redo | storage, react | L |

**Outcome**: Every app gets idle detection, simple state sync, and undo — massive DX leap.

### Sprint 2: Polish & Power (P1)

| # | Feature | Package(s) | Effort |
|---|---------|------------|--------|
| 5 | Follow Me Mode (SDK-level) | types, client, react, ui | M |
| 6 | Cursor enhancements (avatar, scoping, inactivity) | ui, react | M |
| 7 | Version History | storage, client, server, react | M |
| 8 | LiveText / collaborative text editing | storage, react | XL |
| 9 | Zustand middleware for live state | react | S |

**Outcome**: First-class follow mode, text collaboration, versioning.

### Sprint 3: Advanced Patterns (P2)

| # | Feature | Package(s) | Effort |
|---|---------|------------|--------|
| 10 | Live Selection | types, client, react, ui | M |
| 11 | Single Editor Mode | types, client, server, react, ui | L |
| 12 | Typed event channels | types, react | S |
| 13 | Typing indicators | react | S |
| 14 | Typed storage hooks (`useCrdtStore`) | react | M |

**Outcome**: Full feature parity with Velt for collaboration primitives.

### Sprint 4: Enterprise & Niche (P3)

| # | Feature | Package(s) | Effort |
|---|---------|------------|--------|
| 15 | Encryption provider | client, server | M |
| 16 | Video player sync | react, ui | S |
| 17 | Server-side REST broadcast API | server | S |
| 18 | Comments/Annotations system | all | XL |
| 19 | Huddle (audio/video) | new package | XL |

**Outcome**: Enterprise-ready, full Velt parity.

---

## Effort Key

- **S** = 1-2 days
- **M** = 3-5 days
- **L** = 1-2 weeks
- **XL** = 2-4 weeks

---

## DX Principles

1. **`useState`-like simplicity** — `useLiveState` should feel like local state that magically syncs
2. **Progressive disclosure** — basic usage requires zero config, advanced usage unlocks full control
3. **Composable primitives** — higher-level features (follow, single editor) built on lower-level ones (presence, live state)
4. **Framework-agnostic core** — hooks are React sugar; client/storage work anywhere
5. **Data attribute escape hatch** — `data-lively-*` attributes for zero-code opt-in on DOM elements
6. **Type safety everywhere** — generic hooks, typed events, typed storage selectors

---

## Open Questions

1. **LiveText strategy**: Build custom text CRDT or integrate Yjs? Yjs has ecosystem (Tiptap, CodeMirror extensions) but adds dependency. Custom gives full control.
2. **Persistence model for live state**: Should `useLiveState` data persist to server storage by default, or be ephemeral? Ephemeral is simpler but limits use cases.
3. **Encryption scope**: E2E encrypt everything (storage + messages + cursors) or just storage? Full encryption has perf cost on cursor updates.
4. **Server-side REST API**: Standalone REST server or bolt onto existing WS server? Separate is cleaner but adds deployment complexity.
5. **Huddle priority**: WebRTC is a massive scope increase. Build in-house or integrate LiveKit/Daily? Or defer entirely and let consumers use dedicated video SDKs?
6. **Version history storage**: Where do snapshots live? In-memory on server (lost on restart), or require a persistence adapter (Supabase, Redis, etc.)?
7. **LiveText cursor ranges**: Should text selection ranges ride on the existing cursor wire protocol or get a dedicated channel?
