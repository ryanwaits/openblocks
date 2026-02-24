"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import {
  LivelyProvider,
  RoomProvider,
  useOthersOnLocation,
} from "@waits/lively-react";
import { DEFAULT_BOARD, DEFAULT_BOARD_ID } from "@/lib/workflow/templates";
import { useAuthStore } from "@/lib/store/auth-store";
import { dashboardClient, buildInitialStorage } from "@/lib/sync/client";

/* ------------------------------------------------------------------ */
/*  Presence helpers                                                   */
/* ------------------------------------------------------------------ */

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const MAX_AVATARS = 4;

function CardPresence() {
  // Only show users who are inside the workflow editor, not dashboard observers
  const others = useOthersOnLocation("workflow");

  const seen = new Set<string>();
  const users = others.filter((u) => {
    if (seen.has(u.userId)) return false;
    seen.add(u.userId);
    return true;
  });

  if (users.length === 0) return null;

  const visible = users.slice(0, MAX_AVATARS);
  const overflow = users.length - MAX_AVATARS;

  return (
    <div className="mt-3 flex items-center gap-2">
      <div className="flex -space-x-1.5">
        {visible.map((user) => (
          <div
            key={user.userId}
            className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-medium text-white shadow-sm"
            style={{ backgroundColor: user.color }}
            title={user.displayName}
          >
            {getInitials(user.displayName)}
          </div>
        ))}
        {overflow > 0 && (
          <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-[10px] font-medium text-gray-500 shadow-sm">
            +{overflow}
          </div>
        )}
      </div>
      <span className="text-[10px] text-gray-400">
        {users.length} online
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard page                                                     */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const { userId, displayName: storedName, setIdentity, restore } = useAuthStore();

  // Restore identity from sessionStorage on mount
  useEffect(() => { restore(); }, [restore]);

  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-80 rounded-xl bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-semibold">Enter your name</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (displayName.trim()) {
                setIdentity(displayName.trim());
              }
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
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Zap size={16} className="text-white" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900">Board Builder</h1>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Build event-driven workflows for Stacks blockchain
        </p>
      </header>

      {/* Content */}
      <main className="flex-1 px-8 py-8">
        <h2 className="mb-4 text-sm font-medium text-gray-500 uppercase tracking-wider">
          Boards
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <button
            onClick={() => router.push(`/board/${DEFAULT_BOARD_ID}`)}
            className="group relative overflow-hidden rounded-lg border border-gray-200 bg-white text-left shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="h-1.5 bg-blue-500" />
            <div className="p-4">
              <h3 className="text-sm font-medium text-gray-900 truncate">
                {DEFAULT_BOARD.boardMeta.name}
              </h3>
              <p className="mt-2 text-xs text-gray-500">
                {DEFAULT_BOARD.description}
              </p>
              <p className="mt-1 text-[11px] text-gray-400">
                {DEFAULT_BOARD.workflows.length} workflow{DEFAULT_BOARD.workflows.length !== 1 ? "s" : ""}
              </p>

              {/* Live presence avatars */}
              {userId && (
                <LivelyProvider client={dashboardClient}>
                  <RoomProvider
                    roomId={DEFAULT_BOARD_ID}
                    userId={userId}
                    displayName={storedName}
                    initialStorage={buildInitialStorage(DEFAULT_BOARD, DEFAULT_BOARD_ID)}
                    location="dashboard"
                  >
                    <CardPresence />
                  </RoomProvider>
                </LivelyProvider>
              )}
            </div>
          </button>
        </div>
      </main>
    </div>
  );
}
