import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  createElement,
  type Context,
  type ReactNode,
} from "react";
import type { Room } from "@waits/lively-client";
import type { LiveObject } from "@waits/lively-client";
import { useClient } from "./client-context.js";

export const RoomContext: Context<Room | null> = createContext<Room | null>(null);
const StorageContext: Context<{ root: LiveObject } | null> = createContext<{ root: LiveObject } | null>(null);

export { StorageContext };

export interface RoomProviderProps {
  /** Unique room identifier — all clients with the same roomId share a session */
  roomId: string;
  /** Stable identifier for the current user */
  userId: string;
  /** Display name shown to other participants */
  displayName: string;
  /** CRDT values written to storage on first connection if storage is empty */
  initialStorage?: Record<string, unknown>;
  /** Throttle interval for cursor broadcasts in ms (default: 50) */
  cursorThrottleMs?: number;
  /** Time in ms before marking user as away */
  inactivityTime?: number;
  /** Time in ms before marking user as offline */
  offlineInactivityTime?: number;
  /** Location identifier for this client */
  location?: string;
  /** Arbitrary presence metadata */
  presenceMetadata?: Record<string, unknown>;
  /** Authentication token sent as query param on WebSocket connect */
  token?: string;
  children: ReactNode;
}

/**
 * Joins a room and provides it to child hooks. Creates the room synchronously
 * on first render. Leaves the room on unmount.
 *
 * Must be nested inside `<LivelyProvider>`.
 *
 * @example
 * <LivelyProvider client={client}>
 *   <RoomProvider roomId="my-room" userId={uid} displayName={name}>
 *     <App />
 *   </RoomProvider>
 * </LivelyProvider>
 */
export function RoomProvider({
  roomId,
  userId,
  displayName,
  initialStorage,
  cursorThrottleMs,
  inactivityTime,
  offlineInactivityTime,
  location,
  presenceMetadata,
  token,
  children,
}: RoomProviderProps): ReactNode {
  const client = useClient();
  const [storage, setStorage] = useState<{ root: LiveObject } | null>(null);

  // Synchronously join room — client.joinRoom is idempotent (returns existing room)
  const roomRef = useRef<{ room: Room; roomId: string } | null>(null);
  if (!roomRef.current || roomRef.current.roomId !== roomId) {
    const room = client.joinRoom(roomId, {
      userId,
      displayName,
      initialStorage,
      cursorThrottleMs,
      inactivityTime,
      offlineInactivityTime,
      token,
    });
    roomRef.current = { room, roomId };
  }
  const room = roomRef.current.room;

  // Track mount state so deferred cleanup can distinguish strict-mode
  // remount (immediate re-mount in same tick) from real unmount.
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setStorage(null);
    let cancelled = false;

    // Ensure connected — handles strict-mode remount after prior cleanup
    room.connect();

    // Send location/metadata once connected (and on every reconnect).
    // updatePresence requires an open WebSocket, so we cannot fire it
    // synchronously after connect() — the handshake is async.
    let unsubStatus: (() => void) | undefined;
    if (location || presenceMetadata) {
      const sendPresence = () => {
        (room as any).updatePresence?.({
          ...(location && { location }),
          ...(presenceMetadata && { metadata: presenceMetadata }),
        });
      };
      if (room.getStatus() === "connected") {
        sendPresence();
      }
      unsubStatus = room.subscribe("status", (status) => {
        if (status === "connected") sendPresence();
      });
    }

    room.getStorage().then((s) => {
      if (!cancelled) setStorage(s);
    });

    // After reconnection, applySnapshot replaces the root. Update React state
    // so useMutation / useLivelySync closures see the new tree.
    const unsubReset = (room as any).onStorageReset?.((newRoot: LiveObject) => {
      if (!cancelled) setStorage({ root: newRoot });
    });

    return () => {
      cancelled = true;
      unsubStatus?.();
      unsubReset?.();
      mountedRef.current = false;
      // Defer leaveRoom so strict-mode's synchronous remount can cancel it
      const capturedRoomId = roomId;
      setTimeout(() => {
        if (!mountedRef.current || roomRef.current?.roomId !== capturedRoomId) {
          client.leaveRoom(capturedRoomId);
        }
      }, 0);
    };
  }, [roomId, room, client]);

  return createElement(
    RoomContext.Provider,
    { value: room },
    createElement(StorageContext.Provider, { value: storage }, children)
  );
}

/**
 * Returns the current `Room` instance. Must be inside `<RoomProvider>`.
 * Throws if called outside a provider.
 */
export function useRoom(): Room {
  const room = useContext(RoomContext);
  if (!room) {
    throw new Error("useRoom must be used within a <RoomProvider>");
  }
  return room;
}

/**
 * Returns `true` when called inside a `<RoomProvider>`, `false` otherwise.
 * Useful for conditional rendering or guarding hook usage.
 */
export function useIsInsideRoom(): boolean {
  return useContext(RoomContext) !== null;
}

/**
 * Returns the raw `{ root: LiveObject }` storage object, or `null` while loading.
 * Prefer `useStorage(selector)` in application code.
 */
export function useStorageRoot(): { root: LiveObject } | null {
  return useContext(StorageContext);
}
