"use client";

import { useState, useCallback, useEffect } from "react";
import { LivelyClient, LiveObject } from "@waits/lively-client";
import {
  LivelyProvider,
  RoomProvider,
  ClientSideSuspense,
  useStorage,
  useMutation,
  useStatus,
  useOthers,
} from "@waits/lively-react";
import {
  AvatarStack,
  ConnectionBadge,
  CursorOverlay,
  useCursorTracking,
} from "@waits/lively-ui";
import { NotionEditor } from "./editor";

const serverUrl =
  process.env.NEXT_PUBLIC_LIVELY_HOST || "http://localhost:2004";
const client = new LivelyClient({ serverUrl, reconnect: true });

export default function NotionPage() {
  const [userId] = useState(() => crypto.randomUUID().slice(0, 8));
  const [displayName, setDisplayName] = useState("");
  const [joined, setJoined] = useState(false);

  if (!joined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f6f3]">
        <div className="w-80 rounded-xl bg-white p-6 shadow-lg border border-[#e8e7e4]">
          <div className="mb-4 flex items-center gap-2">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[#37352f]"
            >
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
            </svg>
            <h2 className="text-lg font-semibold text-[#37352f]">
              Join workspace
            </h2>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (displayName.trim()) setJoined(true);
            }}
          >
            <input
              className="mb-3 w-full rounded-lg border border-[#e8e7e4] bg-[#f7f6f3] px-3 py-2 text-sm text-[#37352f] placeholder:text-[#b4b0a8] focus:border-[#37352f] focus:outline-none"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-[#37352f] py-2 text-sm font-medium text-white hover:bg-[#2f2d2a] disabled:opacity-40"
              disabled={!displayName.trim()}
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <LivelyProvider client={client}>
      <RoomProvider
        roomId="notion-default"
        userId={userId}
        displayName={displayName}
        initialStorage={{
          title: new LiveObject({ text: "Untitled" }),
        }}
      >
        <ClientSideSuspense
          fallback={
            <div className="flex min-h-screen items-center justify-center">
              <p className="text-[#b4b0a8]">Connecting...</p>
            </div>
          }
        >
          {() => <NotionLayout />}
        </ClientSideSuspense>
      </RoomProvider>
    </LivelyProvider>
  );
}

// ── Document Title (synced via LiveObject) ──

function DocumentTitle() {
  const title =
    useStorage((root) => {
      const obj = root.get("title") as LiveObject<{ text: string }> | undefined;
      return obj?.get("text") ?? "Untitled";
    }) ?? "Untitled";

  const updateTitle = useMutation(({ storage }, text: string) => {
    const obj = storage.root.get("title") as LiveObject<{ text: string }>;
    obj.set("text", text);
  }, []);

  return (
    <input
      className="w-full text-[40px] font-bold leading-tight text-[#37352f] bg-transparent outline-none border-none focus:ring-0 placeholder:text-[#e0dfdc] caret-[#37352f]"
      value={title}
      onChange={(e) => updateTitle(e.target.value)}
      placeholder="Untitled"
    />
  );
}

// ── Word Count Hook ──

function useWordCount() {
  const [count, setCount] = useState(0);

  const updateCount = useCallback(() => {
    const proseMirror = document.querySelector(".ProseMirror");
    if (!proseMirror) return;
    const text = proseMirror.textContent ?? "";
    const words = text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);
    setCount(words.length);
  }, []);

  useEffect(() => {
    updateCount();
    const interval = setInterval(updateCount, 2000);
    return () => clearInterval(interval);
  }, [updateCount]);

  return count;
}

// ── Online Indicator ──

function OnlineIndicator() {
  const status = useStatus();
  const others = useOthers();
  const count = status === "connected" ? others.length + 1 : 0;

  if (status !== "connected") return <ConnectionBadge />;

  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
      <span>{count} online</span>
    </div>
  );
}

// ── Notion Layout ──

function NotionLayout() {
  const wordCount = useWordCount();
  const { ref, onMouseMove } = useCursorTracking<HTMLDivElement>();

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      className="relative min-h-screen flex flex-col"
    >
      <CursorOverlay mode="cursor" inactivityTimeout={5000} />

      {/* Top nav */}
      <header className="sticky top-0 z-20 border-b border-[#e8e7e4] bg-white/80 backdrop-blur-sm px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-[#9b9a97]">
          {/* Sidebar toggle icon */}
          <button className="p-1 rounded hover:bg-[#efefef] text-[#9b9a97]">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="15" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="text-[#c8c6c1]">/</span>
          <span className="truncate max-w-[200px]">Workspace</span>
        </div>

        <div className="flex items-center gap-3">
          <AvatarStack max={5} showSelf />
          <button className="rounded-lg bg-[#2383e2] px-3 py-1 text-sm font-medium text-white hover:bg-[#1d74c9]">
            Share
          </button>
          <button className="p-1 rounded hover:bg-[#efefef] text-[#9b9a97]">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
              <circle cx="5" cy="12" r="1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Document area */}
      <main className="flex-1 flex flex-col items-center">
        <div className="w-full max-w-[800px] mx-auto px-12 pt-16 pb-32">
          <DocumentTitle />
          <div className="mt-4">
            <NotionEditor />
          </div>
        </div>
      </main>

      {/* Status bar */}
      <footer className="sticky bottom-0 border-t border-[#e8e7e4] bg-white/80 backdrop-blur-sm px-4 py-1.5 flex items-center justify-between text-xs text-[#9b9a97]">
        <OnlineIndicator />
        <div>{wordCount} words</div>
      </footer>
    </div>
  );
}
