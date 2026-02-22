# Avatar & AvatarStack

Pre-built components for showing who's in a room. `Avatar` renders a single user (initials or image, with an optional status dot). `AvatarStack` renders a row of overlapping avatars with an overflow count.

Both components live in `@waits/lively-ui`.

```tsx
import { Avatar, AvatarStack } from "@waits/lively-ui";
```

> **Requirement:** `AvatarStack` uses `useOthers()` and `useSelf()` internally, so it **must** be rendered inside a `<RoomProvider>`. `Avatar` is a pure presentational component -- it only needs a `PresenceUser` object passed as a prop.

---

## `Avatar`

Renders a single user as a colored circle with initials, or as a round image when `avatarUrl` is set on the user. Optionally shows an online-status dot.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `user` | `PresenceUser` | **(required)** | The user object. Must include at least `userId`, `displayName`, and `color`. If `avatarUrl` is set, an `<img>` is rendered instead of initials. |
| `size` | `"sm" \| "md"` | `"md"` | Controls the dimensions of the avatar circle. `sm` = 24 px (`h-6 w-6`), `md` = 32 px (`h-8 w-8`). |
| `showStatus` | `boolean` | `false` | When `true`, renders a small colored dot in the bottom-right corner indicating the user's `onlineStatus`. |
| `className` | `string` | `undefined` | Additional CSS classes applied to the outer wrapper `<div>`. |

### `PresenceUser` shape (from `@waits/lively-types`)

```ts
interface PresenceUser {
  userId: string;
  displayName: string;
  color: string;
  connectedAt: number;
  onlineStatus: OnlineStatus;  // "online" | "away" | "offline"
  lastActiveAt: number;
  isIdle: boolean;
  avatarUrl?: string;
  location?: string;
  metadata?: Record<string, unknown>;
}
```

### Visual states

**Initials avatar** -- when `avatarUrl` is not set, displays the first letter of each word (up to 2 characters) on a colored circle:

```
  ┌──────┐
  │  AB  │   <- user.displayName = "Alice Brown"
  └──────┘       user.color = "#3b82f6" (background)
    32px (md)
```

**Image avatar** -- when `avatarUrl` is set, the initials circle is replaced with a round `<img>`:

```
  ┌──────┐
  │ ░░░░ │   <- <img src={user.avatarUrl} />
  │ ░░░░ │      rounded-full, object-cover
  └──────┘
    32px (md)
```

**Status dot** -- when `showStatus` is `true`, a small dot is positioned at the bottom-right corner:

```
  ┌──────┐        Status color mapping:
  │  AB  │          online  → bg-green-500  (green)
  └────●─┘          away    → bg-yellow-500 (yellow)
       ▲            offline → bg-gray-400   (gray)
     status dot
```

**Size comparison:**

```
  sm (24px)      md (32px)
  ┌────┐         ┌──────┐
  │ AB │         │  AB  │
  └────┘         └──────┘
  text-[10px]    text-xs
  dot: h-2 w-2  dot: h-2.5 w-2.5
```

### Basic usage

```tsx
import { Avatar } from "@waits/lively-ui";

const user: PresenceUser = {
  userId: "u1",
  displayName: "Alice Brown",
  color: "#3b82f6",
  onlineStatus: "online",
  connectedAt: Date.now(),
  lastActiveAt: Date.now(),
  isIdle: false,
};

<Avatar user={user} />                    // 32px initials circle
<Avatar user={user} size="sm" />          // 24px initials circle
<Avatar user={user} showStatus />         // 32px with green dot
```

---

## `AvatarStack`

Renders a horizontal row of overlapping `Avatar` components for every user in the room. When the user count exceeds `max`, a `+N` overflow badge appears at the end.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `max` | `number` | `4` | Maximum number of avatars rendered before showing the overflow `+N` badge. |
| `showSelf` | `boolean` | `true` | Whether to include the current user's own avatar in the stack. |
| `showStatus` | `boolean` | `false` | Passed through to each `Avatar` -- shows the online/away/offline status dot. |
| `locationId` | `string` | `undefined` | When set, only users whose `location` matches this value are shown. |
| `onUserClick` | `(user: PresenceUser) => void` | `undefined` | Click handler for individual avatars. When provided, avatars get `cursor-pointer`. |
| `className` | `string` | `undefined` | Additional CSS classes applied to the outer flex container. |

### Visual output

```
  max=4, 7 users in room:

  ┌──┐┌──┐┌──┐┌──┐┌──┐
  │AB││CD││EF││GH││+3│
  └──┘└──┘└──┘└──┘└──┘
   ◄── overlapping ──►   <- flex -space-x-2
                   ▲
                 overflow badge
                 (bg-slate-100, text-slate-500)
```

### Basic usage

```tsx
import { AvatarStack } from "@waits/lively-ui";

// Inside a <RoomProvider>:
<AvatarStack />                               // default: max=4, showSelf=true
<AvatarStack max={6} showStatus />            // up to 6, with status dots
<AvatarStack showSelf={false} />              // only show other users
```

---

## Real-world use cases

### 1. Document header -- "Who's here right now"

Show a presence bar at the top of your app with the avatar stack and connection status side by side.

```tsx
import { AvatarStack, ConnectionBadge } from "@waits/lively-ui";

function PresenceBar() {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b">
      <AvatarStack showStatus max={5} />
      <ConnectionBadge />
    </div>
  );
}
```

Rendered output:

```
┌──────────────────────────────────────────────┐
│ [AB] [CD] [EF] +3          Connected         │
│  ●    ●    ●                                 │
│ (green dots)                                 │
└──────────────────────────────────────────────┘
```

### 2. Page-level presence -- show who's on each page

Use `locationId` to scope the avatar stack to a specific page or section. Each user sets their `location` via a presence update; `AvatarStack` filters to only show users at that location.

```tsx
function PageNav({ pages }: { pages: string[] }) {
  return (
    <nav>
      {pages.map((page) => (
        <div key={page} className="flex items-center justify-between py-1">
          <span>{page}</span>
          <AvatarStack locationId={page} showStatus max={3} />
        </div>
      ))}
    </nav>
  );
}
```

```
  /dashboard     [AB] [CD]
  /settings      [EF]
  /billing       (empty -- no one here)
```

### 3. Clickable avatars -- follow a user's viewport

Like Figma's "follow" feature: click an avatar to snap your viewport to that user's position. Use `onUserClick` to receive the clicked `PresenceUser`.

```tsx
import { AvatarStack } from "@waits/lively-ui";

function CanvasHeader() {
  const handleFollow = (user: PresenceUser) => {
    // Pan camera to the user's cursor position,
    // or subscribe to their viewport updates
    console.log(`Now following ${user.displayName}`);
    followUserViewport(user.userId);
  };

  return (
    <AvatarStack
      max={6}
      showStatus
      onUserClick={handleFollow}
    />
  );
}
```

When `onUserClick` is provided, each avatar wrapper gets `cursor-pointer`, giving users a visual cue that the avatars are interactive.

### 4. Sidebar user list -- individual avatars with names

For a vertical list layout, render individual `Avatar` components rather than the stacked row.

```tsx
import { Avatar } from "@waits/lively-ui";
import { useOthers, useSelf } from "@waits/lively-react";

function UserList() {
  const self = useSelf();
  const others = useOthers();
  const everyone = self ? [self, ...others] : others;

  return (
    <ul className="space-y-2 p-4">
      {everyone.map((user) => (
        <li key={user.userId} className="flex items-center gap-3">
          <Avatar user={user} showStatus />
          <div>
            <p className="text-sm font-medium">{user.displayName}</p>
            <p className="text-xs text-gray-500">{user.onlineStatus}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

```
  ┌──────────────────────┐
  │ [AB] ● Alice Brown   │
  │        online         │
  │ [CD] ● Chris Doe     │
  │        online         │
  │ [EF] ○ Eve Fang      │
  │        away           │
  └──────────────────────┘
```

---

## Customization

### Tailwind classes reference

Both components use standard Tailwind utility classes, making them straightforward to override or extend.

**`Avatar` outer wrapper:**
- `relative inline-block` -- positioning context for the status dot

**`Avatar` initials circle:**
- `flex items-center justify-center rounded-full border-2 border-white font-medium text-white shadow-md`
- Background color comes from `user.color` via inline `style`

**`Avatar` image:**
- `rounded-full border-2 border-white object-cover shadow-md`

**`Avatar` status dot:**
- `absolute bottom-0 right-0 block rounded-full border border-white`
- Color class: `bg-green-500` / `bg-yellow-500` / `bg-gray-400`

**`AvatarStack` container:**
- `flex -space-x-2` -- negative spacing creates the overlap effect

**`AvatarStack` overflow badge:**
- `flex h-8 w-8 cursor-default items-center justify-center rounded-full border-2 border-white bg-slate-100 text-xs font-medium text-slate-500 shadow-md`

### Wrapping in custom containers

Use the `className` prop or wrap the components in your own containers for different layouts.

```tsx
{/* Dark background -- override border color */}
<div className="rounded-lg bg-gray-900 p-3">
  <AvatarStack className="[&_div]:border-gray-900" showStatus />
</div>

{/* Centered in a toolbar */}
<div className="flex justify-center">
  <AvatarStack max={8} />
</div>

{/* Larger gap between avatars (disable overlap) */}
<AvatarStack className="!space-x-1" />
```

### Providing context

`AvatarStack` calls `useOthers()` and `useSelf()` from `@waits/lively-react`, so the component tree must include a `<RoomProvider>` ancestor.

```tsx
import { RoomProvider } from "@waits/lively-react";
import { AvatarStack } from "@waits/lively-ui";

function App() {
  return (
    <RoomProvider
      serverUrl="wss://your-server.example.com"
      roomId="my-room"
      userId="user-123"
      userInfo={{ displayName: "Alice", color: "#3b82f6" }}
    >
      {/* AvatarStack can now access room presence */}
      <AvatarStack showStatus />
    </RoomProvider>
  );
}
```

`Avatar` is a pure presentational component -- it works anywhere, no provider needed.

---

## Composition example

A complete presence toolbar combining `AvatarStack` and `ConnectionBadge`:

```tsx
import { AvatarStack, ConnectionBadge } from "@waits/lively-ui";
import type { PresenceUser } from "@waits/lively-types";

function PresenceToolbar() {
  const handleFollow = (user: PresenceUser) => {
    // Snap viewport to this user's cursor
    followUserViewport(user.userId);
  };

  return (
    <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 shadow-sm">
      <AvatarStack showStatus max={4} onUserClick={handleFollow} />
      <ConnectionBadge />
    </div>
  );
}
```

```
  ┌───────────────────────────────────────┐
  │  [AB][CD][EF][GH] +2                 │
  │   ●   ●   ●   ●       Reconnecting  │
  └───────────────────────────────────────┘
        ▲                       ▲
    clickable avatars     ConnectionBadge
    (cursor: pointer)     (yellow pill, hidden when connected)
```
