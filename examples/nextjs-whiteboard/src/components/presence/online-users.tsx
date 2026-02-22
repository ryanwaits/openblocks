"use client";

import { useRef, useState, useEffect } from "react";
import { useOthersMapped, useSelf } from "@waits/lively-react";

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const MAX_VISIBLE = 4;

interface OnlineUsersProps {
  followingUserId?: string | null;
  onFollow?: (userId: string | null) => void;
}

export function OnlineUsers({ followingUserId, onFollow }: OnlineUsersProps) {
  const others = useOthersMapped((u) => ({ userId: u.userId, displayName: u.displayName, color: u.color }));
  const self = useSelf();
  const selfMapped = self ? { userId: self.userId, displayName: self.displayName, color: self.color } : null;
  const seen = new Set<string>(selfMapped ? [selfMapped.userId] : []);
  const dedupedOthers = others.filter((u) => {
    if (seen.has(u.userId)) return false;
    if (u.userId.startsWith("ai-")) return false;
    seen.add(u.userId);
    return true;
  });
  const onlineUsers = selfMapped ? [selfMapped, ...dedupedOthers] : dedupedOthers;
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openDropdown]);

  if (onlineUsers.length === 0) return null;

  const visible = onlineUsers.slice(0, MAX_VISIBLE);
  const overflow = onlineUsers.length - MAX_VISIBLE;

  return (
    <div className="flex -space-x-2" ref={dropdownRef}>
      {visible.map((user) => {
        const isSelf = user.userId === self?.userId;
        const isFollowed = followingUserId === user.userId;
        const isDropdownOpen = openDropdown === user.userId;

        return (
          <div key={user.userId} className="relative">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-medium text-white shadow-md ${
                isFollowed ? "border-blue-400 ring-2 ring-blue-400" : "border-white"
              } ${!isSelf && onFollow ? "cursor-pointer hover:opacity-90" : ""}`}
              style={{ backgroundColor: user.color }}
              title={user.displayName}
              onClick={() => {
                if (isSelf || !onFollow) return;
                setOpenDropdown(isDropdownOpen ? null : user.userId);
              }}
            >
              {getInitials(user.displayName)}
            </div>

            {isDropdownOpen && !isSelf && onFollow && (
              <div className="absolute right-0 top-10 z-50 min-w-[140px] rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                {isFollowed ? (
                  <button
                    className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => {
                      onFollow(null);
                      setOpenDropdown(null);
                    }}
                  >
                    Stop following
                  </button>
                ) : (
                  <button
                    className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => {
                      onFollow(user.userId);
                      setOpenDropdown(null);
                    }}
                  >
                    Follow {user.displayName.split(" ")[0]}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      {overflow > 0 && (
        <div className="flex h-8 w-8 cursor-default items-center justify-center rounded-full border-2 border-white bg-slate-100 text-xs font-medium text-slate-500 shadow-md hover:bg-slate-200">
          +{overflow}
        </div>
      )}
    </div>
  );
}
