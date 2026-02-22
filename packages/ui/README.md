# @waits/lively-ui

Pre-built React components and hooks for multiplayer UI: cursors, avatars, and connection status.

## Install

```sh
bun add @waits/lively-ui
```

Peer deps:

```sh
bun add react react-dom @waits/lively-react
```

## Tailwind

Components use Tailwind classes. You must tell Tailwind to scan the package source.

**Tailwind v4** — add a `@source` directive to your CSS:

```css
/* globals.css */
@import "tailwindcss";
@source "../node_modules/@waits/lively-ui/dist";
```

In a Bun monorepo, point directly at the package source instead:

```css
@source "../../../packages/ui/src";
```

**Tailwind v3** — add to `content` in `tailwind.config.js`:

```js
export default {
  content: [
    // ...your app paths
    "./node_modules/@waits/lively-ui/dist/**/*.js",
  ],
};
```

---

## API

### `useCursorTracking<T extends HTMLElement>()`

Returns a `ref` and `onMouseMove` handler. Attach both to the container that wraps `<CursorOverlay>`. Cursor coordinates are computed relative to the container's bounding box and broadcast to the room automatically.

```tsx
const { ref, onMouseMove } = useCursorTracking<HTMLDivElement>();

// ref, onMouseMove, position:relative, and <CursorOverlay> must all be
// on the same element — this is the shared coordinate space.
return (
  <div ref={ref} onMouseMove={onMouseMove} className="relative">
    <CursorOverlay />
    {children}
  </div>
);
```

---

### `<CursorOverlay>`

Renders a `<Cursor>` for every other user in the room. Excludes the current user's own cursor. Must be inside a `position: relative` container that has the `useCursorTracking` ref attached.

```ts
interface CursorOverlayProps {
  className?: string;           // extra class names applied to each <Cursor>
  mode?: "name" | "avatar";     // display mode passed to each <Cursor>, default: "name"
  inactivityTimeout?: number;   // ms before fading inactive cursors (default: none)
}
```

When `inactivityTimeout` is set, cursors that haven't moved within the timeout fade to `opacity: 0` with a 300ms CSS transition. Avatar URLs are pulled from each user's presence metadata.

```tsx
<div ref={ref} onMouseMove={onMouseMove} className="relative">
  <CursorOverlay />
</div>
```

Avatar mode with inactivity fade:

```tsx
<CursorOverlay mode="avatar" inactivityTimeout={5000} />
```

---

### `<Cursor>`

A single cursor indicator positioned absolutely within a `position: relative` container. Used internally by `<CursorOverlay>` but available for custom rendering.

```ts
interface CursorProps {
  x: number;
  y: number;
  color: string;
  displayName: string;
  className?: string;
  mode?: "name" | "avatar";       // default: "name"
  avatarUrl?: string;              // URL for avatar image (avatar mode)
  style?: React.CSSProperties;    // e.g. opacity transitions
}
```

In avatar mode, a 24px circular image is shown beside the cursor arrow. Falls back to an initials circle if no `avatarUrl` is provided.

```tsx
<Cursor x={120} y={80} color="#e11d48" displayName="Alice" />
```

Avatar mode:

```tsx
<Cursor
  x={120}
  y={80}
  color="#e11d48"
  displayName="Alice"
  mode="avatar"
  avatarUrl="https://example.com/alice.jpg"
/>
```

---

### `<Avatar>`

A colored circle with the user's initials and a tooltip. Accepts a `PresenceUser` object from `@waits/lively-react`.

```ts
interface AvatarProps {
  user: PresenceUser;
  size?: "sm" | "md";       // default: "md"
  showStatus?: boolean;      // show online/away/offline dot, default: false
  className?: string;
}
```

```tsx
const self = useSelf();
{self && <Avatar user={self} size="sm" />}
```

---

### `<AvatarStack>`

Stacked row of avatars for all users in the room. Shows a `+N` overflow badge when users exceed `max`.

```ts
interface AvatarStackProps {
  max?: number;                              // max avatars before overflow badge, default: 4
  showSelf?: boolean;                        // include current user's avatar, default: true
  showStatus?: boolean;                      // show online/away/offline dots, default: false
  locationId?: string;                       // filter to users at this location
  onUserClick?: (user: PresenceUser) => void; // callback when an avatar is clicked
  className?: string;
}
```

```tsx
<AvatarStack max={5} showStatus />

{/* Filter by location */}
<AvatarStack locationId="page-1" />

{/* Click to follow */}
<AvatarStack onUserClick={(user) => followUser(user.userId)} />
```

---

### `<ConnectionBadge>`

Shows a status pill when the connection is not `"connected"`. Returns `null` in the happy path — no badge when connected.

- Yellow: `"connecting"` / `"reconnecting"`
- Red: `"disconnected"`

```ts
interface ConnectionBadgeProps {
  className?: string;
}
```

```tsx
<div className="flex items-center gap-2">
  <ConnectionBadge />
  <AvatarStack />
</div>
```

---

## Full cursor tracking example

```tsx
import {
  useCursorTracking,
  CursorOverlay,
  AvatarStack,
  ConnectionBadge,
} from "@waits/lively-ui";

function Canvas() {
  const { ref, onMouseMove } = useCursorTracking<HTMLDivElement>();

  return (
    <div className="relative flex-1" ref={ref} onMouseMove={onMouseMove}>
      <CursorOverlay />
      {/* your canvas content */}
    </div>
  );
}

function Toolbar() {
  return (
    <div className="flex items-center gap-2">
      <ConnectionBadge />
      <AvatarStack max={5} />
    </div>
  );
}
```
