import { useEffect, useRef, useState } from "react";
import { useStatus } from "@waits/openblocks-react";

export interface ConnectionBadgeProps {
  className?: string;
  /** Show "server waking up..." after this many ms of connecting (default 5000). */
  coldStartThresholdMs?: number;
}

/**
 * Shows a status pill when the connection is not `"connected"`.
 * Returns `null` when connected — no badge needed in the happy path.
 *
 * - Yellow: `"connecting"` / `"reconnecting"` (shows "server waking up…" after threshold)
 * - Red: `"disconnected"`
 */
export function ConnectionBadge({ className, coldStartThresholdMs = 5000 }: ConnectionBadgeProps): JSX.Element | null {
  const status = useStatus();
  const [isColdStart, setIsColdStart] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status === "connecting" || status === "reconnecting") {
      timerRef.current = setTimeout(() => setIsColdStart(true), coldStartThresholdMs);
    } else {
      setIsColdStart(false);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [status, coldStartThresholdMs]);

  if (status === "connected") return null;

  const colorClass =
    status === "disconnected"
      ? "bg-red-100 text-red-700"
      : "bg-yellow-100 text-yellow-700";

  const label =
    status === "disconnected"
      ? "disconnected"
      : isColdStart
        ? "server waking up…"
        : status;

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}${className ? ` ${className}` : ""}`}
    >
      {label}
    </span>
  );
}
