"use client";

import { useState, useEffect, useCallback } from "react";
import {
  OpenBlocksClient,
  LiveObject,
  LiveMap,
} from "@waits/openblocks-client";
import {
  OpenBlocksProvider,
  RoomProvider,
  useStorage,
  useMutation,
  useLiveState,
  useHistory,
} from "@waits/openblocks-react";
import {
  AvatarStack,
  ConnectionBadge,
  CursorOverlay,
  useCursorTracking,
} from "@waits/openblocks-ui";

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

  return (
    <OpenBlocksProvider client={client}>
      <RoomProvider
        roomId="todo-default"
        userId={userId}
        displayName={displayName}
        initialStorage={{ todos: new LiveMap<LiveObject>() }}
      >
        <TodoContent />
      </RoomProvider>
    </OpenBlocksProvider>
  );
}

// ── Todo list UI ────────────────────────────────────────────
type FilterMode = "all" | "active" | "completed";

function TodoContent() {
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const [filter, setFilter] = useLiveState<FilterMode>("filter", "all");
  const { undo, redo, canUndo, canRedo } = useHistory();

  const { ref, onMouseMove } = useCursorTracking<HTMLDivElement>();

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

  const todos = useStorage((root) => {
    const map = root.get("todos") as LiveMap<LiveObject> | undefined;
    if (!map) return [] as Todo[];
    const result: Todo[] = [];
    map.forEach((val, key) => {
      result.push({
        id: key,
        text: val.get("text") as string,
        completed: val.get("completed") as boolean,
        createdAt: val.get("createdAt") as string,
      });
    });
    result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return result;
  });

  const addTodo = useMutation(({ storage }, text: string) => {
    const map = storage.root.get("todos") as LiveMap<LiveObject>;
    map.set(
      crypto.randomUUID(),
      new LiveObject({
        text,
        completed: false,
        createdAt: new Date().toISOString(),
      })
    );
  }, []);

  const toggleTodo = useMutation(({ storage }, id: string) => {
    const map = storage.root.get("todos") as LiveMap<LiveObject>;
    const todo = map.get(id);
    if (todo) todo.set("completed", !todo.get("completed"));
  }, []);

  const deleteTodo = useMutation(({ storage }, id: string) => {
    const map = storage.root.get("todos") as LiveMap<LiveObject>;
    map.delete(id);
  }, []);

  const updateTodoText = useMutation(
    ({ storage }, id: string, text: string) => {
      const map = storage.root.get("todos") as LiveMap<LiveObject>;
      const todo = map.get(id);
      if (todo) todo.set("text", text);
    },
    []
  );

  if (!todos) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-400">Connecting...</div>
      </div>
    );
  }

  const completedCount = todos.filter((t) => t.completed).length;
  const filteredTodos = todos.filter((t) => {
    if (filter === "active") return !t.completed;
    if (filter === "completed") return t.completed;
    return true;
  });

  const startEditing = (todo: Todo) => {
    setEditingId(todo.id);
    setEditText(todo.text);
  };

  const commitEdit = () => {
    if (!editingId || !editText.trim()) return cancelEdit();
    updateTodoText(editingId, editText.trim());
    setEditingId(null);
    setEditText("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  return (
    <div ref={ref} className="relative min-h-screen w-full" onMouseMove={onMouseMove}>
      {/* Live cursors */}
      <CursorOverlay />
      <div className="mx-auto max-w-lg px-4 py-12">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Collaborative Todos</h1>
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
            <ConnectionBadge />
            <AvatarStack />
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
            filteredTodos.map((todo) => (
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
            ))
          )}
        </div>

        {/* Footer stats */}
        {todos.length > 0 && (
          <p className="mt-4 text-xs text-gray-400">
            {completedCount} of {todos.length} completed
            <span className="ml-1 text-gray-300">
              &middot; double-click to edit
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
