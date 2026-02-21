import {
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { useRoom } from "./room-context.js";
import { useOthers } from "./use-others.js";
import { useSelf } from "./use-self.js";

export interface UseFollowUserOptions {
  onViewportChange?: (pos: { x: number; y: number }, scale: number) => void;
  /** Auto-exit follow mode on user interaction (default: true) */
  exitOnInteraction?: boolean;
  onAutoExit?: (reason: "disconnected" | "interaction") => void;
}

export interface UseFollowUserReturn {
  followingUserId: string | null;
  followUser: (userId: string) => void;
  stopFollowing: () => void;
  followers: string[];
  isBeingFollowed: boolean;
}

export function useFollowUser(
  opts: UseFollowUserOptions = {}
): UseFollowUserReturn {
  const room = useRoom();
  const others = useOthers();
  const self = useSelf();
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // Derive followingUserId from own presence metadata
  const followingUserId = useSyncExternalStore(
    useCallback((cb) => room.subscribe("presence", () => cb()), [room]),
    useCallback(() => room.getFollowing(), [room]),
    () => null
  );

  // Derive followers from others' presence metadata
  const followersCache = useRef<string[]>([]);
  const followers = useSyncExternalStore(
    useCallback((cb) => room.subscribe("presence", () => cb()), [room]),
    useCallback(() => {
      const next = room.getFollowers().sort();
      const prev = followersCache.current;
      if (
        prev.length === next.length &&
        prev.every((id, i) => id === next[i])
      ) {
        return prev;
      }
      followersCache.current = next;
      return next;
    }, [room]),
    () => [] as string[]
  );

  const followUser = useCallback(
    (userId: string) => room.followUser(userId),
    [room]
  );

  const stopFollowing = useCallback(() => room.stopFollowing(), [room]);

  // Subscribe to target's cursor viewport changes
  useEffect(() => {
    if (!followingUserId) return;

    const unsub = room.subscribe("cursors", () => {
      const cursors = room.getCursors();
      const targetCursor = cursors.get(followingUserId);
      if (
        targetCursor?.viewportPos &&
        targetCursor.viewportScale != null
      ) {
        optsRef.current.onViewportChange?.(
          targetCursor.viewportPos,
          targetCursor.viewportScale
        );
      }
    });

    return unsub;
  }, [room, followingUserId]);

  // Auto-exit when target disconnects
  useEffect(() => {
    if (!followingUserId) return;
    const stillHere = others.some((u) => u.userId === followingUserId);
    if (!stillHere) {
      room.stopFollowing();
      optsRef.current.onAutoExit?.("disconnected");
    }
  }, [room, followingUserId, others]);

  // Exit on user interaction
  useEffect(() => {
    if (!followingUserId) return;
    if (optsRef.current.exitOnInteraction === false) return;

    const handler = () => {
      room.stopFollowing();
      optsRef.current.onAutoExit?.("interaction");
    };

    document.addEventListener("wheel", handler, { passive: true });
    document.addEventListener("pointerdown", handler);

    return () => {
      document.removeEventListener("wheel", handler);
      document.removeEventListener("pointerdown", handler);
    };
  }, [room, followingUserId]);

  return {
    followingUserId,
    followUser,
    stopFollowing,
    followers,
    isBeingFollowed: followers.length > 0,
  };
}
