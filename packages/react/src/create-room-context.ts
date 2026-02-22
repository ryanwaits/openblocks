import type { LiveObject } from "@waits/lively-client";
import type { ConnectionStatus, PresenceUser, CursorData } from "@waits/lively-types";
import type { ReactNode } from "react";
import { RoomProvider, useRoom, useIsInsideRoom, useStorageRoot, type RoomProviderProps } from "./room-context.js";
import { useStorage } from "./use-storage.js";
import { useSelf } from "./use-self.js";
import { useMyPresence, useUpdateMyPresence, type PresenceUpdatePayload } from "./use-my-presence.js";
import { useOthers, useOther, useOthersMapped, useOthersUserIds } from "./use-others.js";
import { useOthersListener, type OthersEvent } from "./use-others-listener.js";
import { useMutation } from "./use-mutation.js";
import { useBatch } from "./use-batch.js";
import { useStatus, useLostConnectionListener, useSyncStatus, type SyncStatus } from "./use-status.js";
import { useErrorListener } from "./use-error-listener.js";
import { useBroadcastEvent } from "./use-broadcast-event.js";
import { useEventListener } from "./use-event-listener.js";
import { useUndo, useRedo, useCanUndo, useCanRedo, useHistory } from "./use-undo-redo.js";
import { useLiveState, useLiveStateData, useSetLiveState } from "./use-live-state.js";
import { useCursors, useUpdateCursor } from "./use-cursors.js";
import { useOthersOnLocation, usePresenceEvent } from "./use-presence-event.js";

interface MutationContext {
  storage: { root: LiveObject };
}

export interface RoomContextBundle<
  TPresence extends Record<string, unknown>,
  TStorage extends Record<string, unknown>,
> {
  // Providers
  RoomProvider: (props: RoomProviderProps) => ReactNode;
  useRoom: () => import("@waits/lively-client").Room;
  useIsInsideRoom: () => boolean;
  useStorageRoot: () => { root: LiveObject } | null;

  // Storage
  useStorage: <T>(selector: (root: LiveObject<TStorage>) => T) => T | null;
  useMutation: <Args extends unknown[], R>(
    callback: (ctx: MutationContext, ...args: Args) => R,
    deps: unknown[],
  ) => (...args: Args) => R;
  useBatch: () => <T>(fn: () => T) => T;

  // Presence
  useSelf: () => (PresenceUser & { presence: TPresence }) | null;
  useMyPresence: () => [
    (PresenceUser & { presence: TPresence }) | null,
    (data: Partial<TPresence>) => void,
  ];
  useUpdateMyPresence: () => (data: Partial<TPresence>) => void;
  useOthers: () => PresenceUser[];
  useOther: <T = PresenceUser>(userId: string, selector?: (u: PresenceUser) => T) => T | null;
  useOthersMapped: <T>(selector: (user: PresenceUser) => T) => T[];
  useOthersUserIds: () => string[];
  useOthersListener: (callback: (event: OthersEvent) => void) => void;

  // Connection
  useStatus: () => ConnectionStatus;
  useSyncStatus: () => SyncStatus;
  useLostConnectionListener: (callback: () => void) => void;
  useErrorListener: (callback: (error: Error) => void) => void;

  // Events
  useBroadcastEvent: <T extends { type: string } = { type: string; [key: string]: unknown }>() => (event: T) => void;
  useEventListener: <T extends Record<string, unknown> = Record<string, unknown>>(callback: (event: T) => void) => void;

  // Undo/redo
  useHistory: () => { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean };
  useUndo: () => () => void;
  useRedo: () => () => void;
  useCanUndo: () => boolean;
  useCanRedo: () => boolean;

  // Live state
  useLiveState: <T>(key: string, initialValue: T, opts?: { syncDuration?: number }) => [T, (value: T | ((prev: T) => T)) => void];
  useLiveStateData: <T>(key: string) => T | undefined;
  useSetLiveState: <T>(key: string) => (value: T, opts?: { merge?: boolean }) => void;

  // Cursors
  useCursors: () => Map<string, CursorData>;
  useUpdateCursor: () => (x: number, y: number, viewportPos?: { x: number; y: number }, viewportScale?: number) => void;

  // Location + presence events
  useOthersOnLocation: (locationId: string) => PresenceUser[];
  usePresenceEvent: (event: "stateChange", callback: (user: PresenceUser, prevStatus: string, newStatus: string) => void) => void;
}

/**
 * Creates a typed set of hooks scoped to your application's presence and
 * storage types. All hooks work identically to their direct-import
 * counterparts — the factory just narrows the generic parameters.
 *
 * @example
 * type Presence = { cursor: { x: number; y: number } | null };
 * type Storage = { count: number; items: LiveList<string> };
 *
 * const {
 *   RoomProvider,
 *   useStorage,
 *   useSelf,
 *   useMyPresence,
 * } = createRoomContext<Presence, Storage>();
 */
export function createRoomContext<
  TPresence extends Record<string, unknown> = Record<string, unknown>,
  TStorage extends Record<string, unknown> = Record<string, unknown>,
>(): RoomContextBundle<TPresence, TStorage> {
  // Typed wrappers — cast generic params, zero runtime overhead
  function useStorageTyped<T>(selector: (root: LiveObject<TStorage>) => T): T | null {
    return useStorage(selector as (root: LiveObject) => T);
  }

  function useSelfTyped(): (PresenceUser & { presence: TPresence }) | null {
    return useSelf() as (PresenceUser & { presence: TPresence }) | null;
  }

  function useMyPresenceTyped(): [(PresenceUser & { presence: TPresence }) | null, (data: Partial<TPresence>) => void] {
    const [self, update] = useMyPresence();
    return [
      self as (PresenceUser & { presence: TPresence }) | null,
      update as (data: Partial<TPresence>) => void,
    ];
  }

  function useUpdateMyPresenceTyped(): (data: Partial<TPresence>) => void {
    return useUpdateMyPresence() as (data: Partial<TPresence>) => void;
  }

  return {
    RoomProvider,
    useRoom,
    useIsInsideRoom,
    useStorageRoot,
    useStorage: useStorageTyped,
    useMutation,
    useBatch,
    useSelf: useSelfTyped,
    useMyPresence: useMyPresenceTyped,
    useUpdateMyPresence: useUpdateMyPresenceTyped,
    useOthers,
    useOther,
    useOthersMapped,
    useOthersUserIds,
    useOthersListener,
    useStatus,
    useSyncStatus,
    useLostConnectionListener,
    useErrorListener,
    useBroadcastEvent,
    useEventListener,
    useHistory,
    useUndo,
    useRedo,
    useCanUndo,
    useCanRedo,
    useLiveState,
    useLiveStateData,
    useSetLiveState,
    useCursors,
    useUpdateCursor,
    useOthersOnLocation,
    usePresenceEvent,
  };
}
