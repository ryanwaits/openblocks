"use client";

import { usePresenceStore } from "@/lib/store/presence-store";

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const MAX_VISIBLE = 4;

export function OnlineUsers() {
  const onlineUsers = usePresenceStore((s) => s.onlineUsers);

  if (onlineUsers.length === 0) return null;

  const visible = onlineUsers.slice(0, MAX_VISIBLE);
  const overflow = onlineUsers.length - MAX_VISIBLE;

  return (
    <div className="flex -space-x-2">
      {visible.map((user) => (
        <div
          key={user.userId}
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-medium text-white shadow-md"
          style={{ backgroundColor: user.color }}
          title={user.displayName}
        >
          {getInitials(user.displayName)}
        </div>
      ))}
      {overflow > 0 && (
        <div className="flex h-8 w-8 cursor-default items-center justify-center rounded-full border-2 border-white bg-slate-100 text-xs font-medium text-slate-500 shadow-md hover:bg-slate-200">
          +{overflow}
        </div>
      )}
    </div>
  );
}
