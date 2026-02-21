# useFollowUser

Figma-style "follow user" — mirror another user's viewport with smooth 60fps interpolation. Auto-exits when the followed user disconnects or when the local user interacts.

```tsx
import { useFollowUser } from "@waits/openblocks-react";
```

---

## Quick Start

```tsx
function FollowButton({ targetUserId }: { targetUserId: string }) {
  const { followingUserId, followUser, stopFollowing } = useFollowUser({
    onViewportChange: (pos, scale) => {
      // Apply to your camera / viewport
      setCamera({ x: pos.x, y: pos.y, zoom: scale });
    },
    onAutoExit: (reason) => {
      toast(`Stopped following: ${reason}`);
    },
  });

  if (followingUserId === targetUserId) {
    return <button onClick={stopFollowing}>Stop following</button>;
  }

  return <button onClick={() => followUser(targetUserId)}>Follow</button>;
}
```

---

## API Reference

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `onViewportChange` | `(pos: { x: number; y: number }, scale: number) => void` | -- | Called on every animation frame with the interpolated viewport position and scale. Wire this to your camera/viewport setter. |
| `exitOnInteraction` | `boolean` | `true` | Auto-exit follow mode when the user scrolls (`wheel`) or clicks (`pointerdown`). |
| `onAutoExit` | `(reason: "disconnected" \| "interaction") => void` | -- | Called when follow mode exits automatically. `"disconnected"` = target user left the room. `"interaction"` = local user interacted. |
| `lerpFactor` | `number` | `0.25` | Interpolation factor (0-1). Higher = snappier viewport transitions. Lower = smoother. |

### Returns

| Property | Type | Description |
|----------|------|-------------|
| `followingUserId` | `string \| null` | The userId currently being followed, or `null`. |
| `followUser` | `(userId: string) => void` | Start following a user. Broadcasts follow state via presence. |
| `stopFollowing` | `() => void` | Stop following. Cancels animation and clears presence follow state. |
| `followers` | `string[]` | Array of userIds currently following you. Derived from others' presence metadata. |
| `isBeingFollowed` | `boolean` | `true` if `followers.length > 0`. |

---

## How It Works

1. **Start following** — `followUser(userId)` sets local state and broadcasts via `room.followUser()`.
2. **Viewport sync** — subscribes to the `"cursors"` event, reads the target's `viewportPos` + `viewportScale` from `CursorData`.
3. **Smooth interpolation** — uses `requestAnimationFrame` to lerp toward the target viewport at 60fps. First update applies instantly (no lerp needed).
4. **Auto-exit** — if the followed user disconnects (detected via `useOthers`), follow mode exits with `onAutoExit("disconnected")`. If `exitOnInteraction` is true, `wheel` and `pointerdown` events trigger exit with `onAutoExit("interaction")`.

### Viewport Data Requirement

The followed user must broadcast viewport data with their cursor updates. Use `useUpdateCursor` with the optional viewport parameters:

```ts
updateCursor(canvasX, canvasY, { x: panX, y: panY }, zoomLevel);
```

See [Live Cursors](./cursors.md) for details on viewport-aware cursor broadcasting.

---

## Real-World Use Cases

### Canvas App with Follow Mode

```tsx
function WhiteboardApp() {
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const others = useOthers();

  const { followingUserId, followUser, stopFollowing, isBeingFollowed } =
    useFollowUser({
      onViewportChange: (pos, scale) => {
        setCamera({ x: pos.x, y: pos.y, zoom: scale });
      },
      onAutoExit: (reason) => {
        if (reason === "disconnected") {
          toast.info("User left the room");
        }
      },
    });

  return (
    <div>
      {/* Avatar list with follow triggers */}
      {others.map((user) => (
        <button
          key={user.userId}
          onClick={() =>
            followingUserId === user.userId
              ? stopFollowing()
              : followUser(user.userId)
          }
        >
          {user.displayName}
          {followingUserId === user.userId && " (following)"}
        </button>
      ))}

      {/* Following indicator */}
      {followingUserId && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
          Following {others.find((u) => u.userId === followingUserId)?.displayName}
          <button onClick={stopFollowing} className="ml-2">x</button>
        </div>
      )}

      {/* "Being followed" indicator */}
      {isBeingFollowed && (
        <div className="fixed bottom-4 right-4 text-xs text-gray-500">
          Someone is following you
        </div>
      )}
    </div>
  );
}
```

---

## See Also

- [Live Cursors](./cursors.md) — viewport-aware cursor broadcasting with `viewportPos` and `viewportScale`
- [Cursor Follow Architecture](../cursor-follow-architecture.md) — technical deep dive on the follow data flow
