import type { LiveObject, LiveMap, LiveList } from "@waits/lively-client";
import { useStorage } from "./use-storage.js";

/**
 * Returns a `LiveObject<T>` stored at the given top-level key, or `null`
 * while storage is loading. The returned CRDT instance supports `.get()`,
 * `.set()`, etc. — mutations must be inside `useMutation` or `useBatch`.
 *
 * @example
 * const settings = useObject<{ theme: string }>("settings");
 * // Read: settings?.get("theme")
 * // Write (inside useMutation): settings.set("theme", "dark")
 */
export function useObject<T extends Record<string, unknown>>(
  key: string
): LiveObject<T> | null {
  return useStorage((root) => root.get(key) as LiveObject<T>) ?? null;
}

/**
 * Returns a `LiveMap<string, V>` stored at the given top-level key, or `null`
 * while storage is loading.
 *
 * @example
 * const users = useMap<UserData>("users");
 * // Read: users?.get("u1")
 */
export function useMap<V>(
  key: string
): LiveMap<string, V> | null {
  return useStorage((root) => root.get(key) as LiveMap<string, V>) ?? null;
}

/**
 * Returns a `LiveList<T>` stored at the given top-level key, or `null`
 * while storage is loading.
 *
 * @example
 * const items = useList<string>("items");
 * // Read: items?.toArray()
 */
export function useList<T>(
  key: string
): LiveList<T> | null {
  return useStorage((root) => root.get(key) as LiveList<T>) ?? null;
}
