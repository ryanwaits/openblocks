"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { OpenBlocksClient, Room, LiveObject, LiveMap } from "@waits/openblocks-client";
import type { ConnectionStatus } from "@waits/openblocks-client";

// ── Singleton client ────────────────────────────────────────
const serverUrl =
  process.env.NEXT_PUBLIC_OPENBLOCKS_HOST || "http://localhost:1999";

const client = new OpenBlocksClient({ serverUrl, reconnect: true });

// ── Context ─────────────────────────────────────────────────
interface BoardRoomCtx {
  room: Room;
  root: LiveObject | null;
  status: ConnectionStatus;
}

const BoardRoomContext = createContext<BoardRoomCtx | null>(null);

export function useBoardRoom(): BoardRoomCtx {
  const ctx = useContext(BoardRoomContext);
  if (!ctx) throw new Error("useBoardRoom must be inside <BoardRoomProvider>");
  return ctx;
}

// ── Provider ────────────────────────────────────────────────
interface BoardRoomProviderProps {
  roomId: string;
  userId: string;
  displayName: string;
  children: ReactNode;
}

function buildInitialStorage() {
  const defaultFrameId = crypto.randomUUID();
  return {
    objects: new LiveMap<LiveObject>(),
    frames: new LiveMap<LiveObject>([
      [
        defaultFrameId,
        new LiveObject({ id: defaultFrameId, index: 0, label: "Frame 1" }),
      ],
    ]),
  };
}

export function BoardRoomProvider({
  roomId,
  userId,
  displayName,
  children,
}: BoardRoomProviderProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [root, setRoot] = useState<LiveObject | null>(null);

  useEffect(() => {
    const r = client.joinRoom(roomId, {
      userId,
      displayName,
      initialStorage: buildInitialStorage(),
    });
    setRoom(r);
    setStatus(r.getStatus());

    const unsubStatus = r.subscribe("status", (s: ConnectionStatus) => {
      setStatus(s);
    });

    let cancelled = false;
    r.getStorage().then((s) => {
      if (!cancelled) {
        setRoot(s.root);
      }
    });

    return () => {
      cancelled = true;
      unsubStatus();
      client.leaveRoom(roomId);
    };
  }, [roomId, userId, displayName]);

  if (!room) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="text-gray-400">Connecting...</div>
      </div>
    );
  }

  return (
    <BoardRoomContext.Provider value={{ room, root, status }}>
      {children}
    </BoardRoomContext.Provider>
  );
}

// Re-export client for AI route usage
export { client };
