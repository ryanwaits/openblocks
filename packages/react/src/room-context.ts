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
import type { Room } from "@waits/openblocks-client";
import type { LiveObject } from "@waits/openblocks-client";
import { useClient } from "./client-context.js";

const RoomContext = createContext<Room | null>(null);
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
  children: ReactNode;
}

/**
 * Joins a room and provides it to child hooks. Creates the room synchronously
 * on first render. Leaves the room on unmount.
 *
 * Must be nested inside `<OpenBlocksProvider>`.
 *
 * @example
 * <OpenBlocksProvider client={client}>
 *   <RoomProvider roomId="my-room" userId={uid} displayName={name}>
 *     <App />
 *   </RoomProvider>
 * </OpenBlocksProvider>
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

    // Send initial presence metadata if provided
    if (location || presenceMetadata) {
      (room as any).updatePresence?.({
        ...(location && { location }),
        ...(presenceMetadata && { metadata: presenceMetadata }),
      });
    }

    room.getStorage().then((s) => {
      if (!cancelled) setStorage(s);
    });

    return () => {
      cancelled = true;
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
 * Returns the raw `{ root: LiveObject }` storage object, or `null` while loading.
 * Prefer `useStorage(selector)` in application code.
 */
export function useStorageRoot(): { root: LiveObject } | null {
  return useContext(StorageContext);
}
