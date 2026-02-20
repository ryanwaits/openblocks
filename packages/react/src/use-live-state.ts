import { useSyncExternalStore, useCallback, useRef, useMemo } from "react";
import { useRoom } from "./room-context.js";

/**
 * Syncs ephemeral state across all clients via a key-value store.
 * Like `useState` but shared across all room participants.
 *
 * @param key - Unique key for this state
 * @param initialValue - Default value if no state exists
 * @param opts - Options: `syncDuration` debounce in ms (default 50)
 */
export function useLiveState<T>(
  key: string,
  initialValue: T,
  opts?: { syncDuration?: number }
): [T, (value: T | ((prev: T) => T)) => void] {
  const room = useRoom();
  const syncDuration = opts?.syncDuration ?? 50;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<T>(initialValue);

  const value = useSyncExternalStore(
    useCallback(
      (cb) => (room as any).subscribeLiveState(key, cb),
      [room, key]
    ),
    useCallback(() => {
      const v = (room as any).getLiveState(key);
      const result = v !== undefined ? (v as T) : initialValue;
      latestRef.current = result;
      return result;
    }, [room, key, initialValue]),
    () => initialValue
  );

  const setter = useCallback(
    (valueOrFn: T | ((prev: T) => T)) => {
      const nextValue =
        typeof valueOrFn === "function"
          ? (valueOrFn as (prev: T) => T)(latestRef.current)
          : valueOrFn;

      latestRef.current = nextValue;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        (room as any).setLiveState(key, nextValue);
        timerRef.current = null;
      }, syncDuration);
    },
    [room, key, syncDuration]
  );

  return [value, setter];
}

/**
 * Read-only subscription to a live state key.
 */
export function useLiveStateData<T>(key: string): T | undefined {
  const room = useRoom();

  return useSyncExternalStore(
    useCallback(
      (cb) => (room as any).subscribeLiveState(key, cb),
      [room, key]
    ),
    useCallback(() => (room as any).getLiveState(key) as T | undefined, [room, key]),
    () => undefined
  );
}

/**
 * Returns a stable setter function for a live state key.
 */
export function useSetLiveState<T>(
  key: string
): (value: T, opts?: { merge?: boolean }) => void {
  const room = useRoom();
  return useCallback(
    (value: T, opts?: { merge?: boolean }) => {
      (room as any).setLiveState(key, value, opts);
    },
    [room, key]
  );
}
