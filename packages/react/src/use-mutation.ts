import { useMemo } from "react";
import type { LiveObject } from "@waits/openblocks-client";
import { useRoom, useStorageRoot } from "./room-context.js";

interface MutationContext {
  storage: { root: LiveObject };
}

export function useMutation<Args extends unknown[], R>(
  callback: (ctx: MutationContext, ...args: Args) => R,
  deps: unknown[]
): (...args: Args) => R {
  const room = useRoom();
  const storage = useStorageRoot();

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
