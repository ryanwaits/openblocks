# Presence -- Self & Others

Access information about who's in the room. `useSelf` for the current user, `useOthers` for everyone else. All four hooks use `useSyncExternalStore` under the hood with shallow equality checks, so components only re-render when presence data actually changes.

---

## `PresenceUser` type

Every presence hook returns one or more `PresenceUser` objects. The full shape (from `@waits/openblocks-types`):

```typescript
type OnlineStatus = "online" | "away" | "offline";

interface PresenceUser {
  userId: string;
  displayName: string;
  color: string;          // auto-assigned by the server, consistent across clients
  connectedAt: number;    // epoch ms
  onlineStatus: OnlineStatus;
  lastActiveAt: number;   // epoch ms, updated on activity
  isIdle: boolean;        // true when the user goes idle (no input events)
  avatarUrl?: string;
  location?: string;      // arbitrary location identifier set via updatePresence
  metadata?: Record<string, unknown>;
}
```

> **Tip:** `color` is assigned by the server when the user connects. It's the same color every other client sees for that user -- use it for cursors, selection highlights, and avatar backgrounds without coordinating colors yourself.

---

## API Reference

| Hook | Signature | Returns | Re-renders when... |
|------|-----------|---------|-------------------|
| `useSelf` | `useSelf()` | `PresenceUser \| null` | Own presence changes (status, location, metadata) |
| `useOthers` | `useOthers()` | `PresenceUser[]` | Any other user joins, leaves, or updates presence |
| `useOther` | `useOther<T>(userId, selector?)` | `T \| null` | That specific user's (selected) data changes |
| `useOthersMapped` | `useOthersMapped<T>(selector)` | `T[]` | The mapped output array changes |
| `useOthersUserIds` | `useOthersUserIds()` | `string[]` | A user joins or leaves (NOT on data changes) |

All five subscribe to the room's `"presence"` event internally. The shallow equality cache ensures stable references when nothing has changed.

> **See also:** [`useMyPresence`, `useUpdateMyPresence`, `useOthersListener`](./presence-update.md) for presence mutation and event-driven others tracking.

---

## `useSelf`

Returns the current user's own `PresenceUser`, or `null` before the first presence broadcast arrives from the server.

```tsx
import { useSelf } from "@waits/openblocks-react";

function MyAvatar() {
  const self = useSelf();

  if (!self) return <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse" />;

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm"
        style={{ backgroundColor: self.color }}
      >
        {self.displayName[0]}
      </div>
      <span>{self.displayName}</span>
    </div>
  );
}
```

Show connection status based on your own presence:

```tsx
function MyStatus() {
  const self = useSelf();

  if (!self) return null;

  const statusDot = {
    online: "bg-green-500",
    away: "bg-yellow-500",
    offline: "bg-gray-400",
  }[self.onlineStatus];

  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-2 w-2 rounded-full ${statusDot}`} />
      <span className="text-sm capitalize">{self.onlineStatus}</span>
    </div>
  );
}
```

> **Important:** `useSelf` returns `null` before the WebSocket connection is established and the first presence broadcast is received. Always handle the null case.

---

## `useOthers`

Returns an array of all other users currently in the room. The array is empty when you're alone -- safe to `.map()` and `.filter()` without null checks.

```tsx
import { useOthers } from "@waits/openblocks-react";

function OnlineBadge() {
  const others = useOthers();
  const count = others.length + 1; // +1 for yourself

  return (
    <span className="text-sm text-gray-600">
      {count} user{count !== 1 ? "s" : ""} online
    </span>
  );
}
```

List all collaborators:

```tsx
function UserList() {
  const others = useOthers();

  if (others.length === 0) {
    return <p className="text-sm text-gray-400">No one else is here</p>;
  }

  return (
    <ul className="space-y-2">
      {others.map((user) => (
        <li key={user.userId} className="flex items-center gap-2">
          <div
            className="h-6 w-6 rounded-full flex items-center justify-center text-white text-xs"
            style={{ backgroundColor: user.color }}
          >
            {user.displayName[0]}
          </div>
          <span className="text-sm">{user.displayName}</span>
          {user.isIdle && <span className="text-xs text-gray-400">idle</span>}
        </li>
      ))}
    </ul>
  );
}
```

> `useOthers` re-renders whenever **any** user joins, leaves, or updates their presence. For large rooms, prefer `useOthersMapped` to avoid re-renders from irrelevant field changes.

---

## `useOther`

Select a single other user by `userId`, with an optional selector to extract a slice of their data. Returns `null` if the user is not in the room.

```typescript
function useOther<T = PresenceUser>(
  userId: string,
  selector?: (user: PresenceUser) => T
): T | null;
```

Without a selector, returns the full `PresenceUser`:

```tsx
import { useOther } from "@waits/openblocks-react";

function FollowingBanner({ targetUserId }: { targetUserId: string }) {
  const user = useOther(targetUserId);

  if (!user) return <p>User disconnected</p>;

  return (
    <div
      className="px-3 py-1 rounded text-white text-sm"
      style={{ backgroundColor: user.color }}
    >
      Following {user.displayName}
    </div>
  );
}
```

With a selector, only re-renders when the selected value changes:

```tsx
function UserStatusDot({ userId }: { userId: string }) {
  const status = useOther(userId, (u) => u.onlineStatus);

  if (!status) return null;

  const color = { online: "green", away: "yellow", offline: "gray" }[status];
  return <div className={`h-2 w-2 rounded-full bg-${color}-500`} />;
}
```

> The selector pattern is powerful for performance. If you only care about one field, the component won't re-render when other fields (like `lastActiveAt`) change.

---

## `useOthersMapped`

Apply a selector/transform to the entire others array. Returns a mapped `T[]`. Re-renders only when the mapped output actually changes -- not on every presence tick.

```typescript
function useOthersMapped<T>(selector: (user: PresenceUser) => T): T[];
```

Internally, this hook compares the previous and next user arrays with shallow equality. If every user is shallowly equal to the previous tick, the cached mapped array is returned, skipping the re-render entirely.

Extract just names:

```tsx
import { useOthersMapped } from "@waits/openblocks-react";

function CollaboratorNames() {
  const names = useOthersMapped((u) => u.displayName);

  if (names.length === 0) return null;

  return <p className="text-sm">{names.join(", ")}</p>;
}
```

Extract compact user info for an avatar stack:

```tsx
function AvatarStack() {
  const avatars = useOthersMapped((u) => ({
    id: u.userId,
    name: u.displayName,
    color: u.color,
    avatarUrl: u.avatarUrl,
  }));

  return (
    <div className="flex -space-x-2">
      {avatars.map((a) => (
        <div
          key={a.id}
          className="h-8 w-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs"
          style={{ backgroundColor: a.color }}
          title={a.name}
        >
          {a.avatarUrl ? (
            <img src={a.avatarUrl} alt={a.name} className="rounded-full" />
          ) : (
            a.name[0]
          )}
        </div>
      ))}
    </div>
  );
}
```

Filter by status -- only show online users:

```tsx
function OnlineUsers() {
  const others = useOthers();
  const online = others.filter((u) => u.onlineStatus === "online");

  return (
    <p className="text-sm">
      {online.length} collaborator{online.length !== 1 ? "s" : ""} active
    </p>
  );
}
```

> **When to use `useOthersMapped` vs `useOthers`:** If your component only needs a subset of fields from each user (e.g., just names or just colors), `useOthersMapped` prevents re-renders when unrelated fields change. If you need the full `PresenceUser`, just use `useOthers`.

---

## Real-World Use Cases

### 1. "Who's here" sidebar

A vertical list of all connected users with names, avatars, and status indicators.

```tsx
import { useSelf, useOthers } from "@waits/openblocks-react";
import type { PresenceUser } from "@waits/openblocks-react";

function StatusDot({ status }: { status: PresenceUser["onlineStatus"] }) {
  const colors = {
    online: "bg-green-500",
    away: "bg-yellow-500",
    offline: "bg-gray-400",
  };
  return <div className={`h-2.5 w-2.5 rounded-full ${colors[status]}`} />;
}

function UserRow({ user, isSelf }: { user: PresenceUser; isSelf?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div
        className="relative h-8 w-8 rounded-full flex items-center justify-center text-white text-sm shrink-0"
        style={{ backgroundColor: user.color }}
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="rounded-full" />
        ) : (
          user.displayName[0].toUpperCase()
        )}
        <div className="absolute -bottom-0.5 -right-0.5">
          <StatusDot status={user.onlineStatus} />
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">
          {user.displayName}
          {isSelf && <span className="text-gray-400 ml-1">(you)</span>}
        </p>
        {user.location && (
          <p className="text-xs text-gray-400 truncate">{user.location}</p>
        )}
      </div>
    </div>
  );
}

function WhosHereSidebar() {
  const self = useSelf();
  const others = useOthers();

  return (
    <aside className="w-64 border-l bg-white">
      <h3 className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        In this room ({others.length + (self ? 1 : 0)})
      </h3>
      <div className="divide-y">
        {self && <UserRow user={self} isSelf />}
        {others.map((user) => (
          <UserRow key={user.userId} user={user} />
        ))}
      </div>
    </aside>
  );
}
```

---

### 2. User count badge

A compact badge for headers or toolbars.

```tsx
import { useOthers, useSelf } from "@waits/openblocks-react";

function UserCountBadge() {
  const others = useOthers();
  const self = useSelf();
  const total = others.length + (self ? 1 : 0);

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-100 text-sm">
      <div className="h-2 w-2 rounded-full bg-green-500" />
      {total} online
    </div>
  );
}
```

---

### 3. Role-based UI

Pass role information through `metadata` via `updatePresence`, then read it with `useSelf` to conditionally render UI.

```tsx
// When joining the room, set your role in metadata:
// room.updatePresence({ metadata: { role: "editor" } });

import { useSelf, useOthers } from "@waits/openblocks-react";

function Toolbar() {
  const self = useSelf();
  const role = self?.metadata?.role as string | undefined;

  if (role === "viewer") {
    return (
      <div className="px-4 py-2 bg-yellow-50 text-sm text-yellow-700">
        View-only mode
      </div>
    );
  }

  return (
    <div className="px-4 py-2 flex gap-2">
      <button>Bold</button>
      <button>Italic</button>
      <button>Insert image</button>
    </div>
  );
}

function ViewerList() {
  const others = useOthers();
  const viewers = others.filter((u) => u.metadata?.role === "viewer");
  const editors = others.filter((u) => u.metadata?.role === "editor");

  return (
    <div className="text-sm">
      <p>{editors.length} editor{editors.length !== 1 ? "s" : ""}</p>
      <p>{viewers.length} viewer{viewers.length !== 1 ? "s" : ""}</p>
    </div>
  );
}
```

---

### 4. "Currently editing" indicators

Combine `useOthers` with the `location` field to show per-section presence. Each user calls `room.updatePresence({ location: sectionId })` when they focus a section.

```tsx
import { useOthers } from "@waits/openblocks-react";

function SectionHeader({ sectionId, title }: { sectionId: string; title: string }) {
  const others = useOthers();
  const editing = others.filter((u) => u.location === sectionId);

  return (
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold">{title}</h2>
      {editing.length > 0 && (
        <div className="flex items-center gap-1">
          {editing.map((u) => (
            <div
              key={u.userId}
              className="h-5 w-5 rounded-full text-white text-[10px] flex items-center justify-center"
              style={{ backgroundColor: u.color }}
              title={`${u.displayName} is editing`}
            >
              {u.displayName[0]}
            </div>
          ))}
          <span className="text-xs text-gray-400 ml-1">editing</span>
        </div>
      )}
    </div>
  );
}
```

> For a more efficient version that only subscribes to users at a specific location, use [`useOthersOnLocation`](./presence.md) from `@waits/openblocks-react`.

---

### 5. User color coordination

Every user gets a unique, server-assigned `color`. Use it consistently across your UI for cursors, selections, and avatar backgrounds so users can visually associate actions with people.

```tsx
import { useOthers } from "@waits/openblocks-react";

function SelectionOverlay({ selections }: {
  selections: Map<string, { x: number; y: number; width: number; height: number }>;
}) {
  const others = useOthers();

  return (
    <>
      {others.map((user) => {
        const sel = selections.get(user.userId);
        if (!sel) return null;

        return (
          <div
            key={user.userId}
            className="absolute border-2 pointer-events-none"
            style={{
              borderColor: user.color,
              backgroundColor: `${user.color}15`,
              left: sel.x,
              top: sel.y,
              width: sel.width,
              height: sel.height,
            }}
          >
            <span
              className="absolute -top-5 left-0 px-1 text-xs text-white rounded-sm whitespace-nowrap"
              style={{ backgroundColor: user.color }}
            >
              {user.displayName}
            </span>
          </div>
        );
      })}
    </>
  );
}
```

---

## Patterns & Tips

### Always handle the null case for `useSelf`

`useSelf` returns `null` before the connection is established and the first `presence` message arrives. Use a loading state or early return:

```tsx
const self = useSelf();
if (!self) return <Skeleton />;
```

---

### `useOthers` returns an empty array when alone

No null checks needed. `.map()`, `.filter()`, and `.length` all work safely on an empty array.

---

### Colors are auto-assigned by the server

Don't generate random colors on the client. The server assigns each user a `color` on connect, and every client sees the same color for the same user. Use `user.color` everywhere you need a per-user color.

---

### Compute derived data in the component

The hooks are already optimized with shallow equality caching. Avoid storing derived data in state -- just compute it inline:

```tsx
// Good -- computed inline, no extra state
const onlineCount = useOthers().filter((u) => u.onlineStatus === "online").length;

// Bad -- redundant state that can go stale
const [onlineCount, setOnlineCount] = useState(0);
useEffect(() => { setOnlineCount(others.filter(...).length); }, [others]);
```

---

### Combine with `useOthersOnLocation` for location-filtered views

When you only care about users at a specific location (e.g., a document section, a page, a canvas area), use `useOthersOnLocation(locationId)` from [`presence.md`](./presence.md). It's more efficient than filtering `useOthers()` because the shallow equality check runs on a smaller array.

```tsx
import { useOthersOnLocation } from "@waits/openblocks-react";

function SectionPresence({ sectionId }: { sectionId: string }) {
  const usersHere = useOthersOnLocation(sectionId);
  // ...
}
```

---

### Use `useOther` with a selector for surgical re-renders

If you're rendering a component per user (e.g., a cursor label), use `useOther` with a selector so each component only re-renders when its specific user's relevant field changes:

```tsx
function CursorLabel({ userId }: { userId: string }) {
  const data = useOther(userId, (u) => ({
    name: u.displayName,
    color: u.color,
  }));

  if (!data) return null;

  return (
    <span style={{ color: data.color }}>{data.name}</span>
  );
}
```

---

### Wire protocol (internals)

For contributors debugging network traffic, presence flows through a single message type:

| Message | Direction | Payload |
|---------|-----------|---------|
| `presence` | Server to all clients | `{ type: "presence", users: PresenceUser[] }` |
| `presence:update` | Client to server | `{ type: "presence:update", onlineStatus?, isIdle?, location?, metadata? }` |

The server broadcasts the full `users` array on every presence change (join, leave, update). The client replaces its local `presence` array and emits the `"presence"` event, which all four hooks subscribe to.
