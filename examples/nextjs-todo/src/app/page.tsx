"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  LivelyClient,
  LiveObject,
  LiveList,
} from "@waits/lively-client";
import {
  LivelyProvider,
  RoomProvider,
  useStorageSuspense,
  useMutation,
  useLiveState,
  useHistory,
  useUpdateMyPresence,
  useOthers,
  useSelf,
  useSyncStatus,
  useBroadcastEvent,
  useEventListener,
  useLostConnectionListener,
  useErrorListener,
  useOthersListener,
  ClientSideSuspense,
} from "@waits/lively-react";
import {
  AvatarStack,
  CursorOverlay,
  useCursorTracking,
} from "@waits/lively-ui";
import type { PresenceUser } from "@waits/lively-types";

// ── Lively client singleton ─────────────────────────────
const serverUrl =
  process.env.NEXT_PUBLIC_LIVELY_HOST || "http://localhost:2001";
const client = new LivelyClient({ serverUrl, reconnect: true });

// ── Types ───────────────────────────────────────────────────
interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  _index: number;
}

// ── Main page ───────────────────────────────────────────────
export default function TodoPage() {
  const [userId] = useState(() => crypto.randomUUID().slice(0, 8));
  const [displayName, setDisplayName] = useState("");
  const [joined, setJoined] = useState(false);

  if (!joined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-80 rounded-xl bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-semibold">Enter your name</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (displayName.trim()) setJoined(true);
            }}
          >
            <input
              className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={!displayName.trim()}
            >
              Join
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <LivelyProvider client={client}>
      <RoomProvider
        roomId="todo-default"
        userId={userId}
        displayName={displayName}
        initialStorage={{ todos: new LiveList([]) }}
      >
        <ClientSideSuspense fallback={<TodoSkeleton />}>
          {() => <TodoContent />}
        </ClientSideSuspense>
      </RoomProvider>
    </LivelyProvider>
  );
}

// ── Skeleton loading state ──────────────────────────────────
function TodoSkeleton() {
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-8 w-20 animate-pulse rounded bg-gray-200" />
      </div>
      <div className="mb-4 flex gap-2">
        <div className="h-10 flex-1 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-10 w-16 animate-pulse rounded-lg bg-gray-200" />
      </div>
      <div className="space-y-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-lg bg-gray-100"
          />
        ))}
      </div>
    </div>
  );
}

// ── Toast system ────────────────────────────────────────────
interface Toast {
  id: string;
  message: string;
  type: "info" | "warning" | "error";
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((message: string, type: Toast["type"]) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
  return { toasts, addToast, removeToast };
}

// ── Todo list UI ────────────────────────────────────────────
type FilterMode = "all" | "active" | "completed";

function TodoContent() {
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showPresencePanel, setShowPresencePanel] = useState(false);
  const presencePanelRef = useRef<HTMLDivElement>(null);

  const [filter, setFilter] = useLiveState<FilterMode>("filter", "all");
  const { undo, redo, canUndo, canRedo } = useHistory();

  const { ref, onMouseMove } = useCursorTracking<HTMLDivElement>();

  // Presence hooks
  const updatePresence = useUpdateMyPresence();
  const others = useOthers();
  const self = useSelf();

  // Sync status
  const syncStatus = useSyncStatus();

  // Broadcast events
  const broadcast = useBroadcastEvent<{ type: "celebration" }>();

  // Toasts
  const { toasts, addToast, removeToast } = useToasts();

  // Connection resilience
  useLostConnectionListener(() => {
    addToast("Connection lost, reconnecting...", "warning");
  });
  useErrorListener((err) => {
    addToast(err.message, "error");
  });

  // Join/leave notifications
  useOthersListener((event) => {
    if (event.type === "enter") {
      addToast(`${event.user.displayName} joined`, "info");
    } else if (event.type === "leave") {
      addToast(`${event.user.displayName} left`, "info");
    }
  });

  // Celebration event listener
  useEventListener<{ type: "celebration" }>((event) => {
    if (event.type === "celebration") {
      setShowCelebration(true);
    }
  });

  // Auto-dismiss celebration
  useEffect(() => {
    if (!showCelebration) return;
    const t = setTimeout(() => setShowCelebration(false), 3000);
    return () => clearTimeout(t);
  }, [showCelebration]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT") return;
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  // Click outside to close presence panel
  useEffect(() => {
    if (!showPresencePanel) return;
    const handler = (e: MouseEvent) => {
      if (presencePanelRef.current && !presencePanelRef.current.contains(e.target as Node)) {
        setShowPresencePanel(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPresencePanel]);

  const todos = useStorageSuspense((root) => {
    const list = root.get("todos") as LiveList<LiveObject> | undefined;
    if (!list) return [] as Todo[];
    return list.map((item, idx) => ({
      id: item.get("id") as string,
      text: item.get("text") as string,
      completed: item.get("completed") as boolean,
      createdAt: item.get("createdAt") as string,
      _index: idx,
    }));
  });

  // Track previous all-completed state for celebration
  const prevAllCompleteRef = useRef(false);
  useEffect(() => {
    if (todos.length === 0) {
      prevAllCompleteRef.current = false;
      return;
    }
    const allComplete = todos.every((t) => t.completed);
    if (allComplete && !prevAllCompleteRef.current) {
      broadcast({ type: "celebration" });
      setShowCelebration(true);
    }
    prevAllCompleteRef.current = allComplete;
  }, [todos, broadcast]);

  const addTodo = useMutation(({ storage }, text: string) => {
    const list = storage.root.get("todos") as LiveList<LiveObject>;
    list.push(
      new LiveObject({
        id: crypto.randomUUID(),
        text,
        completed: false,
        createdAt: new Date().toISOString(),
      })
    );
  }, []);

  const toggleTodo = useMutation(({ storage }, id: string) => {
    const list = storage.root.get("todos") as LiveList<LiveObject>;
    let idx = -1;
    list.forEach((item, i) => {
      if (item.get("id") === id) idx = i;
    });
    if (idx >= 0) {
      const item = list.get(idx) as LiveObject;
      item.set("completed", !item.get("completed"));
    }
  }, []);

  const deleteTodo = useMutation(({ storage }, id: string) => {
    const list = storage.root.get("todos") as LiveList<LiveObject>;
    let idx = -1;
    list.forEach((item, i) => {
      if (item.get("id") === id) idx = i;
    });
    if (idx >= 0) list.delete(idx);
  }, []);

  const updateTodoText = useMutation(
    ({ storage }, id: string, text: string) => {
      const list = storage.root.get("todos") as LiveList<LiveObject>;
      let idx = -1;
      list.forEach((item, i) => {
        if (item.get("id") === id) idx = i;
      });
      if (idx >= 0) {
        const item = list.get(idx) as LiveObject;
        item.set("text", text);
      }
    },
    []
  );

  const moveTodo = useMutation(
    ({ storage }, fromId: string, toIndex: number) => {
      const list = storage.root.get("todos") as LiveList<LiveObject>;
      let fromIdx = -1;
      list.forEach((item, i) => {
        if (item.get("id") === fromId) fromIdx = i;
      });
      if (fromIdx >= 0 && fromIdx !== toIndex) {
        list.move(fromIdx, toIndex);
      }
    },
    []
  );

  const completedCount = todos.filter((t) => t.completed).length;
  const filteredTodos = todos.filter((t) => {
    if (filter === "active") return !t.completed;
    if (filter === "completed") return t.completed;
    return true;
  });

  const startEditing = (todo: Todo) => {
    setEditingId(todo.id);
    setEditText(todo.text);
    updatePresence({ location: todo.id });
  };

  const commitEdit = () => {
    if (!editingId || !editText.trim()) return cancelEdit();
    updateTodoText(editingId, editText.trim());
    setEditingId(null);
    setEditText("");
    updatePresence({ location: "" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
    updatePresence({ location: "" });
  };

  const userCount = (self ? 1 : 0) + others.length;

  return (
    <div ref={ref} className="relative min-h-screen w-full" onMouseMove={onMouseMove}>
      {/* Live cursors */}
      <CursorOverlay />

      {/* Celebration banner */}
      {showCelebration && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 animate-bounce rounded-xl bg-green-500 px-6 py-3 text-sm font-semibold text-white shadow-lg">
          All tasks complete!
        </div>
      )}

      {/* Toast container */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${
                toast.type === "info"
                  ? "bg-blue-100 text-blue-800"
                  : toast.type === "warning"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-red-100 text-red-800"
              }`}
            >
              <span className="flex-1">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="ml-2 opacity-60 hover:opacity-100"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mx-auto max-w-lg px-4 py-12">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Collaborative Todos</h1>

            {/* Sync status */}
            {syncStatus === "synchronizing" && (
              <span className="flex items-center gap-1 text-xs text-yellow-600">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
                Syncing
              </span>
            )}
            {syncStatus === "not-synchronized" && (
              <span className="flex items-center gap-1 text-xs text-red-600">
                <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                Offline
              </span>
            )}

            <button
              onClick={undo}
              disabled={!canUndo}
              className="rounded p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
              title="Undo (Cmd+Z)"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h8a3 3 0 010 6H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M5 5L3 8l2 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="rounded p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
              title="Redo (Cmd+Shift+Z)"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 8H5a3 3 0 000 6h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M11 5l2 3-2 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <AvatarStack />

            {/* Presence panel toggle */}
            <div className="relative" ref={presencePanelRef}>
              <button
                onClick={() => setShowPresencePanel((v) => !v)}
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M2.5 12.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                {userCount}
              </button>

              {showPresencePanel && (
                <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
                  {self && (
                    <PresenceRow user={self} isSelf />
                  )}
                  {others.map((user) => (
                    <PresenceRow key={user.userId} user={user} />
                  ))}
                  {userCount === 0 && (
                    <p className="px-2 py-1 text-xs text-gray-400">No users connected</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Add todo form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newText.trim()) {
              addTodo(newText.trim());
              setNewText("");
            }
          }}
          className="mb-4 flex gap-2"
        >
          <input
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="What needs to be done?"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
          />
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={!newText.trim()}
          >
            Add
          </button>
        </form>

        {/* Filter tabs (synced across clients via useLiveState) */}
        {todos.length > 0 && (
          <div className="mb-3 flex gap-1 rounded-lg bg-gray-100 p-1">
            {(["all", "active", "completed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* Todo list */}
        <div className="space-y-1">
          {filteredTodos.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              {todos.length === 0
                ? "No todos yet. Add one above!"
                : `No ${filter} todos.`}
            </p>
          ) : (
            filteredTodos.map((todo, filteredIdx) => {
              const editingUsers = others.filter((u) => u.location === todo.id);
              const isDragging = dragId === todo.id;
              const isDropTarget = dragOverIdx === filteredIdx;

              return (
                <div
                  key={todo.id}
                  className={`group flex items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-sm transition-opacity ${
                    isDragging ? "opacity-50" : ""
                  } ${isDropTarget ? "border-t-2 border-blue-400" : "border-t-2 border-transparent"}`}
                  onDragOver={(e) => {
                    if (filter !== "all") return;
                    e.preventDefault();
                    setDragOverIdx(filteredIdx);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (filter !== "all" || !dragId) return;
                    moveTodo(dragId, todo._index);
                    setDragId(null);
                    setDragOverIdx(null);
                  }}
                >
                  {/* Drag grip handle — only in "all" filter */}
                  {filter === "all" && (
                    <span
                      draggable
                      onDragStart={(e) => {
                        setDragId(todo.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setDragOverIdx(null);
                      }}
                      className="cursor-grab text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
                    >
                      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                        <circle cx="3" cy="3" r="1.2" />
                        <circle cx="7" cy="3" r="1.2" />
                        <circle cx="3" cy="8" r="1.2" />
                        <circle cx="7" cy="8" r="1.2" />
                        <circle cx="3" cy="13" r="1.2" />
                        <circle cx="7" cy="13" r="1.2" />
                      </svg>
                    </span>
                  )}

                  {/* Checkbox */}
                  <button
                    onClick={() => toggleTodo(todo.id)}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                      todo.completed
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-gray-300 hover:border-blue-400"
                    }`}
                  >
                    {todo.completed && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path
                          d="M1 4L3.5 6.5L9 1"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>

                  {/* Text — inline edit on double click */}
                  {editingId === todo.id ? (
                    <input
                      className="flex-1 rounded border border-blue-400 px-1 py-0.5 text-sm outline-none"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit();
                        if (e.key === "Escape") cancelEdit();
                      }}
                      autoFocus
                    />
                  ) : (
                    <span
                      className={`flex-1 cursor-text text-sm ${todo.completed ? "text-gray-400 line-through" : ""}`}
                      onDoubleClick={() => startEditing(todo)}
                    >
                      {todo.text}
                    </span>
                  )}

                  {/* Who's editing indicators */}
                  {editingUsers.length > 0 && (
                    <div className="flex -space-x-1.5">
                      {editingUsers.map((u) => (
                        <span
                          key={u.userId}
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white ring-2 ring-white"
                          style={{ backgroundColor: u.color }}
                          title={`${u.displayName} is editing`}
                        >
                          {u.displayName.charAt(0).toUpperCase()}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Delete button */}
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="text-gray-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M4 4L12 12M12 4L4 12"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer stats */}
        {todos.length > 0 && (
          <p className="mt-4 text-xs text-gray-400">
            {completedCount} of {todos.length} completed
            <span className="ml-1 text-gray-300">
              &middot; double-click to edit
              {filter === "all" && " · drag to reorder"}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

// ── Presence panel row ──────────────────────────────────────
function PresenceRow({ user, isSelf }: { user: PresenceUser; isSelf?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ backgroundColor: user.color }}
      >
        {user.displayName.charAt(0).toUpperCase()}
      </span>
      <span className="flex-1 truncate text-sm text-gray-700">
        {user.displayName}
        {isSelf && <span className="ml-1 text-gray-400">(you)</span>}
      </span>
      {user.onlineStatus !== "online" && (
        <span className="text-[10px] text-gray-400">
          {user.onlineStatus === "away" ? "idle" : "offline"}
        </span>
      )}
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          user.onlineStatus === "online"
            ? "bg-green-500"
            : user.onlineStatus === "away"
              ? "bg-yellow-500"
              : "bg-gray-300"
        }`}
      />
    </div>
  );
}
