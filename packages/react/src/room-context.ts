import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  createElement,
  type ReactNode,
} from "react";
import type { Room } from "@waits/openblocks-client";
import type { LiveObject } from "@waits/openblocks-client";
import { useClient } from "./client-context.js";

const RoomContext = createContext<Room | null>(null);
const StorageContext = createContext<{ root: LiveObject } | null>(null);

export { StorageContext };

export interface RoomProviderProps {
  roomId: string;
  userId: string;
  displayName: string;
  initialStorage?: Record<string, unknown>;
  cursorThrottleMs?: number;
  children: ReactNode;
}

export function RoomProvider({
  roomId,
  userId,
  displayName,
  initialStorage,
  cursorThrottleMs,
  children,
}: RoomProviderProps) {
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
    });
    roomRef.current = { room, roomId };
  }
  const room = roomRef.current.room;

  useEffect(() => {
    setStorage(null);
    let cancelled = false;

    room.getStorage().then((s) => {
      if (!cancelled) setStorage(s);
    });

    return () => {
      cancelled = true;
      client.leaveRoom(roomId);
      roomRef.current = null;
    };
  }, [roomId, room, client]);

  return createElement(
    RoomContext.Provider,
    { value: room },
    createElement(StorageContext.Provider, { value: storage }, children)
  );
}

export function useRoom(): Room {
  const room = useContext(RoomContext);
  if (!room) {
    throw new Error("useRoom must be used within a <RoomProvider>");
  }
  return room;
}

export function useStorageRoot(): { root: LiveObject } | null {
  return useContext(StorageContext);
}
