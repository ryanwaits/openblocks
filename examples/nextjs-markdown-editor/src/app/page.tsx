"use client";

import { useState, useCallback, useEffect } from "react";
import { LivelyClient, LiveObject } from "@waits/lively-client";
import {
  LivelyProvider,
  RoomProvider,
  ClientSideSuspense,
  LiveMap,
  useStorage,
  useMutation,
  useOthers,
  useSelf,
} from "@waits/lively-react";
import { ConnectionBadge, CollabPills } from "@waits/lively-ui";
import { MarkdownEditor } from "./editor";

const serverUrl =
  process.env.NEXT_PUBLIC_LIVELY_HOST || "http://localhost:2003";
const client = new LivelyClient({ serverUrl, reconnect: true });

export default function EditorPage() {
  const [userId] = useState(() => crypto.randomUUID().slice(0, 8));
  const [displayName, setDisplayName] = useState("");
  const [joined, setJoined] = useState(false);

  if (!joined) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f7f7f7]">
        <div className="w-80 rounded-lg bg-white p-6 shadow-sm border border-[#e5e5e5]">
          <h2 className="mb-1 text-sm font-semibold text-gray-800">
            Join session
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            Enter your name to start collaborating
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (displayName.trim()) setJoined(true);
            }}
          >
            <input
              className="mb-3 w-full rounded-md border border-[#e5e5e5] bg-white px-3 py-1.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              placeholder="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="w-full rounded-md bg-[#333] py-1.5 text-xs font-medium text-white hover:bg-[#555] disabled:opacity-40"
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
        roomId="editor-default"
        userId={userId}
        displayName={displayName}
        initialStorage={{
          files: new LiveMap([
            ["file-1", new LiveObject({ filename: "README.md" })],
          ]),
          userTabs: new LiveMap([]),
        }}
      >
        <ClientSideSuspense
          fallback={
            <div className="flex h-screen items-center justify-center">
              <p className="text-xs text-gray-400">Connecting...</p>
            </div>
          }
        >
          {() => <EditorShell displayName={displayName} />}
        </ClientSideSuspense>
      </RoomProvider>
    </LivelyProvider>
  );
}

/* ── File icon badge color by extension ── */
function fileIconColor(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "#3178c6";
    case "js":
    case "jsx":
      return "#f0db4f";
    case "md":
      return "#083fa1";
    case "json":
      return "#5b5b5b";
    case "css":
      return "#264de4";
    case "html":
      return "#e44d26";
    default:
      return "#6b7280";
  }
}

function fileIconLetter(filename: string): string {
  const ext = filename.split(".").pop()?.toUpperCase();
  return ext?.charAt(0) ?? "F";
}

/* ── Tab bar (replaces TitleBar) ── */
function TabBar({
  activeFileId,
  onSwitchTab,
}: {
  activeFileId: string;
  onSwitchTab: (fileId: string) => void;
}) {
  const others = useOthers();
  const self = useSelf();

  // Read files map → array of [id, filename]
  const files =
    useStorage((root) => {
      const map = root.get("files") as LiveMap<LiveObject<{ filename: string }>> | undefined;
      if (!map) return [];
      const result: [string, string][] = [];
      map.forEach((obj, key) => {
        result.push([key, obj.get("filename") ?? "Untitled"]);
      });
      return result;
    }) ?? [];

  // Read userTabs map → { userId: fileId }
  const userTabs =
    useStorage((root) => {
      const map = root.get("userTabs") as LiveMap<string> | undefined;
      if (!map) return {} as Record<string, string>;
      const result: Record<string, string> = {};
      map.forEach((fileId, userId) => {
        result[userId] = fileId;
      });
      return result;
    }) ?? {};

  // Build color map: userId → color (from others + self)
  const allUsers = self ? [self, ...others] : others;
  const userColorMap: Record<string, string> = {};
  const presentUserIds = new Set<string>();
  for (const u of allUsers) {
    userColorMap[u.userId] = u.color ?? "#999";
    presentUserIds.add(u.userId);
  }

  // Editing state for double-click rename
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const updateFilename = useMutation(
    ({ storage }, fileId: string, name: string) => {
      const map = storage.root.get("files") as LiveMap<LiveObject<{ filename: string }>>;
      const obj = map.get(fileId);
      if (obj) obj.set("filename", name);
    },
    []
  );

  const addFile = useMutation(({ storage }) => {
    const map = storage.root.get("files") as LiveMap<LiveObject<{ filename: string }>>;
    const id = "file-" + Date.now();
    map.set(id, new LiveObject({ filename: "Untitled" }));
    return id;
  }, []);

  const deleteFile = useMutation(
    ({ storage }, fileId: string) => {
      const map = storage.root.get("files") as LiveMap<LiveObject<{ filename: string }>>;
      map.delete(fileId);
    },
    []
  );

  const handleAdd = () => {
    const id = addFile();
    if (id) onSwitchTab(id);
  };

  const handleDelete = (e: React.MouseEvent, fileId: string) => {
    e.stopPropagation();
    if (files.length <= 1) return; // keep at least one file
    if (fileId === activeFileId) {
      const idx = files.findIndex(([id]) => id === fileId);
      const next = files[idx === 0 ? 1 : idx - 1];
      if (next) onSwitchTab(next[0]);
    }
    deleteFile(fileId);
  };

  const commitRename = (fileId: string) => {
    const trimmed = editValue.trim();
    if (trimmed) updateFilename(fileId, trimmed);
    setEditingId(null);
  };

  return (
    <div className="h-10 bg-[#f7f7f7] border-b border-[#e5e5e5] flex items-center justify-between select-none shrink-0 z-10">
      {/* Left: tabs + add */}
      <div className="flex items-center h-full overflow-x-auto scrollbar-none" style={{ scrollbarWidth: "none" }}>
        {files.map(([fileId, filename]) => {
          const isActive = fileId === activeFileId;
          const isEditing = editingId === fileId;

          // Presence dots: users on this tab (exclude self)
          const dotsOnTab = Object.entries(userTabs)
            .filter(
              ([uid, fid]) =>
                fid === fileId &&
                uid !== self?.userId &&
                presentUserIds.has(uid)
            )
            .map(([uid]) => uid);

          return (
            <button
              key={fileId}
              className={`group h-10 px-3 min-w-[100px] flex items-center gap-2 relative border-r border-[#e5e5e5] text-left transition-colors ${
                isActive
                  ? "bg-white shadow-[0_1px_0_0_#fff] top-[1px]"
                  : "bg-transparent hover:bg-[#eeeeee]"
              }`}
              onClick={() => onSwitchTab(fileId)}
              onDoubleClick={() => {
                setEditingId(fileId);
                setEditValue(filename);
              }}
            >
              <div
                className="w-3.5 h-3.5 rounded-[2px] text-[7px] flex items-center justify-center text-white font-bold leading-none shrink-0"
                style={{ backgroundColor: fileIconColor(filename) }}
              >
                {fileIconLetter(filename)}
              </div>

              {isEditing ? (
                <input
                  className="text-xs font-medium text-gray-800 bg-transparent outline-none border-b border-blue-400 w-24"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => commitRename(fileId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(fileId);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="text-xs font-medium text-gray-800 truncate max-w-[100px]">
                  {filename}
                </span>
              )}

              {/* Presence dots */}
              {dotsOnTab.length > 0 && (
                <div className="flex gap-0.5 ml-auto">
                  {dotsOnTab.map((uid) => (
                    <span
                      key={uid}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: userColorMap[uid] }}
                    />
                  ))}
                </div>
              )}

              {/* Close button */}
              {files.length > 1 && (
                <span
                  className="ml-auto w-4 h-4 flex items-center justify-center rounded-sm text-gray-400 hover:text-gray-700 hover:bg-[#ddd] opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleDelete(e, fileId)}
                  role="button"
                  title="Close file"
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M1 1l6 6M7 1l-6 6" />
                  </svg>
                </span>
              )}
            </button>
          );
        })}

        {/* Add file button */}
        <button
          className="h-10 px-3 flex items-center justify-center border-r border-[#e5e5e5] text-gray-400 hover:text-gray-600 hover:bg-[#eeeeee] transition-colors"
          onClick={handleAdd}
          title="New file"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M7 3v8M3 7h8" />
          </svg>
        </button>
      </div>

      {/* Right: connection + avatars */}
      <div className="flex items-center gap-2 px-3 shrink-0">
        <ConnectionBadge />
        <CollabPills />
      </div>
    </div>
  );
}

/* ── Breadcrumb bar ── */
function Breadcrumb({
  filename,
  languageName,
}: {
  filename: string;
  languageName: string;
}) {
  return (
    <div className="h-9 bg-white border-b border-[#f0f0f0] flex items-center px-4 gap-2 text-xs select-none shrink-0">
      <span className="text-gray-700 font-medium">{filename}</span>
      <span className="text-gray-300">&rsaquo;</span>
      <span className="text-gray-400">{languageName}</span>
    </div>
  );
}

/* ── Shell ── */
function EditorShell({ displayName }: { displayName: string }) {
  const self = useSelf();

  const [activeFileId, setActiveFileId] = useState("file-1");
  const [languageName, setLanguageName] = useState("Markdown");
  const onLanguageChange = useCallback(
    (name: string) => setLanguageName(name),
    []
  );

  // Derive filename from files map (null while storage loading)
  const filenameRaw = useStorage((root) => {
    const map = root.get("files") as LiveMap<LiveObject<{ filename: string }>> | undefined;
    if (!map) return "Untitled";
    const obj = map.get(activeFileId);
    return obj?.get("filename") ?? "Untitled";
  });
  const filename = filenameRaw ?? "Untitled";
  const storageReady = filenameRaw !== null;

  // Write userTabs entry for self
  const writeUserTab = useMutation(
    ({ storage }, fileId: string) => {
      const map = storage.root.get("userTabs") as LiveMap<string>;
      if (map && self?.userId) {
        map.set(self.userId, fileId);
      }
    },
    [self?.userId]
  );

  // Set initial tab once storage is ready
  useEffect(() => {
    if (storageReady) writeUserTab(activeFileId);
  }, [storageReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSwitchTab = useCallback(
    (fileId: string) => {
      setActiveFileId(fileId);
      writeUserTab(fileId);
    },
    [writeUserTab]
  );

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <TabBar activeFileId={activeFileId} onSwitchTab={handleSwitchTab} />
      <Breadcrumb filename={filename} languageName={languageName} />
      <div className="flex-1 flex overflow-hidden">
        <MarkdownEditor
          displayName={displayName}
          filename={filename}
          field={activeFileId}
          onLanguageChange={onLanguageChange}
        />
      </div>
    </div>
  );
}
