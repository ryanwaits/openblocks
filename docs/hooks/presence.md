# Presence & Activity Tracking

The SDK automatically tracks user activity and manages `online`, `away`, and `offline` status transitions. No manual presence management is needed -- activity detection and heartbeats are built into the connection lifecycle. You wire up a `RoomProvider`, and the rest happens behind the scenes.

---

## Activity Status Lifecycle

```
                     60s inactivity              300s inactivity
  ┌──────────┐  ──────────────────>  ┌──────────┐  ─────────────────>  ┌──────────┐
  │  online   │                      │   away    │                     │  offline  │
  └──────────┘  <──────────────────  └──────────┘  <─────────────────  └──────────┘
                   any interaction                    any interaction
```

The `ActivityTracker` listens for `mousemove`, `keydown`, `pointerdown`, and `visibilitychange` on `document`. When the tab is hidden, the user immediately transitions to `away`. When any interaction fires, the user jumps straight back to `online` regardless of current state.

Both timers are configurable via `RoomProvider` props (see [Configuration](#configuration)).

---

## API Reference

| Hook / Type | Signature | Returns | Description |
|---|---|---|---|
| `useOthersOnLocation` | `(locationId: string)` | `PresenceUser[]` | Other users whose `location` matches `locationId`. Reactively updates on presence changes. |
| `usePresenceEvent` | `(event: "stateChange", callback)` | `void` | Fires `callback(user, prevStatus, newStatus)` when any other user's `onlineStatus` changes. |
| `useOthers` | `()` | `PresenceUser[]` | All other users in the room (unfiltered). |
| `useSelf` | `()` | `PresenceUser \| null` | The current user's presence data. |
| `PresenceUser` | -- | `type` | See shape below. |
| `OnlineStatus` | -- | `type` | `"online" \| "away" \| "offline"` |

### `PresenceUser` shape

```ts
interface PresenceUser {
  userId: string;
  displayName: string;
  color: string;
  connectedAt: number;
  onlineStatus: OnlineStatus;   // "online" | "away" | "offline"
  lastActiveAt: number;
  isIdle: boolean;
  avatarUrl?: string;
  location?: string;
  metadata?: Record<string, unknown>;
}
```

---

## `useOthersOnLocation`

```ts
import { useOthersOnLocation } from "@waits/lively-react";

const usersHere = useOthersOnLocation("/dashboard");
```

Filters the room's presence list to only users whose `location` field matches the given `locationId`. Uses `useSyncExternalStore` with shallow equality caching, so re-renders only fire when the filtered list actually changes.

### Real-world use cases

#### 1. Multi-page app -- show who's viewing each page

> "3 users on /dashboard, 1 user on /settings"

```tsx
// Layout.tsx
import { usePathname } from "next/navigation";
import { RoomProvider } from "@waits/lively-react";

function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <RoomProvider
      roomId="my-app"
      userId={userId}
      displayName={displayName}
      location={pathname}
    >
      <Sidebar />
      {children}
    </RoomProvider>
  );
}

// Sidebar.tsx
import { useOthersOnLocation } from "@waits/lively-react";

function PagePresence({ path, label }: { path: string; label: string }) {
  const users = useOthersOnLocation(path);

  return (
    <div className="flex items-center gap-2">
      <span>{label}</span>
      {users.length > 0 && (
        <span className="text-xs text-muted-foreground">
          {users.length} {users.length === 1 ? "user" : "users"}
        </span>
      )}
    </div>
  );
}

function Sidebar() {
  return (
    <nav>
      <PagePresence path="/dashboard" label="Dashboard" />
      <PagePresence path="/settings" label="Settings" />
      <PagePresence path="/reports" label="Reports" />
    </nav>
  );
}
```

#### 2. Document sections -- "Alice is editing Section 2"

Set `location` to a section ID and show section-level presence indicators.

```tsx
function SectionEditor({ sectionId }: { sectionId: string }) {
  const viewers = useOthersOnLocation(`section:${sectionId}`);

  return (
    <div className="relative">
      {viewers.length > 0 && (
        <div className="absolute -left-8 top-0 flex flex-col gap-1">
          {viewers.map((u) => (
            <div
              key={u.userId}
              className="h-6 w-6 rounded-full"
              style={{ backgroundColor: u.color }}
              title={`${u.displayName} is here`}
            />
          ))}
        </div>
      )}
      <textarea placeholder={`Section ${sectionId}`} />
    </div>
  );
}

// Parent updates location when focus changes
function DocumentEditor() {
  const [activeSection, setActiveSection] = useState("1");

  return (
    <RoomProvider
      roomId="doc-abc"
      userId={userId}
      displayName={displayName}
      location={`section:${activeSection}`}
    >
      {["1", "2", "3"].map((id) => (
        <div key={id} onFocus={() => setActiveSection(id)}>
          <SectionEditor sectionId={id} />
        </div>
      ))}
    </RoomProvider>
  );
}
```

#### 3. Meeting rooms / channels -- who's in each channel

In a Slack-like app, filter users by channel ID.

```tsx
function ChannelList({ channels }: { channels: Channel[] }) {
  return (
    <ul>
      {channels.map((ch) => (
        <ChannelRow key={ch.id} channel={ch} />
      ))}
    </ul>
  );
}

function ChannelRow({ channel }: { channel: Channel }) {
  const online = useOthersOnLocation(`channel:${channel.id}`);

  return (
    <li className="flex items-center justify-between px-3 py-1">
      <span># {channel.name}</span>
      {online.length > 0 && (
        <div className="flex -space-x-1">
          {online.slice(0, 3).map((u) => (
            <div
              key={u.userId}
              className="h-5 w-5 rounded-full border-2 border-background"
              style={{ backgroundColor: u.color }}
              title={u.displayName}
            />
          ))}
          {online.length > 3 && (
            <span className="text-xs text-muted-foreground ml-1">
              +{online.length - 3}
            </span>
          )}
        </div>
      )}
    </li>
  );
}
```

#### 4. Spreadsheet cells -- show which cell each user is focused on

Location = cell reference like `"B4"`.

```tsx
function Cell({ cellRef }: { cellRef: string }) {
  const viewers = useOthersOnLocation(`cell:${cellRef}`);
  const borderColor = viewers.length > 0 ? viewers[0].color : "transparent";

  return (
    <td
      className="relative border px-2 py-1"
      style={{ outline: `2px solid ${borderColor}` }}
    >
      {viewers.length > 0 && (
        <span
          className="absolute -top-4 left-0 text-[10px] px-1 text-white rounded-t"
          style={{ backgroundColor: viewers[0].color }}
        >
          {viewers[0].displayName}
        </span>
      )}
      {/* cell content */}
    </td>
  );
}
```

---

## `usePresenceEvent`

```ts
import { usePresenceEvent } from "@waits/lively-react";

usePresenceEvent("stateChange", (user, prevStatus, newStatus) => {
  console.log(`${user.displayName}: ${prevStatus} -> ${newStatus}`);
});
```

The callback fires whenever any other user's `onlineStatus` field changes. It compares the previous and current presence snapshots internally, so you only get notified on actual transitions.

**Callback signature:**

```ts
(user: PresenceUser, prevStatus: OnlineStatus, newStatus: OnlineStatus) => void
```

### Real-world use cases

#### 1. Toast notifications -- "Alice went away"

```tsx
import { usePresenceEvent } from "@waits/lively-react";
import { toast } from "sonner";

function PresenceToasts() {
  usePresenceEvent("stateChange", (user, prev, next) => {
    if (next === "away") {
      toast(`${user.displayName} stepped away`, { icon: "💤" });
    } else if (next === "online" && prev !== "online") {
      toast(`${user.displayName} is back`, { icon: "👋" });
    } else if (next === "offline") {
      toast(`${user.displayName} went offline`, { icon: "🔴" });
    }
  });

  return null;
}
```

#### 2. Auto-save indicator -- "last seen 2 min ago"

Replace a live avatar with a "last seen" timestamp when a user goes offline.

```tsx
function CollaboratorBadge({ user }: { user: PresenceUser }) {
  const [lastSeen, setLastSeen] = useState<number | null>(null);

  usePresenceEvent("stateChange", (u, _prev, next) => {
    if (u.userId === user.userId && next === "offline") {
      setLastSeen(Date.now());
    }
    if (u.userId === user.userId && next === "online") {
      setLastSeen(null);
    }
  });

  if (lastSeen) {
    return (
      <span className="text-xs text-muted-foreground">
        {user.displayName} -- last seen {formatRelative(lastSeen)}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <div
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: user.color }}
      />
      <span className="text-sm">{user.displayName}</span>
    </div>
  );
}
```

#### 3. Collaboration guard -- warn before editing an idle user's section

If someone went `away` on a section, they might come back. Show a warning before overwriting their work.

```tsx
function SectionGuard({
  sectionId,
  children,
}: {
  sectionId: string;
  children: React.ReactNode;
}) {
  const viewers = useOthersOnLocation(`section:${sectionId}`);
  const [idleWarning, setIdleWarning] = useState<string | null>(null);

  usePresenceEvent("stateChange", (user, _prev, next) => {
    if (user.location === `section:${sectionId}` && next === "away") {
      setIdleWarning(user.displayName);
    }
    if (user.location === `section:${sectionId}` && next === "online") {
      setIdleWarning(null);
    }
  });

  return (
    <div>
      {idleWarning && (
        <div className="bg-yellow-100 text-yellow-800 text-sm px-3 py-1 rounded mb-2">
          {idleWarning} was editing this section and went idle. They may return.
        </div>
      )}
      {children}
    </div>
  );
}
```

---

## Configuration

All presence-related behavior is configured through `RoomProvider` props:

```tsx
<RoomProvider
  roomId="my-room"
  userId={userId}
  displayName={displayName}
  location="/dashboard"                // where this user is (optional)
  presenceMetadata={{ role: "editor" }} // arbitrary key-value pairs (optional)
  inactivityTime={60000}               // ms until "away"   (default: 60000 = 1 min)
  offlineInactivityTime={300000}       // ms until "offline" (default: 300000 = 5 min)
>
  {children}
</RoomProvider>
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `location` | `string` | `undefined` | Sets this user's location. Used by `useOthersOnLocation` to filter. |
| `presenceMetadata` | `Record<string, unknown>` | `undefined` | Custom key-value pairs attached to the user's presence (e.g. `{ role: "viewer" }`). |
| `inactivityTime` | `number` | `60000` | Milliseconds of no activity before transitioning to `"away"`. |
| `offlineInactivityTime` | `number` | `300000` | Milliseconds of no activity before transitioning to `"offline"`. |

### Updating location dynamically

The `location` prop is sent on mount via `room.updatePresence()`. To change location at runtime (e.g., navigating between pages), remount the `RoomProvider` with a new `location` value, or call `room.updatePresence({ location })` directly via `useRoom()`.

---

## Heartbeat Mechanism

The heartbeat is fully automatic. No configuration is needed.

```
Client                              Server
  │                                   │
  │──── heartbeat (every 30s) ──────> │
  │                                   │── checks all connections (every 15s)
  │                                   │   if no heartbeat for 45s:
  │                                   │     mark connection as "offline"
  │                                   │     broadcast updated presence
  │                                   │
```

| Parameter | Value | Side |
|---|---|---|
| Client ping interval | 30s | `ConnectionManager` (`heartbeatIntervalMs`) |
| Server check interval | 15s | `LivelyServer` (`heartbeatCheckIntervalMs`) |
| Server timeout | 45s | `LivelyServer` (`heartbeatTimeoutMs`) |

The heartbeat is independent from the `ActivityTracker`. Activity tracking determines status based on user interaction (mouse, keyboard, tab visibility). Heartbeats determine whether the WebSocket connection is still alive. If the connection drops entirely, the server marks the user offline after 45 seconds of silence, even if the `ActivityTracker` never fired.

---

## Tracked DOM Events

The `ActivityTracker` listens to these `document` events:

| Event | Behavior |
|---|---|
| `mousemove` | Resets inactivity timer, transitions to `"online"` if not already |
| `keydown` | Same |
| `pointerdown` | Same |
| `visibilitychange` | Tab hidden = immediate `"away"`. Tab visible = immediate `"online"`. |

The tracker polls every 10 seconds (`pollInterval`) to check if the inactivity thresholds have been exceeded.

---

## Patterns & Tips

- **Set `location` from your router.** Use `usePathname()` (Next.js) or `useLocation()` (React Router) to keep location in sync with the current page.

- **Use `presenceMetadata` for role-based presence.** Tag users as `{ role: "editor" }` vs `{ role: "viewer" }` and filter in the UI. The metadata is available on every `PresenceUser` object via the `metadata` field.

- **Combine `useOthersOnLocation` with avatar stacks.** Render a location-scoped avatar list in sidebars, tabs, or section headers.

- **Debounce location updates for fast navigation.** If your app navigates rapidly (e.g., arrow keys in a spreadsheet), debounce the `location` change to avoid flooding the server with `presence:update` messages.

- **Prefer `usePresenceEvent` over polling.** Instead of checking `onlineStatus` in a render loop, use the event hook for transitions. It only fires on actual state changes, keeping your component efficient.

- **Server-side heartbeat is your safety net.** Even if a user's browser crashes and never sends an `"offline"` status, the server will mark them offline after 45 seconds of missed heartbeats. You don't need to handle this edge case in client code.
