import type { OnlineStatus } from "@waits/lively-types";

export interface ActivityTrackerConfig {
  /** Time in ms before marking user as away (default 60000 = 1 min) */
  inactivityTime?: number;
  /** Time in ms before marking user as offline (default 300000 = 5 min) */
  offlineInactivityTime?: number;
  /** Poll interval in ms (default 10000 = 10s) */
  pollInterval?: number;
}

export class ActivityTracker {
  private _status: OnlineStatus = "online";
  private _lastActivity = Date.now();
  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _onStatusChange: ((status: OnlineStatus) => void) | null = null;

  private readonly _inactivityTime: number;
  private readonly _offlineInactivityTime: number;
  private readonly _pollInterval: number;

  private readonly _onActivity = () => {
    this._lastActivity = Date.now();
    if (this._status !== "online") {
      this._setStatus("online");
    }
  };

  private readonly _onVisibilityChange = () => {
    if (typeof document === "undefined") return;
    if (document.visibilityState === "hidden") {
      this._setStatus("away");
    } else {
      this._onActivity();
    }
  };

  constructor(config?: ActivityTrackerConfig) {
    this._inactivityTime = config?.inactivityTime ?? 60_000;
    this._offlineInactivityTime = config?.offlineInactivityTime ?? 300_000;
    this._pollInterval = config?.pollInterval ?? 10_000;
  }

  start(onStatusChange: (status: OnlineStatus) => void): void {
    this._onStatusChange = onStatusChange;
    this._lastActivity = Date.now();
    this._status = "online";

    // SSR guard
    if (typeof document === "undefined") return;

    document.addEventListener("mousemove", this._onActivity);
    document.addEventListener("keydown", this._onActivity);
    document.addEventListener("pointerdown", this._onActivity);
    document.addEventListener("visibilitychange", this._onVisibilityChange);

    this._pollTimer = setInterval(() => this._check(), this._pollInterval);
  }

  stop(): void {
    this._onStatusChange = null;

    if (typeof document !== "undefined") {
      document.removeEventListener("mousemove", this._onActivity);
      document.removeEventListener("keydown", this._onActivity);
      document.removeEventListener("pointerdown", this._onActivity);
      document.removeEventListener("visibilitychange", this._onVisibilityChange);
    }

    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  getStatus(): OnlineStatus {
    return this._status;
  }

  getLastActivity(): number {
    return this._lastActivity;
  }

  private _check(): void {
    const elapsed = Date.now() - this._lastActivity;
    if (elapsed >= this._offlineInactivityTime) {
      this._setStatus("offline");
    } else if (elapsed >= this._inactivityTime) {
      this._setStatus("away");
    }
  }

  private _setStatus(status: OnlineStatus): void {
    if (this._status === status) return;
    this._status = status;
    this._onStatusChange?.(status);
  }
}
