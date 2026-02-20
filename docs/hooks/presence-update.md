# Presence Updates & Others Events

Hooks for mutating your own presence and reacting to changes in other users. `useMyPresence` and `useUpdateMyPresence` let you set location, metadata, and status. `useOthersUserIds` gives you a render-optimized list of user IDs (re-renders only on join/leave). `useOthersListener` fires imperative callbacks on enter, leave, and update events without causing re-renders.

---

## Key Types

```ts
type PresenceUpdatePayload = {
  location?: string;
  metadata?: Record<string, unknown>;
  onlineStatus?: OnlineStatus;
};

type OthersEvent =
  | { type: "enter"; user: PresenceUser; others: PresenceUser[] }
  | { type: "leave"; user: PresenceUser; others: PresenceUser[] }
  | { type: "update"; user: PresenceUser; others: PresenceUser[] };
```

`PresenceUpdatePayload` is a partial update -- you only send the fields you want to change. `OthersEvent` is a discriminated union emitted by `useOthersListener` for each individual user change.

---

## API Reference

| Hook | Signature | Returns | Re-renders when... |
|------|-----------|---------|-------------------|
| `useMyPresence` | `useMyPresence()` | `[PresenceUser \| null, (data: Partial<PresenceUpdatePayload>) => void]` | Own presence changes (status, location, metadata) |
| `useUpdateMyPresence` | `useUpdateMyPresence()` | `(data: Partial<PresenceUpdatePayload>) => void` | Never (stable reference) |
| `useOthersUserIds` | `useOthersUserIds()` | `string[]` | A user joins or leaves (NOT on presence data changes) |
| `useOthersListener` | `useOthersListener(callback)` | `void` | Never (imperative callback, no re-renders) |

All hooks must be used inside a `RoomProvider`. `useMyPresence` combines `useSelf()` and `useUpdateMyPresence()` internally. `useOthersUserIds` returns a sorted array and uses referential equality checks on the ID list. `useOthersListener` uses a `callbackRef` pattern so your callback always has access to the latest closure without stale captures.

---

## `useMyPresence`

Returns a `[self, updatePresence]` tuple -- a convenience wrapper that combines `useSelf()` and `useUpdateMyPresence()` into one call.

```ts
import { useMyPresence } from "@waits/openblocks-react";

const [me, updatePresence] = useMyPresence();
if (me) updatePresence({ location: "settings" });
```

**Signature:**

```ts
function useMyPresence(): [
  PresenceUser | null,
  (data: Partial<PresenceUpdatePayload>) => void
];
```

The first element is `null` before the WebSocket connection is established and the first presence broadcast is received. The second element is a stable function reference that won't change across renders.

```tsx
import { useMyPresence } from "@waits/openblocks-react";

function LocationSwitcher() {
  const [me, updatePresence] = useMyPresence();

  return (
    <div className="flex items-center gap-3">
      {me && (
        <span className="text-sm text-gray-500">
          Currently on: {me.location ?? "unknown"}
        </span>
      )}
      <button
        className="px-3 py-1 rounded bg-blue-500 text-white text-sm"
        onClick={() => updatePresence({ location: "dashboard" })}
      >
        Go to Dashboard
      </button>
      <button
        className="px-3 py-1 rounded bg-gray-200 text-sm"
        onClick={() => updatePresence({ location: "settings" })}
      >
        Go to Settings
      </button>
    </div>
  );
}
```

> **Tip:** If you only need the updater and don't read `self`, use `useUpdateMyPresence()` instead. It never triggers re-renders, which is better for high-frequency update sites (e.g., mouse move handlers).

---

## `useUpdateMyPresence`

Returns a stable function to update the current user's presence data. The function reference never changes, so it's safe to pass as a prop or use in dependency arrays without causing re-renders.

```ts
import { useUpdateMyPresence } from "@waits/openblocks-react";

const updatePresence = useUpdateMyPresence();
updatePresence({ location: "page-1" });
```

**Signature:**

```ts
function useUpdateMyPresence(): (data: Partial<PresenceUpdatePayload>) => void;
```

The update is partial -- you only send the fields you want to change. Unchanged fields are preserved on the server.

```tsx
import { useUpdateMyPresence } from "@waits/openblocks-react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

function LocationTracker() {
  const updatePresence = useUpdateMyPresence();
  const pathname = usePathname();

  useEffect(() => {
    updatePresence({ location: pathname });
  }, [pathname, updatePresence]);

  return null;
}
```

> **When to use `useUpdateMyPresence` vs `useMyPresence`:** Use `useUpdateMyPresence` when you only need to write presence (e.g., syncing location from a router). Use `useMyPresence` when you also need to read your own presence data in the same component.

---

## `useOthersUserIds`

Returns a sorted `string[]` of user IDs for all other users in the room. Only re-renders when users join or leave -- NOT when their presence data (location, status, metadata) changes.

```ts
import { useOthersUserIds } from "@waits/openblocks-react";

const ids = useOthersUserIds();
// ["user-abc", "user-def", "user-xyz"]
```

**Signature:**

```ts
function useOthersUserIds(): string[];
```

Internally, this hook maps each user to their `userId`, sorts the array, and compares it element-by-element against the previous value. If the sorted ID list hasn't changed, the cached array is returned, preventing re-renders.

```tsx
import { useOthersUserIds, useOther } from "@waits/openblocks-react";

function CursorLayer() {
  const ids = useOthersUserIds();

  return (
    <>
      {ids.map((id) => (
        <RemoteCursor key={id} userId={id} />
      ))}
    </>
  );
}

function RemoteCursor({ userId }: { userId: string }) {
  const data = useOther(userId, (u) => ({
    name: u.displayName,
    color: u.color,
    location: u.location,
  }));

  if (!data) return null;

  return (
    <div
      className="px-2 py-0.5 rounded text-white text-xs"
      style={{ backgroundColor: data.color }}
    >
      {data.name}
    </div>
  );
}
```

> **This is the recommended pattern for per-user rendering.** The parent (`CursorLayer`) only re-renders when the set of users changes. Each child (`RemoteCursor`) independently subscribes to its own user's data via `useOther`, so a location change for user A doesn't re-render user B's component.

---

## `useOthersListener`

Fires a callback whenever another user enters, leaves, or updates their presence. The callback receives a discriminated `OthersEvent`. This hook never causes re-renders -- it's purely imperative.

```ts
import { useOthersListener } from "@waits/openblocks-react";

useOthersListener((event) => {
  if (event.type === "enter") console.log(`${event.user.displayName} joined`);
  if (event.type === "leave") console.log(`${event.user.displayName} left`);
});
```

**Signature:**

```ts
function useOthersListener(callback: (event: OthersEvent) => void): void;
```

**`OthersEvent` variants:**

| `type` | `user` | `others` | Fires when... |
|--------|--------|----------|---------------|
| `"enter"` | The user who joined | All current others (post-join) | A new user appears in the others list |
| `"leave"` | The user who left | All current others (post-leave) | A user disappears from the others list |
| `"update"` | The user whose data changed | All current others (post-update) | Any field on a user changes (location, status, metadata) |

The hook uses a `callbackRef` pattern internally -- your callback always runs with the latest closure values, so there are no stale capture issues even if you reference local state.

```tsx
import { useOthersListener } from "@waits/openblocks-react";
import { toast } from "sonner";

function PresenceNotifications() {
  useOthersListener((event) => {
    switch (event.type) {
      case "enter":
        toast(`${event.user.displayName} joined the room`);
        break;
      case "leave":
        toast(`${event.user.displayName} left the room`);
        break;
    }
  });

  return null;
}
```

> **`useOthersListener` vs `useOthers`:** Use `useOthers` when you need to render UI based on the current list. Use `useOthersListener` when you need to react to transitions (toasts, analytics, sound effects) without re-rendering.

---

## Real-World Use Cases

### 1. Location-aware presence bar

Show where each user is in the app: "Alice is on Settings, Bob is on Dashboard."

```tsx
import { useSelf, useOthers, useUpdateMyPresence } from "@waits/openblocks-react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

function LocationSync() {
  const updatePresence = useUpdateMyPresence();
  const pathname = usePathname();

  useEffect(() => {
    updatePresence({ location: pathname });
  }, [pathname, updatePresence]);

  return null;
}

function PresenceBar() {
  const self = useSelf();
  const others = useOthers();

  const allUsers = self ? [self, ...others] : others;

  return (
    <div className="flex items-center gap-4 px-4 py-2 border-b bg-white">
      {allUsers.map((user) => (
        <div key={user.userId} className="flex items-center gap-2">
          <div
            className="h-6 w-6 rounded-full flex items-center justify-center text-white text-xs shrink-0"
            style={{ backgroundColor: user.color }}
          >
            {user.displayName[0].toUpperCase()}
          </div>
          <div className="text-sm">
            <span className="font-medium">{user.displayName}</span>
            {user.location && (
              <span className="text-gray-400 ml-1">
                on {user.location}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function App() {
  return (
    <RoomProvider roomId="my-app" userId={userId} displayName={displayName}>
      <LocationSync />
      <PresenceBar />
      {/* routes */}
    </RoomProvider>
  );
}
```

---

### 2. Join/leave toast notifications

Fire toasts when users enter or leave without re-rendering any component.

```tsx
import { useOthersListener } from "@waits/openblocks-react";
import type { OthersEvent } from "@waits/openblocks-react";
import { toast } from "sonner";

function JoinLeaveToasts() {
  useOthersListener((event: OthersEvent) => {
    switch (event.type) {
      case "enter":
        toast.success(`${event.user.displayName} joined`, {
          description: `${event.others.length} other${event.others.length !== 1 ? "s" : ""} in the room`,
          duration: 3000,
        });
        break;
      case "leave":
        toast(`${event.user.displayName} left`, {
          description: `${event.others.length} other${event.others.length !== 1 ? "s" : ""} remaining`,
          duration: 3000,
        });
        break;
    }
  });

  return null;
}
```

Drop `<JoinLeaveToasts />` anywhere inside `RoomProvider`. It renders nothing and never re-renders -- the callback fires imperatively on each event.

---

### 3. Optimized cursor rendering with `useOthersUserIds` + `useOther`

The standard `useOthers()` re-renders every cursor when any user's data changes. The `useOthersUserIds` + `useOther` pattern gives each cursor its own subscription, so updating user A's position doesn't re-render user B's cursor component.

```tsx
import { useOthersUserIds, useOther } from "@waits/openblocks-react";

function CursorOverlay() {
  const ids = useOthersUserIds();

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {ids.map((id) => (
        <UserCursor key={id} userId={id} />
      ))}
    </div>
  );
}

function UserCursor({ userId }: { userId: string }) {
  const cursor = useOther(userId, (u) => ({
    name: u.displayName,
    color: u.color,
    location: u.location,
    status: u.onlineStatus,
  }));

  if (!cursor || cursor.status === "offline") return null;

  return (
    <div className="flex items-center gap-1">
      <div
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: cursor.color }}
      />
      <span
        className="text-xs px-1.5 py-0.5 rounded text-white whitespace-nowrap"
        style={{ backgroundColor: cursor.color }}
      >
        {cursor.name}
      </span>
      {cursor.status === "away" && (
        <span className="text-[10px] text-gray-400 italic">away</span>
      )}
    </div>
  );
}
```

**Why this is better:** With 10 users, `useOthers()` would cause 10 re-renders on every presence tick. With this pattern, each `UserCursor` only re-renders when *its own* user's selected data changes. The parent `CursorOverlay` only re-renders when users join or leave.

---

### 4. Role-based presence updates using metadata

Tag users with roles via `metadata` and render role-specific UI. Editors see a full toolbar, viewers see a read-only banner.

```tsx
import { useMyPresence, useOthers } from "@waits/openblocks-react";

function RoleAwareEditor() {
  const [me, updatePresence] = useMyPresence();
  const others = useOthers();

  const editors = others.filter((u) => u.metadata?.role === "editor");
  const viewers = others.filter((u) => u.metadata?.role === "viewer");
  const myRole = (me?.metadata?.role as string) ?? "viewer";

  return (
    <div className="flex flex-col h-screen">
      {/* Header with role counts */}
      <header className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm">{editors.length + (myRole === "editor" ? 1 : 0)} editors</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-gray-400" />
            <span className="text-sm">{viewers.length + (myRole === "viewer" ? 1 : 0)} viewers</span>
          </div>
        </div>

        {/* Role toggle */}
        <button
          className="text-sm px-3 py-1 rounded border"
          onClick={() =>
            updatePresence({
              metadata: { role: myRole === "editor" ? "viewer" : "editor" },
            })
          }
        >
          Switch to {myRole === "editor" ? "viewer" : "editor"}
        </button>
      </header>

      {/* Role-conditional toolbar */}
      {myRole === "editor" ? (
        <div className="flex gap-2 px-4 py-2 border-b bg-gray-50">
          <button className="px-2 py-1 text-sm rounded hover:bg-gray-200">Bold</button>
          <button className="px-2 py-1 text-sm rounded hover:bg-gray-200">Italic</button>
          <button className="px-2 py-1 text-sm rounded hover:bg-gray-200">Insert Image</button>
        </div>
      ) : (
        <div className="px-4 py-2 bg-yellow-50 text-sm text-yellow-700 border-b">
          View-only mode. Switch to editor to make changes.
        </div>
      )}

      {/* Content */}
      <main className="flex-1 p-4">
        <div contentEditable={myRole === "editor"} className="prose max-w-none" />
      </main>
    </div>
  );
}
```

---

### 5. Activity indicator tracking enter/leave events

Maintain a running count of room activity (joins and leaves) and display it as a live feed.

```tsx
import { useOthersListener, useOthersUserIds } from "@waits/openblocks-react";
import type { OthersEvent } from "@waits/openblocks-react";
import { useState, useCallback } from "react";

type ActivityEntry = {
  id: number;
  type: "enter" | "leave";
  userName: string;
  userColor: string;
  timestamp: number;
};

function ActivityFeed() {
  const ids = useOthersUserIds();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [nextId, setNextId] = useState(0);

  useOthersListener(
    useCallback(
      (event: OthersEvent) => {
        if (event.type === "update") return; // only track joins and leaves

        setEntries((prev) => {
          const entry: ActivityEntry = {
            id: nextId,
            type: event.type,
            userName: event.user.displayName,
            userColor: event.user.color,
            timestamp: Date.now(),
          };
          setNextId((n) => n + 1);
          return [entry, ...prev].slice(0, 50); // keep last 50
        });
      },
      [nextId]
    )
  );

  return (
    <aside className="w-72 border-l bg-white flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Activity
        </h3>
        <span className="text-xs text-gray-400">
          {ids.length} online
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="text-sm text-gray-400 px-3 py-4">No activity yet</p>
        ) : (
          <ul className="divide-y">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-2 px-3 py-2">
                <div
                  className="h-5 w-5 rounded-full flex items-center justify-center text-white text-[10px] shrink-0"
                  style={{ backgroundColor: entry.userColor }}
                >
                  {entry.userName[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium">{entry.userName}</span>
                  <span className="text-sm text-gray-400 ml-1">
                    {entry.type === "enter" ? "joined" : "left"}
                  </span>
                </div>
                <span className="text-[10px] text-gray-300 shrink-0">
                  {new Date(entry.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
```

---

## Patterns & Tips

### Use `useUpdateMyPresence` for fire-and-forget updates

If you're syncing location from a router or updating metadata on a button click and don't need to read `self`, use `useUpdateMyPresence`. It returns a stable function that never triggers re-renders.

```tsx
const updatePresence = useUpdateMyPresence();

// In an effect, event handler, or callback -- no re-renders triggered
updatePresence({ location: "/new-page" });
```

---

### Prefer `useOthersUserIds` + `useOther` over `useOthers` for per-user components

The `useOthers()` hook re-renders on every presence change for every user. When rendering a list of per-user components (cursors, avatars, status dots), use `useOthersUserIds` for the list and `useOther` inside each child. This isolates re-renders to the individual user that changed.

```tsx
// Parent: only re-renders on join/leave
const ids = useOthersUserIds();

// Child: only re-renders when this specific user's selected data changes
const name = useOther(userId, (u) => u.displayName);
```

---

### `useOthersListener` is ideal for side effects

Toasts, analytics events, sound effects, and logging -- anything that should fire once per event and doesn't need to render UI. The callback pattern means no stale closures and no re-renders.

```tsx
useOthersListener((event) => {
  analytics.track("presence_event", {
    type: event.type,
    userId: event.user.userId,
    othersCount: event.others.length,
  });
});
```

---

### Partial updates with `useUpdateMyPresence`

You only send the fields you want to change. Omitted fields are preserved on the server. This means you can update `location` without touching `metadata`, or vice versa.

```tsx
const updatePresence = useUpdateMyPresence();

// Only updates location -- metadata is preserved
updatePresence({ location: "/settings" });

// Only updates metadata -- location is preserved
updatePresence({ metadata: { role: "admin" } });
```

---

### Discriminate `OthersEvent` with `event.type`

`OthersEvent` is a discriminated union. Use `switch` or `if` on `event.type` to narrow the type. All three variants include the affected `user` and the full `others` array post-event.

```tsx
useOthersListener((event) => {
  switch (event.type) {
    case "enter":
      // event.user is the user who just joined
      // event.others includes all current users (including the new one)
      break;
    case "leave":
      // event.user is the user who just left
      // event.others is everyone still in the room
      break;
    case "update":
      // event.user has the updated fields
      // event.others is the full current list
      break;
  }
});
```
