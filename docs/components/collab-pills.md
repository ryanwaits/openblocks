# CollabPills

Renders a row of colored name pills for all users in the room. Each pill uses the user's server-assigned color as a solid background.

```tsx
import { CollabPills } from "@waits/lively-ui";
```

> **Requirement:** Must be rendered inside a `<RoomProvider>`. Uses `useOthers()` and `useSelf()` internally.

---

## Quick Start

```tsx
<CollabPills />
```

That's it. Shows all users (including yourself) as colored pills.

---

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `showSelf` | `boolean` | `true` | Include the current user's own pill. |
| `max` | `number` | `5` | Maximum pills before showing an overflow count (`+N`). |
| `onUserClick` | `(user: PresenceUser) => void` | -- | Callback when a pill is clicked. Adds `cursor-pointer` to pills when set. |
| `className` | `string` | -- | Additional CSS classes on the outer container. |

---

## Examples

### Limit to 3 pills

```tsx
<CollabPills max={3} />
```

Renders up to 3 name pills. If there are more users, shows a gray `+N` overflow pill.

### Click to Follow

```tsx
function CollabBar() {
  const { followUser } = useFollowUser({ ... });

  return (
    <CollabPills
      onUserClick={(user) => followUser(user.userId)}
      max={4}
    />
  );
}
```

### Hide Self

```tsx
<CollabPills showSelf={false} />
```

Only shows other users' pills.

---

## Styling

The component uses the following CSS class names for customization:

| Class | Element |
|-------|---------|
| `ob-collab-pills` | Outer `<div>` container. Uses `flex items-center gap-1`. |
| `ob-collab-pill` | Each pill `<span>`. Rounded-full with padding and white text. |

Pill background color comes from `user.color` (server-assigned). Override via CSS specificity if needed.

---

## See Also

- [Avatar & AvatarStack](./avatar.md) — circular avatar components with overlap stacking
- [Presence — Self & Others](../hooks/use-others.md) — `useOthers()` and `useSelf()` hooks
