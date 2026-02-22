import { useState, useEffect } from "react";
import { useCursors, useOthers, useSelf } from "@waits/lively-react";
import { Cursor } from "./cursor.js";

export interface CursorOverlayProps {
  /** Extra class names applied to each `<Cursor>` element */
  className?: string;
  /** Display mode passed to each `<Cursor>`. Default: `"name"`. */
  mode?: "name" | "avatar" | "cursor";
  /**
   * Milliseconds of cursor inactivity before fading to transparent.
   * Undefined or 0 = no fade.
   */
  inactivityTimeout?: number;
}

/**
 * Renders a `<Cursor>` for every other user in the room.
 * Automatically excludes the current user's own cursor.
 *
 * Must be placed inside a `position: relative` container that also has
 * the `useCursorTracking` ref attached so coordinates align correctly.
 *
 * @example
 * const { ref, onMouseMove } = useCursorTracking<HTMLDivElement>();
 * return (
 *   <div ref={ref} onMouseMove={onMouseMove} className="relative">
 *     <CursorOverlay />
 *     {children}
 *   </div>
 * );
 */
export function CursorOverlay({
  className,
  mode,
  inactivityTimeout,
}: CursorOverlayProps): JSX.Element {
  const cursors = useCursors();
  const self = useSelf();
  const others = useOthers();

  // Force re-render every second to recheck inactivity timestamps
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!inactivityTimeout) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [inactivityTimeout]);

  // Build userId → avatarUrl lookup from presence data
  const avatarMap = new Map<string, string | undefined>();
  for (const user of others) {
    avatarMap.set(user.userId, user.avatarUrl);
  }

  const entries = Array.from(cursors.entries()).filter(
    ([userId]) => userId !== self?.userId
  );

  return (
    <>
      {entries.map(([userId, cursor]) => {
        const isInactive =
          inactivityTimeout != null &&
          inactivityTimeout > 0 &&
          Date.now() - cursor.lastUpdate > inactivityTimeout;

        return (
          <Cursor
            key={userId}
            x={cursor.x}
            y={cursor.y}
            color={cursor.color}
            displayName={cursor.displayName}
            className={className}
            mode={mode}
            avatarUrl={avatarMap.get(userId)}
            style={isInactive ? { opacity: 0 } : undefined}
          />
        );
      })}
    </>
  );
}
