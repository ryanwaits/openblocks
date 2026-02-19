import { useMemo } from "react";
import type { LiveObject } from "@waits/openblocks-client";
import { useRoom, useStorageRoot } from "./room-context.js";

interface MutationContext {
  storage: { root: LiveObject };
}

/**
 * Returns a stable callback that mutates shared storage inside a `room.batch()`.
 * Throws if called before storage has loaded. Use after `useStorage` returns non-null.
 *
 * @param callback - Mutation logic; receives `{ storage: { root } }` as first arg
 * @param deps - Additional dependencies (like `useCallback` deps)
 *
 * @example
 * const addItem = useMutation(({ storage }, text: string) => {
 *   const list = storage.root.get("items") as LiveList;
 *   list.push(new LiveObject({ text }));
 * }, []);
 */
export function useMutation<Args extends unknown[], R>(
  callback: (ctx: MutationContext, ...args: Args) => R,
  deps: unknown[]
): (...args: Args) => R {
  const room = useRoom();
  const storage = useStorageRoot();

  return useMemo(
    () =>
      (...args: Args): R => {
        if (!storage) {
          throw new Error(
            "useMutation: storage not loaded yet. Wait for useStorage to return a non-null value."
          );
        }
        return room.batch(() =>
          callback({ storage: { root: storage.root } }, ...args)
        );
      },
    [room, storage, ...deps] // eslint-disable-line react-hooks/exhaustive-deps
  );
}
