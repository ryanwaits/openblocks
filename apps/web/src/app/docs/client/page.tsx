import Link from "next/link";
import { CodeBlock, Line } from "../components/code-block";

export default function ClientPage() {
  return (
    <>
      <h1 className="font-sans text-3xl md:text-4xl font-bold tracking-tight text-text mb-4">
        Client
      </h1>
      <p className="text-muted text-lg mb-10 max-w-2xl">
        API reference for <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">@waits/lively-client</code> — the
        low-level TypeScript client for connecting to a Lively server, managing rooms, presence, cursors, storage, and real-time events.
      </p>

      {/* LivelyClient */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          LivelyClient
        </h2>
        <p className="text-muted text-sm mb-4">
          The main entry point. Create one client per app, then join rooms through it.
        </p>

        <div className="space-y-6">
          <div>
            <p className="text-muted text-sm mb-2">Constructor:</p>
            <CodeBlock filename="client.ts">
              <Line>
                <span className="text-code-keyword">import</span>
                {" { "}
                <span className="text-text">LivelyClient</span>
                {" } "}
                <span className="text-code-keyword">from</span>{" "}
                <span className="text-code-string">&quot;@waits/lively-client&quot;</span>;
              </Line>
              <Line>{""}</Line>
              <Line>
                <span className="text-code-keyword">const</span> client ={" "}
                <span className="text-code-keyword">new</span>{" "}
                <span className="text-code-func">LivelyClient</span>
                {"({"}
              </Line>
              <Line indent>
                serverUrl: <span className="text-code-string">&quot;ws://localhost:1999&quot;</span>,
              </Line>
              <Line indent>
                reconnect: <span className="text-code-func">true</span>,
                {"  "}
                <span className="text-code-comment">{"// optional, default true"}</span>
              </Line>
              <Line indent>
                maxRetries: <span className="text-code-func">20</span>,
                {"   "}
                <span className="text-code-comment">{"// optional, default 20"}</span>
              </Line>
              <Line>{"});"}</Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">joinRoom(roomId, options)</code> — connects to a room and returns a <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">Room</code> instance:
            </p>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">const</span> room = client.
                <span className="text-code-func">joinRoom</span>
                {"("}<span className="text-code-string">&quot;my-room&quot;</span>{", {"}
              </Line>
              <Line indent>
                userId: <span className="text-code-string">&quot;user-123&quot;</span>,
              </Line>
              <Line indent>
                displayName: <span className="text-code-string">&quot;Alice&quot;</span>,
              </Line>
              <Line indent>
                cursorThrottleMs: <span className="text-code-func">50</span>,
                {"       "}
                <span className="text-code-comment">{"// optional"}</span>
              </Line>
              <Line indent>
                initialStorage: {"{ "}count: <span className="text-code-func">0</span>{" }"},
                {"  "}
                <span className="text-code-comment">{"// optional"}</span>
              </Line>
              <Line indent>
                inactivityTime: <span className="text-code-func">60_000</span>,
                {"      "}
                <span className="text-code-comment">{"// optional, ms until \"away\""}</span>
              </Line>
              <Line indent>
                offlineInactivityTime: <span className="text-code-func">300_000</span>,
                <span className="text-code-comment">{" // optional, ms until \"offline\""}</span>
              </Line>
              <Line>{"});"}</Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">Other methods:</p>
            <CodeBlock>
              <Line>
                client.<span className="text-code-func">leaveRoom</span>
                {"("}<span className="text-code-string">&quot;my-room&quot;</span>{");"}
                {"          "}
                <span className="text-code-comment">{"// disconnect and remove"}</span>
              </Line>
              <Line>
                client.<span className="text-code-func">getRoom</span>
                {"("}<span className="text-code-string">&quot;my-room&quot;</span>{");"}
                {"           "}
                <span className="text-code-comment">{"// Room | undefined"}</span>
              </Line>
              <Line>
                client.<span className="text-code-func">getRooms</span>();
                {"                  "}
                <span className="text-code-comment">{"// Room[]"}</span>
              </Line>
            </CodeBlock>
          </div>
        </div>
      </section>

      {/* Room */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          Room
        </h2>
        <p className="text-muted text-sm mb-6">
          Returned by <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">client.joinRoom()</code>. Holds all
          real-time state for a single room — presence, cursors, storage, events, and history.
        </p>

        {/* Presence */}
        <div className="mb-8">
          <h3 className="font-mono text-xs font-semibold text-muted uppercase tracking-wide mb-3">
            Presence
          </h3>
          <CodeBlock>
            <Line>
              room.<span className="text-code-func">getPresence</span>();
              {"          "}
              <span className="text-code-comment">{"// PresenceUser[]"}</span>
            </Line>
            <Line>
              room.<span className="text-code-func">getOthers</span>();
              {"            "}
              <span className="text-code-comment">{"// PresenceUser[] (excludes self)"}</span>
            </Line>
            <Line>
              room.<span className="text-code-func">getSelf</span>();
              {"              "}
              <span className="text-code-comment">{"// PresenceUser | null"}</span>
            </Line>
            <Line>
              room.<span className="text-code-func">getOthersOnLocation</span>
              {"("}<span className="text-code-string">&quot;page-1&quot;</span>{");"}
              <span className="text-code-comment">{" // filter by location"}</span>
            </Line>
            <Line>{""}</Line>
            <Line>
              <span className="text-code-comment">{"// Update your presence data"}</span>
            </Line>
            <Line>
              room.<span className="text-code-func">updatePresence</span>
              {"({"}
            </Line>
            <Line indent>
              location: <span className="text-code-string">&quot;page-1&quot;</span>,
            </Line>
            <Line indent>
              metadata: {"{ "}role: <span className="text-code-string">&quot;editor&quot;</span>{" }"},
            </Line>
            <Line indent>
              onlineStatus: <span className="text-code-string">&quot;online&quot;</span>,
            </Line>
            <Line>{"});"}</Line>
          </CodeBlock>
        </div>

        {/* Cursors */}
        <div className="mb-8">
          <h3 className="font-mono text-xs font-semibold text-muted uppercase tracking-wide mb-3">
            Cursors
          </h3>
          <CodeBlock>
            <Line>
              <span className="text-code-comment">{"// Send cursor position (auto-throttled)"}</span>
            </Line>
            <Line>
              room.<span className="text-code-func">updateCursor</span>
              {"(x, y);"}
            </Line>
            <Line>
              room.<span className="text-code-func">updateCursor</span>
              {"(x, y, viewportPos, viewportScale);"}
            </Line>
            <Line>{""}</Line>
            <Line>
              <span className="text-code-comment">{"// Read all cursors"}</span>
            </Line>
            <Line>
              <span className="text-code-keyword">const</span> cursors = room.
              <span className="text-code-func">getCursors</span>();
              {"  "}
              <span className="text-code-comment">{"// Map<string, CursorData>"}</span>
            </Line>
          </CodeBlock>
        </div>

        {/* Storage */}
        <div className="mb-8">
          <h3 className="font-mono text-xs font-semibold text-muted uppercase tracking-wide mb-3">
            Storage
          </h3>
          <CodeBlock>
            <Line>
              <span className="text-code-comment">{"// Get the CRDT storage root (async — waits for server sync)"}</span>
            </Line>
            <Line>
              <span className="text-code-keyword">const</span> {"{ "}root{"} = "}
              <span className="text-code-keyword">await</span> room.
              <span className="text-code-func">getStorage</span>();
            </Line>
            <Line>{""}</Line>
            <Line>
              <span className="text-code-comment">{"// Read and mutate via LiveObject / LiveMap / LiveList"}</span>
            </Line>
            <Line>
              root.<span className="text-code-func">get</span>
              {"("}<span className="text-code-string">&quot;count&quot;</span>{");"}
              {"         "}
              <span className="text-code-comment">{"// read"}</span>
            </Line>
            <Line>
              root.<span className="text-code-func">set</span>
              {"("}<span className="text-code-string">&quot;count&quot;</span>
              {", "}<span className="text-code-func">42</span>{");"}
              {"      "}
              <span className="text-code-comment">{"// write (auto-synced)"}</span>
            </Line>
            <Line>{""}</Line>
            <Line>
              <span className="text-code-comment">{"// Synchronous getter (null if not loaded yet)"}</span>
            </Line>
            <Line>
              room.<span className="text-code-func">getCurrentRoot</span>();
              {"    "}
              <span className="text-code-comment">{"// LiveObject | null"}</span>
            </Line>
            <Line>{""}</Line>
            <Line>
              <span className="text-code-comment">{"// Subscribe to CRDT changes"}</span>
            </Line>
            <Line>
              room.<span className="text-code-func">subscribe</span>
              {"(root, () => "}
              <span className="text-code-func">console.log</span>
              {"("}<span className="text-code-string">&quot;changed!&quot;</span>{"));"}
            </Line>
            <Line>
              room.<span className="text-code-func">subscribe</span>
              {"(root, () => "}
              <span className="text-code-func">console.log</span>
              {"("}<span className="text-code-string">&quot;deep!&quot;</span>{"), { isDeep: "}
              <span className="text-code-func">true</span>{" });"}
            </Line>
            <Line>{""}</Line>
            <Line>
              <span className="text-code-comment">{"// Callback when storage root is replaced after reconnect"}</span>
            </Line>
            <Line>
              room.<span className="text-code-func">onStorageReset</span>
              {"((newRoot) => { ... });"}
            </Line>
          </CodeBlock>
        </div>

        {/* Events */}
        <div className="mb-8">
          <h3 className="font-mono text-xs font-semibold text-muted uppercase tracking-wide mb-3">
            Events
          </h3>
          <CodeBlock>
            <Line>
              <span className="text-code-comment">{"// Subscribe to room events"}</span>
            </Line>
            <Line>
              <span className="text-code-keyword">const</span> unsub = room.
              <span className="text-code-func">subscribe</span>
              {"("}<span className="text-code-string">&quot;presence&quot;</span>
              {", (users) => { ... });"}
            </Line>
            <Line>
              room.<span className="text-code-func">subscribe</span>
              {"("}<span className="text-code-string">&quot;cursors&quot;</span>
              {",  (cursors) => { ... });"}
            </Line>
            <Line>
              room.<span className="text-code-func">subscribe</span>
              {"("}<span className="text-code-string">&quot;status&quot;</span>
              {",   (status) => { ... });"}
            </Line>
            <Line>
              room.<span className="text-code-func">subscribe</span>
              {"("}<span className="text-code-string">&quot;message&quot;</span>
              {",  (msg) => { ... });"}
            </Line>
            <Line>
              room.<span className="text-code-func">subscribe</span>
              {"("}<span className="text-code-string">&quot;error&quot;</span>
              {",    (err) => { ... });"}
            </Line>
            <Line>{""}</Line>
            <Line>
              <span className="text-code-comment">{"// Send arbitrary messages"}</span>
            </Line>
            <Line>
              room.<span className="text-code-func">send</span>
              {"({ type: "}<span className="text-code-string">&quot;chat&quot;</span>
              {", text: "}<span className="text-code-string">&quot;hello&quot;</span>{" });"}
            </Line>
            <Line>{""}</Line>
            <Line>
              <span className="text-code-comment">{"// Batch multiple operations into a single message"}</span>
            </Line>
            <Line>
              room.<span className="text-code-func">batch</span>{"(() => {"}
            </Line>
            <Line indent>
              root.<span className="text-code-func">set</span>
              {"("}<span className="text-code-string">&quot;a&quot;</span>{", "}
              <span className="text-code-func">1</span>{");"}
            </Line>
            <Line indent>
              root.<span className="text-code-func">set</span>
              {"("}<span className="text-code-string">&quot;b&quot;</span>{", "}
              <span className="text-code-func">2</span>{");"}
            </Line>
            <Line>{"});"}</Line>
            <Line>{""}</Line>
            <Line>
              unsub();{" "}
              <span className="text-code-comment">{"// unsubscribe"}</span>
            </Line>
          </CodeBlock>
        </div>

        {/* Follow Mode */}
        <div className="mb-8">
          <h3 className="font-mono text-xs font-semibold text-muted uppercase tracking-wide mb-3">
            Follow Mode
          </h3>
          <CodeBlock>
            <Line>
              room.<span className="text-code-func">followUser</span>
              {"("}<span className="text-code-string">&quot;user-456&quot;</span>{");"}
              {"   "}
              <span className="text-code-comment">{"// start following a user"}</span>
            </Line>
            <Line>
              room.<span className="text-code-func">stopFollowing</span>();
              {"            "}
              <span className="text-code-comment">{"// stop following"}</span>
            </Line>
            <Line>
              room.<span className="text-code-func">getFollowing</span>();
              {"             "}
              <span className="text-code-comment">{"// string | null"}</span>
            </Line>
            <Line>
              room.<span className="text-code-func">getFollowers</span>();
              {"             "}
              <span className="text-code-comment">{"// string[] (users following you)"}</span>
            </Line>
          </CodeBlock>
        </div>

        {/* Live State */}
        <div className="mb-8">
          <h3 className="font-mono text-xs font-semibold text-muted uppercase tracking-wide mb-3">
            Live State
          </h3>
          <p className="text-muted text-xs mb-2">
            Lightweight key-value state synced via last-write-wins (not CRDT). Good for ephemeral UI state like viewport position.
          </p>
          <CodeBlock>
            <Line>
              room.<span className="text-code-func">setLiveState</span>
              {"("}<span className="text-code-string">&quot;theme&quot;</span>
              {", "}<span className="text-code-string">&quot;dark&quot;</span>{");"}
            </Line>
            <Line>
              room.<span className="text-code-func">getLiveState</span>
              {"("}<span className="text-code-string">&quot;theme&quot;</span>{");"}
              {"       "}
              <span className="text-code-comment">{"// \"dark\""}</span>
            </Line>
            <Line>
              room.<span className="text-code-func">getAllLiveStates</span>();
              {"          "}
              <span className="text-code-comment">{"// Map<string, { value, timestamp, userId }>"}</span>
            </Line>
            <Line>{""}</Line>
            <Line>
              <span className="text-code-keyword">const</span> unsub = room.
              <span className="text-code-func">subscribeLiveState</span>
              {"("}<span className="text-code-string">&quot;theme&quot;</span>{", () => { ... });"}
            </Line>
          </CodeBlock>
        </div>

        {/* History */}
        <div className="mb-8">
          <h3 className="font-mono text-xs font-semibold text-muted uppercase tracking-wide mb-3">
            History (Undo / Redo)
          </h3>
          <CodeBlock>
            <Line>
              room.<span className="text-code-func">undo</span>();
              {"                "}
              <span className="text-code-comment">{"// undo last storage mutation"}</span>
            </Line>
            <Line>
              room.<span className="text-code-func">redo</span>();
              {"                "}
              <span className="text-code-comment">{"// redo"}</span>
            </Line>
            <Line>
              room.<span className="text-code-func">getHistory</span>();
              {"          "}
              <span className="text-code-comment">{"// HistoryManager | null"}</span>
            </Line>
          </CodeBlock>
          <p className="text-muted text-xs mt-3">
            History works with <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">room.batch()</code> — batched
            mutations are undone/redone as a single unit.
          </p>
        </div>

        {/* Connection */}
        <div>
          <h3 className="font-mono text-xs font-semibold text-muted uppercase tracking-wide mb-3">
            Connection
          </h3>
          <CodeBlock>
            <Line>
              room.<span className="text-code-func">connect</span>();
              {"             "}
              <span className="text-code-comment">{"// open WebSocket (called automatically by joinRoom)"}</span>
            </Line>
            <Line>
              room.<span className="text-code-func">disconnect</span>();
              {"          "}
              <span className="text-code-comment">{"// close WebSocket"}</span>
            </Line>
            <Line>
              room.<span className="text-code-func">getStatus</span>();
              {"           "}
              <span className="text-code-comment">{"// ConnectionStatus"}</span>
            </Line>
          </CodeBlock>
        </div>
      </section>

      {/* ConnectionManager */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          ConnectionManager
        </h2>
        <p className="text-muted text-sm mb-4">
          Handles WebSocket lifecycle internally. You rarely use this directly — <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">Room</code> wraps
          it. Supports auto-reconnect with exponential backoff, heartbeats, and connection timeouts.
        </p>
        <CodeBlock>
          <Line>
            <span className="text-code-keyword">import</span>
            {" { "}
            <span className="text-text">ConnectionManager</span>
            {" } "}
            <span className="text-code-keyword">from</span>{" "}
            <span className="text-code-string">&quot;@waits/lively-client&quot;</span>;
          </Line>
          <Line>{""}</Line>
          <Line>
            <span className="text-code-keyword">const</span> conn ={" "}
            <span className="text-code-keyword">new</span>{" "}
            <span className="text-code-func">ConnectionManager</span>
            {"({"}
          </Line>
          <Line indent>
            url: <span className="text-code-string">&quot;ws://localhost:1999/rooms/my-room&quot;</span>,
          </Line>
          <Line indent>
            reconnect: <span className="text-code-func">true</span>,
          </Line>
          <Line indent>
            maxRetries: <span className="text-code-func">20</span>,
          </Line>
          <Line indent>
            connectionTimeoutMs: <span className="text-code-func">10_000</span>,
          </Line>
          <Line>{"});"}</Line>
          <Line>{""}</Line>
          <Line>
            conn.<span className="text-code-func">on</span>
            {"("}<span className="text-code-string">&quot;status&quot;</span>
            {", (s) => "}<span className="text-code-func">console.log</span>{"(s));"}
          </Line>
          <Line>
            conn.<span className="text-code-func">connect</span>();
          </Line>
        </CodeBlock>
      </section>

      {/* ActivityTracker */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          ActivityTracker
        </h2>
        <p className="text-muted text-sm mb-4">
          Detects idle and active users by listening for DOM events (mousemove, keydown, pointer, visibility). Transitions
          through <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">online</code> {" → "}
          <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">away</code> {" → "}
          <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">offline</code>. Used
          internally by <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">Room</code>.
        </p>
        <CodeBlock>
          <Line>
            <span className="text-code-keyword">import</span>
            {" { "}
            <span className="text-text">ActivityTracker</span>
            {" } "}
            <span className="text-code-keyword">from</span>{" "}
            <span className="text-code-string">&quot;@waits/lively-client&quot;</span>;
          </Line>
          <Line>{""}</Line>
          <Line>
            <span className="text-code-keyword">const</span> tracker ={" "}
            <span className="text-code-keyword">new</span>{" "}
            <span className="text-code-func">ActivityTracker</span>
            {"({"}
          </Line>
          <Line indent>
            inactivityTime: <span className="text-code-func">60_000</span>,
            {"      "}
            <span className="text-code-comment">{"// 1 min → away"}</span>
          </Line>
          <Line indent>
            offlineInactivityTime: <span className="text-code-func">300_000</span>,
            <span className="text-code-comment">{" // 5 min → offline"}</span>
          </Line>
          <Line>{"});"}</Line>
          <Line>{""}</Line>
          <Line>
            tracker.<span className="text-code-func">start</span>
            {"((status) => "}<span className="text-code-func">console.log</span>{"(status));"}
          </Line>
          <Line>
            tracker.<span className="text-code-func">getStatus</span>();
            {"    "}
            <span className="text-code-comment">{"// \"online\" | \"away\" | \"offline\""}</span>
          </Line>
          <Line>
            tracker.<span className="text-code-func">stop</span>();
          </Line>
        </CodeBlock>
      </section>

      {/* Utilities */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          Utilities
        </h2>
        <p className="text-muted text-sm mb-4">
          Re-exported for convenience.
        </p>
        <CodeBlock>
          <Line>
            <span className="text-code-keyword">import</span>
            {" { "}
            <span className="text-text">EventEmitter, throttle</span>
            {" } "}
            <span className="text-code-keyword">from</span>{" "}
            <span className="text-code-string">&quot;@waits/lively-client&quot;</span>;
          </Line>
          <Line>{""}</Line>
          <Line>
            <span className="text-code-comment">{"// CRDT types re-exported from @waits/lively-storage"}</span>
          </Line>
          <Line>
            <span className="text-code-keyword">import</span>
            {" { "}
            <span className="text-text">LiveObject, LiveMap, LiveList, StorageDocument</span>
            {" } "}
            <span className="text-code-keyword">from</span>{" "}
            <span className="text-code-string">&quot;@waits/lively-client&quot;</span>;
          </Line>
        </CodeBlock>
      </section>

      {/* Types */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          Types
        </h2>
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-muted mb-2">Configuration:</p>
            <ul className="space-y-1 text-muted pl-4">
              <li>
                <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">ClientConfig</code>
                {" — "}
                <span className="text-muted">{"{ serverUrl, reconnect?, maxRetries?, WebSocket? }"}</span>
              </li>
              <li>
                <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">JoinRoomOptions</code>
                {" — "}
                <span className="text-muted">{"{ userId, displayName, cursorThrottleMs?, initialStorage?, inactivityTime?, offlineInactivityTime?, token? }"}</span>
              </li>
              <li>
                <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">RoomConfig</code>
                {" — "}
                <span className="text-muted">full room config (used internally)</span>
              </li>
              <li>
                <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">ConnectionConfig</code>
                {" — "}
                <span className="text-muted">{"{ url, reconnect?, maxRetries?, baseDelay?, maxDelay?, heartbeatIntervalMs?, connectionTimeoutMs? }"}</span>
              </li>
              <li>
                <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">ActivityTrackerConfig</code>
                {" — "}
                <span className="text-muted">{"{ inactivityTime?, offlineInactivityTime?, pollInterval? }"}</span>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-muted mb-2">Runtime:</p>
            <ul className="space-y-1 text-muted pl-4">
              <li>
                <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">ConnectionStatus</code>
                {" — "}
                <span className="text-muted">{"\""}<span className="text-code-string">connected</span>{"\""} | {"\""}<span className="text-code-string">connecting</span>{"\""} | {"\""}<span className="text-code-string">reconnecting</span>{"\""} | {"\""}<span className="text-code-string">disconnected</span>{"\""}</span>
              </li>
              <li>
                <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">OnlineStatus</code>
                {" — "}
                <span className="text-muted">{"\""}<span className="text-code-string">online</span>{"\""} | {"\""}<span className="text-code-string">away</span>{"\""} | {"\""}<span className="text-code-string">offline</span>{"\""}</span>
              </li>
              <li>
                <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">PresenceUser</code>
                {" — "}
                <span className="text-muted">{"{ userId, displayName, onlineStatus, location?, metadata?, joinedAt }"}</span>
              </li>
              <li>
                <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">CursorData</code>
                {" — "}
                <span className="text-muted">{"{ userId, x, y, viewportPos?, viewportScale? }"}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Next Steps */}
      <section>
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          Next Steps
        </h2>
        <ul className="space-y-2 text-sm">
          <li>
            <Link href="/docs/react" className="text-primary hover:underline">
              React hooks reference &rarr;
            </Link>
          </li>
          <li>
            <Link href="/docs/storage" className="text-primary hover:underline">
              Storage & CRDTs &rarr;
            </Link>
          </li>
          <li>
            <Link href="/docs/server" className="text-primary hover:underline">
              Server configuration &rarr;
            </Link>
          </li>
        </ul>
      </section>
    </>
  );
}
