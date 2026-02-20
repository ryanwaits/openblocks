# Connection Status

Monitor and respond to connection state changes in real time. The SDK provides automatic reconnection with exponential backoff, reactive hooks for status tracking, and a pre-built UI component for showing connection state to users.

---

## Connection Lifecycle

```
                                  initial connect
  ┌──────────────┐  ────────────────────────>  ┌──────────────┐
  │ disconnected  │                             │  connecting   │
  └──────────────┘  <────────────────────────  └──────────────┘
        ^              max retries exceeded           │
        │                                             │ socket opened
        │                                             v
        │                                      ┌──────────────┐
        │                                      │  connected    │
        │                                      └──────────────┘
        │                                             │
        │              intentional disconnect          │ connection lost
        │  <──────────────────────────────────        │
        │                                             v
        │                                      ┌──────────────┐
        └──────────────────────────────────────│ reconnecting  │
                    max retries exceeded       └──────────────┘
                                                      │
                                                      │ socket reopened
                                                      v
                                               ┌──────────────┐
                                               │  connected    │
                                               └──────────────┘
```

The `ConnectionManager` drives this lifecycle internally. On connection loss, it automatically retries with exponential backoff. When `disconnect()` is called explicitly (e.g., unmounting `RoomProvider`), no reconnection is attempted.

---

## API Reference

| Export | Package | Signature | Returns | Description |
|---|---|---|---|---|
| `useStatus` | `@waits/openblocks-react` | `()` | `ConnectionStatus` | Current connection status. Re-renders on change. |
| `useSyncStatus` | `@waits/openblocks-react` | `()` | `SyncStatus` | High-level sync status combining connection + storage state. Re-renders on change. |
| `useLostConnectionListener` | `@waits/openblocks-react` | `(callback: () => void)` | `void` | Fires `callback` once when connection drops from `"connected"` to `"reconnecting"`. |
| `useErrorListener` | `@waits/openblocks-react` | `(callback: (error: Error) => void)` | `void` | Fires on WebSocket-level errors. See [utility-hooks.md](./utility-hooks.md). |
| `ConnectionBadge` | `@waits/openblocks-ui` | `({ className? })` | `JSX.Element \| null` | Status pill. Returns `null` when connected. |
| `ConnectionStatus` | `@waits/openblocks-types` | -- | `type` | `"connecting" \| "connected" \| "reconnecting" \| "disconnected"` |
| `SyncStatus` | `@waits/openblocks-react` | -- | `type` | `"synchronized" \| "synchronizing" \| "not-synchronized"` |

---

## `useStatus`

```ts
import { useStatus } from "@waits/openblocks-react";

const status = useStatus();
// "connecting" | "connected" | "reconnecting" | "disconnected"
```

Returns the current `ConnectionStatus` string. Built on `useSyncExternalStore`, so it only triggers a re-render when the status actually changes. The server-side fallback value is `"disconnected"`.

### Status values

| Value | Meaning |
|---|---|
| `"connecting"` | Initial connection attempt in progress. Socket not yet open. |
| `"connected"` | WebSocket is open and healthy. Messages flow freely. |
| `"reconnecting"` | Connection was lost. Automatic retry in progress with exponential backoff. |
| `"disconnected"` | No active connection. Either intentionally closed or max retries exceeded. |

### Basic example -- conditional UI

```tsx
import { useStatus } from "@waits/openblocks-react";

function EditorStatus() {
  const status = useStatus();

  if (status === "connecting") {
    return <div className="text-muted-foreground">Connecting...</div>;
  }

  if (status === "reconnecting") {
    return <div className="text-yellow-600">Reconnecting...</div>;
  }

  if (status === "disconnected") {
    return <div className="text-red-600">Disconnected</div>;
  }

  return null; // connected -- nothing to show
}
```

### Loading state -- wait for connection before rendering

```tsx
import { useStatus } from "@waits/openblocks-react";

function App() {
  const status = useStatus();

  if (status === "connecting") {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner />
        <span className="ml-2 text-sm text-muted-foreground">
          Connecting to room...
        </span>
      </div>
    );
  }

  return <Editor />;
}
```

---

## `useLostConnectionListener`

```ts
import { useLostConnectionListener } from "@waits/openblocks-react";

useLostConnectionListener(() => {
  console.warn("Connection lost, reconnecting...");
});
```

Fires the callback **once** each time the status transitions from `"connected"` to `"reconnecting"`. Does **not** fire on intentional disconnects or on initial connection attempts.

The callback is stored in a ref internally, so you don't need to memoize it. Any closure will see fresh values at the time of invocation.

> **When to use this vs `useStatus`:** Use `useStatus` for rendering UI based on the current state. Use `useLostConnectionListener` for side effects that should happen exactly once per connection drop -- saving a local backup, logging, showing a toast.

### Example -- toast notification on disconnect

```tsx
import { useLostConnectionListener } from "@waits/openblocks-react";
import { toast } from "sonner";

function ConnectionMonitor() {
  useLostConnectionListener(() => {
    toast.warning("Connection lost. Reconnecting...");
  });

  return null;
}
```

---

## `useSyncStatus`

```ts
import { useSyncStatus } from "@waits/openblocks-react";

const sync = useSyncStatus();
// "synchronized" | "synchronizing" | "not-synchronized"
```

A higher-level status that combines connection state with storage loading state. While `useStatus` tells you about the WebSocket, `useSyncStatus` tells you whether the user's data is actually in sync.

### `SyncStatus` type

```ts
type SyncStatus = "synchronized" | "synchronizing" | "not-synchronized";
```

### Derivation logic

| Connection | Storage loaded? | SyncStatus |
|---|---|---|
| `"connected"` | Yes | `"synchronized"` |
| `"connected"` | No | `"synchronizing"` |
| `"connecting"` | -- | `"synchronizing"` |
| `"reconnecting"` | -- | `"synchronizing"` |
| `"disconnected"` | -- | `"not-synchronized"` |

### Example -- save indicator

```tsx
import { useSyncStatus } from "@waits/openblocks-react";

function SyncIndicator() {
  const sync = useSyncStatus();

  const config = {
    synchronized: { label: "Saved", color: "text-green-600", dot: "bg-green-500" },
    synchronizing: { label: "Saving...", color: "text-yellow-600", dot: "bg-yellow-500" },
    "not-synchronized": { label: "Offline", color: "text-red-600", dot: "bg-red-500" },
  }[sync];

  return (
    <div className={`flex items-center gap-1.5 text-sm ${config.color}`}>
      <div className={`h-2 w-2 rounded-full ${config.dot}`} />
      {config.label}
    </div>
  );
}
```

### Example -- disable editing while not synchronized

```tsx
import { useSyncStatus } from "@waits/openblocks-react";

function Editor() {
  const sync = useSyncStatus();
  const canEdit = sync === "synchronized";

  return (
    <div className={canEdit ? "" : "opacity-50 pointer-events-none"}>
      <textarea placeholder="Start typing..." disabled={!canEdit} />
      {!canEdit && (
        <p className="text-xs text-muted-foreground mt-1">
          {sync === "synchronizing" ? "Loading..." : "You are offline"}
        </p>
      )}
    </div>
  );
}
```

> **When to use `useSyncStatus` vs `useStatus`:** `useStatus` gives you the raw connection state (4 values). `useSyncStatus` gives you the user-facing sync state (3 values) that accounts for storage initialization. Use `useSyncStatus` for save indicators and edit-ability checks. Use `useStatus` when you need to distinguish `"connecting"` from `"reconnecting"`.

---

## `ConnectionBadge`

```tsx
import { ConnectionBadge } from "@waits/openblocks-ui";

<ConnectionBadge />
```

A pre-built status pill that renders only when the connection is **not** `"connected"`. Returns `null` in the happy path so it takes up no space when everything is healthy.

### Visual states

| Status | Appearance |
|---|---|
| `"connected"` | Hidden (`null`) |
| `"connecting"` | Yellow pill -- `bg-yellow-100 text-yellow-700` |
| `"reconnecting"` | Yellow pill -- `bg-yellow-100 text-yellow-700` |
| `"disconnected"` | Red pill -- `bg-red-100 text-red-700` |

The pill displays the raw status string as its label (e.g., "reconnecting", "disconnected").

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `className` | `string` | `undefined` | Additional CSS classes appended to the pill's class list. |

### Example -- toolbar placement

```tsx
import { ConnectionBadge } from "@waits/openblocks-ui";
import { AvatarStack } from "@waits/openblocks-ui";

function Toolbar() {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b">
      <h1 className="text-sm font-semibold flex-1">My Document</h1>
      <ConnectionBadge />
      <AvatarStack />
    </div>
  );
}
```

---

## Real-World Use Cases

### 1. "Reconnecting..." banner at the top of the page

Show a yellow warning bar when the connection drops. Auto-dismiss with a fade when reconnected.

```tsx
import { useStatus } from "@waits/openblocks-react";

function ReconnectingBanner() {
  const status = useStatus();
  const show = status === "reconnecting";

  return (
    <div
      className={`
        fixed top-0 inset-x-0 z-50
        bg-yellow-400 text-yellow-900 text-sm font-medium
        text-center py-2
        transition-transform duration-300
        ${show ? "translate-y-0" : "-translate-y-full"}
      `}
    >
      Reconnecting to server...
    </div>
  );
}

function App() {
  return (
    <>
      <ReconnectingBanner />
      <main className="pt-10">
        <Editor />
      </main>
    </>
  );
}
```

### 2. Offline indicator in toolbar with avatar stack

Compose `ConnectionBadge` alongside user avatars so collaborators can see connection health at a glance.

```tsx
import { ConnectionBadge, AvatarStack } from "@waits/openblocks-ui";
import { useOthers, useSelf } from "@waits/openblocks-react";

function CollaborationToolbar() {
  const self = useSelf();
  const others = useOthers();

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b bg-background">
      <span className="text-sm font-medium flex-1">Untitled Document</span>

      <ConnectionBadge className="mr-1" />

      <AvatarStack
        users={[self, ...others].filter(Boolean)}
        maxAvatars={5}
      />
    </div>
  );
}
```

### 3. Save warning -- "Changes may not be saved" toast

When the connection drops, warn the user. When it reconnects, confirm that changes are synced.

```tsx
import { useStatus, useLostConnectionListener } from "@waits/openblocks-react";
import { toast } from "sonner";
import { useEffect, useRef } from "react";

function SyncMonitor() {
  const status = useStatus();
  const toastIdRef = useRef<string | number | null>(null);

  useLostConnectionListener(() => {
    toastIdRef.current = toast.warning(
      "Changes may not be saved. Reconnecting...",
      { duration: Infinity }
    );
  });

  useEffect(() => {
    if (status === "connected" && toastIdRef.current !== null) {
      toast.dismiss(toastIdRef.current);
      toast.success("All changes synced.");
      toastIdRef.current = null;
    }
  }, [status]);

  return null;
}
```

### 4. Disable editing while disconnected

Disable mutation controls when the connection is not healthy. Users can still view content, but can't make changes that would be lost.

```tsx
import { useStatus, useMutation, useStorage } from "@waits/openblocks-react";

function TaskItem({ taskId }: { taskId: string }) {
  const status = useStatus();
  const disabled = status !== "connected";

  const task = useStorage((root) => root.get("tasks").get(taskId));

  const toggleDone = useMutation((storage) => {
    const tasks = storage.root.get("tasks");
    const task = tasks.get(taskId);
    if (task) {
      task.set("done", !task.get("done"));
    }
  });

  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={task?.get("done") ?? false}
        onChange={() => toggleDone()}
        disabled={disabled}
      />
      <span className={disabled ? "opacity-50" : ""}>{task?.get("title")}</span>
      {disabled && (
        <span className="text-xs text-muted-foreground">(read-only)</span>
      )}
    </div>
  );
}
```

### 5. Connection quality indicator

Track how often the connection drops. If reconnecting too frequently, suggest the user check their network.

```tsx
import { useLostConnectionListener, useStatus } from "@waits/openblocks-react";
import { useRef, useState } from "react";

function ConnectionQuality() {
  const status = useStatus();
  const dropsRef = useRef<number[]>([]);
  const [unstable, setUnstable] = useState(false);

  useLostConnectionListener(() => {
    const now = Date.now();
    // Keep only drops from the last 60 seconds
    dropsRef.current = dropsRef.current.filter((t) => now - t < 60_000);
    dropsRef.current.push(now);

    if (dropsRef.current.length >= 3) {
      setUnstable(true);
    }
  });

  if (!unstable) return null;

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm text-orange-800">
      <strong>Unstable connection detected.</strong>
      <p className="mt-1 text-orange-600">
        Your connection has dropped {dropsRef.current.length} times in the last
        minute. Please check your network or try moving closer to your router.
      </p>
      <button
        className="mt-2 text-xs underline"
        onClick={() => {
          dropsRef.current = [];
          setUnstable(false);
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
```

---

## Reconnection Behavior

The `ConnectionManager` handles reconnection automatically. In most cases, you never need to trigger a manual reconnect.

### Exponential backoff

| Parameter | Default | Description |
|---|---|---|
| `baseDelay` | `250ms` | Initial retry delay |
| `maxDelay` | `30,000ms` (30s) | Maximum retry delay cap |
| `maxRetries` | `10` | Attempts before giving up and moving to `"disconnected"` |
| `heartbeatIntervalMs` | `30,000ms` (30s) | Keepalive ping interval |

The delay for attempt `n` is calculated as:

```
delay = min(baseDelay * 2^n, maxDelay) + jitter
```

Where jitter is a random value up to 20% of the computed delay. This prevents thundering herd problems when many clients reconnect simultaneously after an outage.

### Retry schedule (defaults)

| Attempt | Base delay | With max jitter |
|---|---|---|
| 1 | 250ms | up to 300ms |
| 2 | 500ms | up to 600ms |
| 3 | 1,000ms | up to 1,200ms |
| 4 | 2,000ms | up to 2,400ms |
| 5 | 4,000ms | up to 4,800ms |
| 6 | 8,000ms | up to 9,600ms |
| 7 | 16,000ms | up to 19,200ms |
| 8 | 30,000ms (capped) | up to 36,000ms |
| 9 | 30,000ms | up to 36,000ms |
| 10 | 30,000ms | up to 36,000ms |

After 10 failed attempts, the status moves to `"disconnected"` and no further retries are made.

### Heartbeat

A `heartbeat` message is sent every 30 seconds to keep the connection alive. This is independent from the server-side heartbeat check (which marks connections as dead after 45 seconds of silence). The two work together:

```
Client                                  Server
  |                                       |
  |──── { type: "heartbeat" } (30s) ───> |
  |                                       |── check interval (15s)
  |                                       |   if no heartbeat for 45s:
  |                                       |     drop connection
  |                                       |     broadcast presence update
  |                                       |
```

---

## Patterns & Tips

- **Always show connection state somewhere in the UI.** Users need to know if their changes are syncing. `ConnectionBadge` is zero-effort -- it renders nothing when connected and shows a pill when something is wrong.

- **Don't block the entire UI on reconnection.** Let users continue viewing and editing content while reconnecting. Changes queue locally in the CRDT and sync when the connection is restored.

- **Use `useLostConnectionListener` for critical side effects.** If your app handles sensitive data, save a local backup to `localStorage` or `IndexedDB` when the connection drops. This gives users a safety net even if reconnection fails entirely.

- **Combine `useStatus` and `useLostConnectionListener` for nuanced UX.** Use `useStatus` for rendering (showing/hiding UI elements) and `useLostConnectionListener` for one-shot side effects (toasts, logging, backups). They complement each other.

- **Don't show "Connecting..." on every page load.** The initial `"connecting"` state is usually brief. Consider adding a short delay (e.g., 500ms) before showing a loading indicator to avoid a flash of "Connecting..." on fast connections.

  ```tsx
  function DelayedConnectionIndicator() {
    const status = useStatus();
    const [showIndicator, setShowIndicator] = useState(false);

    useEffect(() => {
      if (status !== "connecting") {
        setShowIndicator(false);
        return;
      }
      const timer = setTimeout(() => setShowIndicator(true), 500);
      return () => clearTimeout(timer);
    }, [status]);

    if (!showIndicator) return null;

    return <div className="text-muted-foreground text-sm">Connecting...</div>;
  }
  ```

- **Reconnection is automatic -- don't add a "Reconnect" button by default.** The backoff strategy handles transient failures. Only consider a manual reconnect button if your app sets `reconnect: false` or you want to let users retry after max retries are exhausted.
