import type { PresenceUser, OnlineStatus } from "@waits/lively-types";

export interface AvatarProps {
  user: PresenceUser;
  size?: "sm" | "md";
  /** Show an online/away/offline status dot. Default: false */
  showStatus?: boolean;
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const STATUS_COLORS: Record<OnlineStatus, string> = {
  online: "bg-green-500",
  away: "bg-yellow-500",
  offline: "bg-gray-400",
};

/**
 * A single user avatar — colored circle with initials (or image) and a tooltip.
 * Supports an optional status indicator dot.
 */
export function Avatar({ user, size = "md", showStatus = false, className }: AvatarProps): JSX.Element {
  const sizeClass = size === "sm"
    ? "h-6 w-6 text-[10px]"
    : "h-8 w-8 text-xs";

  const dotSize = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";
  const statusColor = STATUS_COLORS[user.onlineStatus ?? "online"];

  return (
    <div className={`relative inline-block${className ? ` ${className}` : ""}`}>
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.displayName}
          title={user.displayName}
          className={`rounded-full border-2 border-white object-cover shadow-md ${sizeClass}`}
        />
      ) : (
        <div
          className={`flex items-center justify-center rounded-full border-2 border-white font-medium text-white shadow-md ${sizeClass}`}
          style={{ backgroundColor: user.color || "#3b82f6" }}
          title={user.displayName}
        >
          {getInitials(user.displayName)}
        </div>
      )}
      {showStatus && (
        <span
          className={`absolute bottom-0 right-0 block rounded-full border border-white ${dotSize} ${statusColor}`}
          data-testid="status-dot"
          data-status={user.onlineStatus ?? "online"}
        />
      )}
    </div>
  );
}
