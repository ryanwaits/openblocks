import { useOthers, useSelf } from "@waits/lively-react";
import type { PresenceUser } from "@waits/lively-types";
import { Avatar } from "./avatar.js";

export interface AvatarStackProps {
  /** Max avatars before overflow badge. Default: 4 */
  max?: number;
  /** Include the current user's own avatar. Default: true */
  showSelf?: boolean;
  /** Show online/away/offline status dots. Default: false */
  showStatus?: boolean;
  /** Filter to only show users at this location */
  locationId?: string;
  /** Callback when a user avatar is clicked */
  onUserClick?: (user: PresenceUser) => void;
  className?: string;
}

/**
 * Renders a stacked row of avatars for all users in the room.
 * Shows a `+N` overflow badge when users exceed `max`.
 *
 * @example
 * <AvatarStack max={5} showStatus />
 */
export function AvatarStack({
  max = 4,
  showSelf = true,
  showStatus = false,
  locationId,
  onUserClick,
  className,
}: AvatarStackProps): JSX.Element {
  const others = useOthers();
  const self = useSelf();

  let users = showSelf && self ? [self, ...others] : others;

  // Filter by location if provided
  if (locationId) {
    users = users.filter((u) => u.location === locationId);
  }

  const visible = users.slice(0, max);
  const overflow = users.length - visible.length;

  return (
    <div className={`flex -space-x-2${className ? ` ${className}` : ""}`}>
      {visible.map((u) => (
        <div
          key={u.userId}
          onClick={onUserClick ? () => onUserClick(u) : undefined}
          className={onUserClick ? "cursor-pointer" : undefined}
        >
          <Avatar user={u} showStatus={showStatus} />
        </div>
      ))}
      {overflow > 0 && (
        <div className="flex h-8 w-8 cursor-default items-center justify-center rounded-full border-2 border-white bg-slate-100 text-xs font-medium text-slate-500 shadow-md">
          +{overflow}
        </div>
      )}
    </div>
  );
}
