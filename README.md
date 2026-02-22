# Lively

Real-time collaboration framework for React. CRDT storage, presence, cursors, live state, and undo/redo — all over WebSockets.

## Packages

| Package | Description |
|---------|-------------|
| [`@waits/lively-types`](packages/types/) | Shared TypeScript types and wire protocol definitions |
| [`@waits/lively-storage`](packages/storage/) | CRDT primitives — `LiveObject`, `LiveMap`, `LiveList` |
| [`@waits/lively-client`](packages/client/) | Framework-agnostic client SDK (browser + Node/Bun) |
| [`@waits/lively-server`](packages/server/) | WebSocket collaboration server |
| [`@waits/lively-react`](packages/react/) | React hooks and providers (40+ hooks) |
| [`@waits/lively-ui`](packages/ui/) | Pre-built components — cursors, avatars, connection badge |
| [`@waits/lively-cli`](packages/cli/) | `lively` dev server CLI |

## Architecture

```
types (base)
  |
storage (CRDT)
  |
client (SDK)            server (WebSocket)
  |                       |
react (hooks)           [standalone]
  |
ui (components)
```

Each layer depends only on layers below it.

## Quick Start

**Server:**

```ts
import { LivelyServer } from "@waits/lively-server";

const server = new LivelyServer({ port: 1999 });
await server.start();
```

**Client (React):**

```tsx
import { LivelyClient } from "@waits/lively-client";
import { LivelyProvider, RoomProvider } from "@waits/lively-react";
import { CursorOverlay, AvatarStack, useCursorTracking } from "@waits/lively-ui";

const client = new LivelyClient({ serverUrl: "ws://localhost:1999" });

function App() {
  return (
    <LivelyProvider client={client}>
      <RoomProvider
        roomId="my-room"
        userId={user.id}
        displayName={user.name}
        initialStorage={{ count: 0 }}
      >
        <Toolbar />
        <Canvas />
      </RoomProvider>
    </LivelyProvider>
  );
}

function Canvas() {
  const { ref, onMouseMove } = useCursorTracking<HTMLDivElement>();
  const count = useStorage(root => root.get("count"));
  const increment = useMutation(({ storage }) => {
    storage.root.set("count", (storage.root.get("count") as number) + 1);
  }, []);

  return (
    <div ref={ref} onMouseMove={onMouseMove} className="relative">
      <CursorOverlay />
      <p>Count: {count}</p>
      <button onClick={increment}>+1</button>
    </div>
  );
}

function Toolbar() {
  return <AvatarStack max={5} showStatus />;
}
```

## Features

- **CRDT Storage** — `LiveObject`, `LiveMap`, `LiveList` with automatic conflict resolution
- **Presence** — online/away/offline status, location tracking, custom metadata
- **Cursors** — real-time cursor tracking with viewport-aware follow mode
- **Live State** — ephemeral shared key-value state (not persisted)
- **Undo/Redo** — automatic inverse op capture, batch support
- **Broadcast Events** — custom ephemeral events between clients
- **Activity Tracking** — automatic inactivity detection (away/offline)
- **Follow Mode** — Figma-style "follow user" with viewport sync
- **Suspense** — `useStorageSuspense` and SSR-safe `ClientSideSuspense`

## Examples

| Example | Description |
|---------|-------------|
| [`nextjs-todo`](examples/nextjs-todo/) | Collaborative todo list with `LiveList`, drag-and-drop, presence |
| [`nextjs-whiteboard`](examples/nextjs-whiteboard/) | Full collaborative canvas with shapes, connectors, follow mode |

## Documentation

- [Getting Started](docs/guides/getting-started.md)
- [Server Guide](docs/guides/server.md)
- [Architecture](docs/architecture.md)
- [Hooks Reference](docs/hooks/) (14 docs covering all hook families)
- [Components](docs/components/)

## Development

```bash
bun install
bun run build:packages
bun run test:packages
```
