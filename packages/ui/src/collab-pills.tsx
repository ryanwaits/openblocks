import { useOthers, useSelf } from "@waits/lively-react";
import type { PresenceUser } from "@waits/lively-types";

export interface CollabPillsProps {
  /** Include the current user's own pill. Default: true */
  showSelf?: boolean;
  /** Max pills before overflow count. Default: 5 */
  max?: number;
  /** Callback when a pill is clicked */
  onUserClick?: (user: PresenceUser) => void;
  className?: string;
}

/**
 * Renders a row of colored name pills for all users in the room.
 * Each pill uses the user's assigned color as a solid background.
 *
 * @example
 * <CollabPills max={4} />
 */
export function CollabPills({
  showSelf = true,
  max = 5,
  onUserClick,
  className,
}: CollabPillsProps): JSX.Element {
  const others = useOthers();
  const self = useSelf();

  const users = showSelf && self ? [self, ...others] : others;
  const visible = users.slice(0, max);
  const overflow = users.length - visible.length;

  return (
    <div className={`ob-collab-pills flex items-center gap-1${className ? ` ${className}` : ""}`}>
      {visible.map((u) => (
        <span
          key={u.userId}
          className={`ob-collab-pill rounded-full px-3 py-1 text-xs font-medium text-white whitespace-nowrap${onUserClick ? " cursor-pointer" : ""}`}
          style={{ backgroundColor: u.color ?? "#6b7280" }}
          onClick={onUserClick ? () => onUserClick(u) : undefined}
        >
          {u.displayName}
        </span>
      ))}
      {overflow > 0 && (
        <span className="ob-collab-pill rounded-full px-3 py-1 text-xs font-medium bg-slate-200 text-slate-600 whitespace-nowrap">
          +{overflow}
        </span>
      )}
    </div>
  );
}
