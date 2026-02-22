# Broadcast Events

Fire-and-forget messages to every client in a room. Unlike storage mutations, events are **not persisted** -- they're delivered once and gone. Think of them as a real-time pub/sub channel scoped to a room.

If a client is disconnected when an event fires, they miss it. No replay, no catch-up.

---

## API Reference

| Hook | Signature | Description |
|------|-----------|-------------|
| `useBroadcastEvent` | `useBroadcastEvent<T>()` | Returns a stable `broadcast` function that sends an event to all **other** clients |
| `useEventListener` | `useEventListener<T>(callback)` | Subscribes to incoming events; cleans up on unmount |

Both hooks are available from `@waits/lively-react` (and from `@waits/lively-react/suspense`).

```ts
import { useBroadcastEvent, useEventListener } from "@waits/lively-react";
```

---

## `useBroadcastEvent`

Returns a **stable** (memoized via `useCallback`) function that sends a custom event to all other clients in the room. The sender does **not** receive the event back -- the server excludes the sender when relaying.

### Signature

```ts
function useBroadcastEvent<
  T extends { type: string } = { type: string; [key: string]: unknown }
>(): (event: T) => void;
```

### Constraints

- Every event **must** have a `type` field (string). This is enforced by the generic constraint.
- The returned function is reference-stable across re-renders (safe to omit from dependency arrays).
- Events are serialized as JSON and sent over the WebSocket. Keep payloads small.
- If the connection is down, the event is silently dropped (no queue, no retry).

### Example

```tsx
import { useBroadcastEvent } from "@waits/lively-react";

type AppEvent =
  | { type: "emoji"; emoji: string }
  | { type: "ping"; targetUserId: string };

function EmojiButton() {
  const broadcast = useBroadcastEvent<AppEvent>();

  return (
    <button onClick={() => broadcast({ type: "emoji", emoji: "👍" })}>
      React
    </button>
  );
}
```

---

## `useEventListener`

Subscribes to **all** custom events broadcast by other clients. The callback is stored in a ref internally, so you never need to memoize it -- the hook always calls the latest version.

### Signature

```ts
function useEventListener<
  T extends Record<string, unknown> = Record<string, unknown>
>(
  callback: (event: T) => void
): void;
```

### Behavior

- The subscription is created on mount and torn down on unmount.
- If the callback reference changes between renders, the hook uses the latest one (ref pattern). No stale closures.
- Events arrive as parsed JSON objects. The `type` field is always present.

### Example

```tsx
import { useEventListener } from "@waits/lively-react";

type AppEvent =
  | { type: "emoji"; emoji: string }
  | { type: "ping"; targetUserId: string };

function EventToast() {
  useEventListener<AppEvent>((event) => {
    switch (event.type) {
      case "emoji":
        showToast(`Someone reacted: ${event.emoji}`);
        break;
      case "ping":
        if (event.targetUserId === myUserId) {
          playSound("ping");
        }
        break;
    }
  });

  return null;
}
```

---

## When to use broadcast events

> **Events are for ephemeral, real-time communication. Storage is for persisted state.**

| Scenario | Use Events | Use Storage | Use Live State |
|----------|:----------:|:-----------:|:--------------:|
| "User is typing" indicator | Yes | No | No |
| Emoji reaction animation | Yes | No | No |
| Notification / alert | Yes | No | No |
| Sound effect trigger | Yes | No | No |
| Todo item created | No | Yes | No |
| Chat message (with history) | No | Yes | No |
| Chat message (no history) | Maybe | No | No |
| "Follow me" navigation nudge | Yes | No | No |
| Current slide (all viewers sync) | No | No | Yes |
| Cursor position | No (use cursor hooks) | No | No |

The key distinctions:

- **Storage** (`useMutation`) -- persisted, survives disconnects, late-joiners get current state.
- **Live State** (`useLiveState`) -- ephemeral but "catchable": late-joiners receive the latest value on connect. Gone when the room empties.
- **Events** (`useBroadcastEvent`) -- truly ephemeral: if you weren't connected, you missed it.

---

## Real-world use cases

### 1. Emoji reactions / confetti

User clicks a reaction button; all clients show a brief animation. Ephemeral by nature -- no need to persist "someone clapped 3 seconds ago."

```tsx
// types.ts
type ReactionEvent = { type: "reaction"; emoji: string; x: number; y: number };

// ReactionButton.tsx
import { useBroadcastEvent } from "@waits/lively-react";

function ReactionButton({ emoji }: { emoji: string }) {
  const broadcast = useBroadcastEvent<ReactionEvent>();

  return (
    <button
      onClick={() =>
        broadcast({
          type: "reaction",
          emoji,
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
        })
      }
    >
      {emoji}
    </button>
  );
}

// ReactionOverlay.tsx
import { useEventListener } from "@waits/lively-react";
import { useState } from "react";

function ReactionOverlay() {
  const [reactions, setReactions] = useState<
    { id: number; emoji: string; x: number; y: number }[]
  >([]);

  useEventListener<ReactionEvent>((event) => {
    if (event.type !== "reaction") return;

    const id = Date.now();
    setReactions((prev) => [...prev, { id, emoji: event.emoji, x: event.x, y: event.y }]);

    // Remove after animation completes
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2000);
  });

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {reactions.map((r) => (
        <span
          key={r.id}
          className="absolute animate-float-up text-3xl"
          style={{ left: r.x, top: r.y }}
        >
          {r.emoji}
        </span>
      ))}
    </div>
  );
}
```

```css
@keyframes float-up {
  0% { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-120px) scale(1.5); }
}
.animate-float-up {
  animation: float-up 2s ease-out forwards;
}
```

---

### 2. Toast notifications

"Alice added a new item." Broadcast the event, each client shows a toast.

```tsx
import { useBroadcastEvent, useEventListener, useSelf } from "@waits/lively-react";
import { toast } from "sonner"; // or any toast library

type NotifyEvent = { type: "notify"; message: string; sender: string };

function useNotifyOthers() {
  const broadcast = useBroadcastEvent<NotifyEvent>();
  const self = useSelf();

  return (message: string) => {
    broadcast({
      type: "notify",
      message,
      sender: self?.displayName ?? "Someone",
    });
  };
}

function NotificationListener() {
  useEventListener<NotifyEvent>((event) => {
    if (event.type === "notify") {
      toast(`${event.sender}: ${event.message}`);
    }
  });

  return null;
}
```

---

### 3. "Follow me" / navigation sync

A presenter broadcasts "navigate to slide 5"; viewers receive it and scroll. Unlike `useLiveState` (which would keep everyone locked to the same slide permanently), events are one-shot nudges -- viewers can ignore or navigate away afterward.

```tsx
type NavigateEvent = { type: "navigate"; slideIndex: number };

function PresenterControls({ currentSlide }: { currentSlide: number }) {
  const broadcast = useBroadcastEvent<NavigateEvent>();

  return (
    <button onClick={() => broadcast({ type: "navigate", slideIndex: currentSlide })}>
      Bring everyone here
    </button>
  );
}

function ViewerSlideListener({
  onNavigate,
}: {
  onNavigate: (index: number) => void;
}) {
  useEventListener<NavigateEvent>((event) => {
    if (event.type === "navigate") {
      onNavigate(event.slideIndex);
    }
  });

  return null;
}
```

> If you want viewers to **always** stay on the presenter's slide (not just get a one-shot nudge), use `useLiveState("currentSlide", 0)` instead.

---

### 4. Collaborative ping / attention

Click on a user's avatar to "ping" them. Broadcast a targeted event; the recipient shows a visual indicator.

```tsx
type PingEvent = { type: "ping"; targetUserId: string; senderName: string };

function PingButton({ targetUserId }: { targetUserId: string }) {
  const broadcast = useBroadcastEvent<PingEvent>();
  const self = useSelf();

  return (
    <button
      onClick={() =>
        broadcast({
          type: "ping",
          targetUserId,
          senderName: self?.displayName ?? "Someone",
        })
      }
    >
      Ping
    </button>
  );
}

function PingReceiver({ myUserId }: { myUserId: string }) {
  const [pinged, setPinged] = useState(false);

  useEventListener<PingEvent>((event) => {
    if (event.type === "ping" && event.targetUserId === myUserId) {
      setPinged(true);
      setTimeout(() => setPinged(false), 3000);
    }
  });

  return pinged ? (
    <div className="animate-pulse rounded-full bg-blue-500 p-2 text-white">
      You were pinged!
    </div>
  ) : null;
}
```

> Note: the event goes to **all** clients, but only the targeted user acts on it. For truly private messages, you'd need a server-side relay with filtering -- broadcast events are room-wide.

---

### 5. Sound effects

Multiplayer game: broadcast "explosion at (x, y)", each client plays the sound locally.

```tsx
type SoundEvent = { type: "sound"; sound: "explosion" | "coin" | "jump"; x: number; y: number };

function triggerExplosion(broadcast: (e: SoundEvent) => void, x: number, y: number) {
  // Play locally for the sender
  playSound("explosion");
  // Notify everyone else
  broadcast({ type: "sound", sound: "explosion", x, y });
}

function SoundListener() {
  useEventListener<SoundEvent>((event) => {
    if (event.type === "sound") {
      playSound(event.sound);
    }
  });

  return null;
}
```

> Since the sender is excluded from receiving their own broadcast, trigger the local effect separately (as shown above).

---

## When NOT to use broadcast events

- **State that needs to persist** -- use `useMutation` + storage. Events vanish the instant they're delivered.
- **State that late-joiners need** -- events are missed if you weren't connected. Use `useLiveState` for ephemeral-but-catchable state.
- **High-frequency positional data** -- use `useCursors` / `useUpdateCursor` (optimized with throttling, built-in cleanup on disconnect).
- **Critical operations** -- events are best-effort over WebSocket. Don't use them as the sole trigger for writes to a database or other irreversible actions.

---

## Patterns & tips

### Type your events with a discriminated union

Define a single union type for all events in your app. This gives you exhaustive type checking in listeners.

```ts
type AppEvent =
  | { type: "reaction"; emoji: string }
  | { type: "ping"; targetUserId: string }
  | { type: "navigate"; slideIndex: number }
  | { type: "sound"; sound: string; x: number; y: number };

// Sender
const broadcast = useBroadcastEvent<AppEvent>();

// Receiver
useEventListener<AppEvent>((event) => {
  switch (event.type) {
    case "reaction":
      // event.emoji is typed
      break;
    case "ping":
      // event.targetUserId is typed
      break;
    // ...
  }
});
```

### The sender doesn't receive their own event

The server excludes the sender's connection when relaying custom messages. If you need the sender to also react (e.g., play a sound), trigger the local effect explicitly before or after calling `broadcast`.

### Combine with `useLiveState` for best of both worlds

Use events for the animation trigger, live state for the persistent indicator:

```tsx
// Sender: set live state AND broadcast the animation trigger
const [, setHighlight] = useLiveState("highlighted", null);
const broadcast = useBroadcastEvent<{ type: "highlight-flash"; itemId: string }>();

function highlightItem(itemId: string) {
  setHighlight(itemId);                                    // persists for late-joiners
  broadcast({ type: "highlight-flash", itemId });          // triggers animation for current viewers
}
```

### Keep payloads small

Events are not compressed or batched. Each call to `broadcast` sends one WebSocket frame. If you need to send large data, put it in storage and broadcast a lightweight "check storage" event.

### Events work during batching

If you call `broadcast` inside a `room.batch()` callback, the event is queued and flushed at the end of the batch alongside any storage ops. No special handling needed.

---

## Under the hood

1. `useBroadcastEvent` calls `room.send(event)` which serializes to JSON and sends over the WebSocket.
2. The server's message handler hits the `default` case for any message type that isn't a known protocol message (`presence`, `cursor:update`, `storage:*`, `state:*`).
3. The server relays the message to all connections in the room **except the sender**.
4. On receiving clients, the message hits the `default` case in `handleMessage`, which emits on the internal `"message"` event channel.
5. `useEventListener` subscribes to `room.subscribe("message", ...)` and invokes your callback.
