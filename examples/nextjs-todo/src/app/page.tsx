"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  OpenBlocksClient,
  Room,
  LiveObject,
  LiveMap,
} from "@waits/openblocks-client";
import type { ConnectionStatus, PresenceUser, CursorData } from "@waits/openblocks-client";

// ── OpenBlocks client singleton ─────────────────────────────
const serverUrl =
  process.env.NEXT_PUBLIC_OPENBLOCKS_HOST || "http://localhost:2001";
const client = new OpenBlocksClient({ serverUrl, reconnect: true });

// ── Types ───────────────────────────────────────────────────
interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
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

  return <TodoRoom userId={userId} displayName={displayName} />;
}

// ── Room wrapper — joins room + resolves storage ────────────
function TodoRoom({ userId, displayName }: { userId: string; displayName: string }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [root, setRoot] = useState<LiveObject | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  useEffect(() => {
    const r = client.joinRoom("todo-default", {
      userId,
      displayName,
      initialStorage: {
        todos: new LiveMap<LiveObject>(),
      },
    });
    setRoom(r);
    setStatus(r.getStatus());

    const unsub = r.subscribe("status", (s: ConnectionStatus) => setStatus(s));

    let cancelled = false;
    r.getStorage().then((s) => {
      if (!cancelled) setRoot(s.root);
    });

    return () => {
      cancelled = true;
      unsub();
      client.leaveRoom("todo-default");
    };
  }, [userId, displayName]);

  if (!room || !root) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-400">Connecting...</div>
      </div>
    );
  }

  return <TodoList room={room} root={root} status={status} userId={userId} />;
}

// ── Todo list UI ────────────────────────────────────────────
function TodoList({
  room, root, status, userId,
}: {
  room: Room;
  root: LiveObject;
  status: ConnectionStatus;
  userId: string;
}) {
  const [renderCount, forceRender] = useState(0);
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  // Subscribe to all storage changes to re-render
  useEffect(() => {
    return room.subscribe(root, () => forceRender((n) => n + 1), { isDeep: true });
  }, [room, root]);

  // Subscribe to presence
  const [allUsers, setAllUsers] = useState<PresenceUser[]>([]);
  useEffect(() => {
    setAllUsers(room.getPresence());
    return room.subscribe("presence", (users: PresenceUser[]) => setAllUsers(users));
  }, [room]);

  // Subscribe to cursors
  const [cursors, setCursors] = useState<Map<string, CursorData>>(new Map());
  useEffect(() => {
    return room.subscribe("cursors", () => {
      setCursors(new Map(room.getCursors()));
    });
  }, [room]);

  // Track mouse position → broadcast cursor (relative to content container)
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!contentRef.current) return;
      const rect = contentRef.current.getBoundingClientRect();
      room.updateCursor(e.clientX - rect.left, e.clientY - rect.top);
    },
    [room],
  );

  // Read todos from storage
  const todosMap = root.get("todos") as LiveMap<LiveObject> | undefined;
  const todos: Todo[] = useMemo(() => {
    if (!todosMap) return [];
    const result: Todo[] = [];
    todosMap.forEach((val, key) => {
      result.push({
        id: key,
        text: val.get("text") as string,
        completed: val.get("completed") as boolean,
        createdAt: val.get("createdAt") as string,
      });
    });
    result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return result;
  }, [todosMap, renderCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mutations
  const addTodo = () => {
    if (!newText.trim() || !todosMap) return;
    const id = crypto.randomUUID();
    room.batch(() => {
      todosMap.set(
        id,
        new LiveObject({
          text: newText.trim(),
          completed: false,
          createdAt: new Date().toISOString(),
        }),
      );
    });
    setNewText("");
  };

  const toggleTodo = (id: string) => {
    if (!todosMap) return;
    const todo = todosMap.get(id);
    if (!todo) return;
    room.batch(() => {
      todo.set("completed", !todo.get("completed"));
    });
  };

  const deleteTodo = (id: string) => {
    if (!todosMap) return;
    room.batch(() => {
      todosMap.delete(id);
    });
  };

  const startEditing = (todo: Todo) => {
    setEditingId(todo.id);
    setEditText(todo.text);
  };

  const commitEdit = () => {
    if (!editingId || !todosMap) return;
    const todo = todosMap.get(editingId);
    if (todo && editText.trim()) {
      room.batch(() => {
        todo.set("text", editText.trim());
      });
    }
    setEditingId(null);
    setEditText("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const completedCount = todos.filter((t) => t.completed).length;

  // Other users' cursors (exclude self)
  const otherCursors = useMemo(() => {
    const result: CursorData[] = [];
    cursors.forEach((c) => {
      if (c.userId !== userId) result.push(c);
    });
    return result;
  }, [cursors, userId]);

  return (
    <div
      className="min-h-screen w-full"
      onMouseMove={handleMouseMove}
    >
      <div ref={contentRef} className="relative mx-auto max-w-lg px-4 py-12">
      {/* Live cursors — positioned relative to content container */}
      {otherCursors.map((c) => (
        <div
          key={c.userId}
          className="pointer-events-none absolute left-0 top-0 z-50"
          style={{
            transform: `translate(${c.x}px, ${c.y}px)`,
            transition: "transform 80ms linear",
            willChange: "transform",
          }}
        >
          {/* Cursor arrow */}
          <svg
            width="16"
            height="20"
            viewBox="0 0 16 20"
            fill="none"
            style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))" }}
          >
            <path
              d="M0 0L16 12L8 12L4 20L0 0Z"
              fill={c.color}
            />
          </svg>
          {/* Name tag */}
          <span
            className="absolute left-4 top-4 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
            style={{ backgroundColor: c.color }}
          >
            {c.displayName}
          </span>
        </div>
      ))}
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Collaborative Todos</h1>
        <div className="flex items-center gap-2">
          {status !== "connected" && (
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
              {status}
            </span>
          )}
          {/* Presence avatars */}
          <div className="flex -space-x-2">
            {allUsers.map((u) => (
              <div
                key={u.userId}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-medium text-white"
                style={{ backgroundColor: u.color || "#3b82f6" }}
                title={u.displayName}
              >
                {u.displayName[0]?.toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add todo form */}
      <form
        onSubmit={(e) => { e.preventDefault(); addTodo(); }}
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

      {/* Todo list */}
      <div className="space-y-1">
        {todos.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">No todos yet. Add one above!</p>
        ) : (
          todos.map((todo) => (
            <div
              key={todo.id}
              className="group flex items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-sm"
            >
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
                    <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

              {/* Delete button */}
              <button
                onClick={() => deleteTodo(todo.id)}
                className="text-gray-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer stats */}
      {todos.length > 0 && (
        <p className="mt-4 text-xs text-gray-400">
          {completedCount} of {todos.length} completed
          <span className="ml-1 text-gray-300"> &middot; double-click to edit</span>
        </p>
      )}
      </div>
    </div>
  );
}
