# useClient

Returns the `OpenBlocksClient` instance from context. Must be called inside `<OpenBlocksProvider>`.

```tsx
import { useClient } from "@waits/openblocks-react";
```

---

## API Reference

```ts
function useClient(): OpenBlocksClient;
```

Returns the `OpenBlocksClient` passed to `<OpenBlocksProvider client={client}>`. Throws if called outside a provider.

### Error Behavior

```
Error: useClient must be used within an <OpenBlocksProvider>
```

This error fires when `useClient` is called outside of an `<OpenBlocksProvider>` tree. Ensure the component is rendered as a descendant of the provider.

---

## When to Use

Most apps don't need `useClient` directly — `RoomProvider` and room-level hooks handle the common cases. Use `useClient` when you need:

- **Manual room management** — calling `client.joinRoom()` / `client.leaveRoom()` outside of `RoomProvider`
- **Multi-room orchestration** — listing or inspecting all active rooms via `client.getRooms()`
- **Passing the client to non-React code** — e.g., a canvas rendering engine or background service

---

## Examples

### List All Active Rooms

```tsx
function RoomDebugger() {
  const client = useClient();
  const rooms = client.getRooms();

  return (
    <ul>
      {rooms.map((room) => (
        <li key={room.id}>
          {room.id} — {room.getStatus()}
        </li>
      ))}
    </ul>
  );
}
```

### Manual Room Join

```tsx
function DynamicRoom({ roomId }: { roomId: string }) {
  const client = useClient();

  useEffect(() => {
    const room = client.joinRoom(roomId, {
      userId: "user-1",
      displayName: "Alice",
    });

    return () => {
      client.leaveRoom(roomId);
    };
  }, [client, roomId]);

  return <div>Joined {roomId}</div>;
}
```

---

## See Also

- [Getting Started](../guides/getting-started.md) — `OpenBlocksProvider` setup
- [Architecture](../architecture.md) — `OpenBlocksClient` API reference
