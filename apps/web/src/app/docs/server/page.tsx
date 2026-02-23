import Link from "next/link";
import { CodeBlock, Line } from "../components/code-block";

export default function ServerPage() {
  return (
    <>
      <h1 className="font-sans text-3xl md:text-4xl font-bold tracking-tight text-text mb-4">
        Server
      </h1>
      <p className="text-muted text-lg mb-10 max-w-2xl">
        Bun-native WebSocket server for real-time rooms, presence, storage, and Yjs collaboration.
        The <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">@waits/lively-server</code> package
        handles room lifecycle, authentication, CRDT storage, and Yjs document sync out of the box.
      </p>

      {/* LivelyServer */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          LivelyServer
        </h2>
        <p className="text-muted text-sm mb-4">
          The main entry point. Accepts a <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">ServerConfig</code> object
          and exposes <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">.start()</code> / <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">.stop()</code> for
          lifecycle control.
        </p>
        <CodeBlock filename="server.ts">
          <Line>
            <span className="text-code-keyword">import</span>
            {" { "}
            <span className="text-text">LivelyServer</span>
            {" } "}
            <span className="text-code-keyword">from</span>{" "}
            <span className="text-code-string">&quot;@waits/lively-server&quot;</span>;
          </Line>
          <Line>{""}</Line>
          <Line>
            <span className="text-code-keyword">const</span> server ={" "}
            <span className="text-code-keyword">new</span>{" "}
            <span className="text-code-func">LivelyServer</span>
            {"({"}
          </Line>
          <Line indent>
            port: <span className="text-code-func">1999</span>,
          </Line>
          <Line indent>
            path: <span className="text-code-string">&quot;/rooms&quot;</span>,
            {"        "}
            <span className="text-code-comment">{"// default"}</span>
          </Line>
          <Line indent>
            healthPath: <span className="text-code-string">&quot;/health&quot;</span>,
            {"   "}
            <span className="text-code-comment">{"// default"}</span>
          </Line>
          <Line indent>
            auth: myAuthHandler,
          </Line>
          <Line indent>
            roomConfig: {"{ "}cleanupTimeoutMs: <span className="text-code-func">30_000</span>{" }"},
          </Line>
          <Line indent>
            onJoin, onLeave, onMessage,
          </Line>
          <Line indent>
            onStorageChange, initialStorage,
          </Line>
          <Line indent>
            initialYjs, onYjsChange,
          </Line>
          <Line>{"});"}</Line>
          <Line>{""}</Line>
          <Line>
            <span className="text-code-keyword">await</span> server.<span className="text-code-func">start</span>();
          </Line>
          <Line>
            <span className="text-code-comment">{"// server.port → 1999"}</span>
          </Line>
        </CodeBlock>
        <p className="text-muted text-xs mt-3">
          All config fields are optional. With zero config, the server listens on a random port
          at <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">/rooms/:roomId</code>.
        </p>

        <div className="mt-6">
          <p className="text-muted text-sm mb-2">ServerConfig shape:</p>
          <CodeBlock filename="types.ts">
            <Line>
              <span className="text-code-keyword">interface</span>{" "}
              <span className="text-code-func">ServerConfig</span> {"{"}
            </Line>
            <Line indent>
              port?: <span className="text-code-func">number</span>;
            </Line>
            <Line indent>
              path?: <span className="text-code-func">string</span>;
              {"               "}
              <span className="text-code-comment">{"// WebSocket path prefix"}</span>
            </Line>
            <Line indent>
              healthPath?: <span className="text-code-func">string</span>;
              {"        "}
              <span className="text-code-comment">{"// HTTP health endpoint"}</span>
            </Line>
            <Line indent>
              auth?: <span className="text-code-func">AuthHandler</span>;
            </Line>
            <Line indent>
              roomConfig?: <span className="text-code-func">RoomConfig</span>;
            </Line>
            <Line indent>
              onMessage?: <span className="text-code-func">OnMessageHandler</span>;
            </Line>
            <Line indent>
              onJoin?: <span className="text-code-func">OnJoinHandler</span>;
            </Line>
            <Line indent>
              onLeave?: <span className="text-code-func">OnLeaveHandler</span>;
            </Line>
            <Line indent>
              onStorageChange?: <span className="text-code-func">OnStorageChangeHandler</span>;
            </Line>
            <Line indent>
              initialStorage?: <span className="text-code-func">InitialStorageHandler</span>;
            </Line>
            <Line indent>
              initialYjs?: <span className="text-code-func">InitialYjsHandler</span>;
            </Line>
            <Line indent>
              onYjsChange?: <span className="text-code-func">OnYjsChangeHandler</span>;
            </Line>
            <Line>{"}"}</Line>
          </CodeBlock>
        </div>
      </section>

      {/* Authentication */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          Authentication
        </h2>
        <p className="text-muted text-sm mb-4">
          Implement the <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">AuthHandler</code> interface
          to authenticate WebSocket upgrade requests. Return a user object or <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">null</code> to
          reject the connection.
        </p>
        <CodeBlock filename="types.ts">
          <Line>
            <span className="text-code-keyword">interface</span>{" "}
            <span className="text-code-func">AuthHandler</span> {"{"}
          </Line>
          <Line indent>
            <span className="text-code-func">authenticate</span>(
          </Line>
          <Line indent>
            {"  "}req: <span className="text-code-func">IncomingMessage</span>
          </Line>
          <Line indent>
            ): <span className="text-code-func">Promise</span>{"<{ "}userId: <span className="text-code-func">string</span>; displayName: <span className="text-code-func">string</span>{" } | null>"};
          </Line>
          <Line>{"}"}</Line>
        </CodeBlock>

        <p className="text-muted text-sm mt-4 mb-2">
          Example &mdash; verify a JWT from the query string:
        </p>
        <CodeBlock filename="auth.ts">
          <Line>
            <span className="text-code-keyword">const</span> auth: <span className="text-code-func">AuthHandler</span> = {"{"}
          </Line>
          <Line indent>
            <span className="text-code-keyword">async</span>{" "}
            <span className="text-code-func">authenticate</span>(req) {"{"}
          </Line>
          <Line indent>
            {"  "}<span className="text-code-keyword">const</span> url ={" "}
            <span className="text-code-keyword">new</span>{" "}
            <span className="text-code-func">URL</span>(req.url!, <span className="text-code-string">`http://${"{"}req.headers.host{"}"}`</span>);
          </Line>
          <Line indent>
            {"  "}<span className="text-code-keyword">const</span> token = url.searchParams.<span className="text-code-func">get</span>(<span className="text-code-string">&quot;token&quot;</span>);
          </Line>
          <Line indent>
            {"  "}<span className="text-code-keyword">if</span> (!token) <span className="text-code-keyword">return</span> <span className="text-code-func">null</span>;
          </Line>
          <Line indent>
            {"  "}<span className="text-code-keyword">const</span> payload = <span className="text-code-keyword">await</span>{" "}
            <span className="text-code-func">verifyJwt</span>(token);
          </Line>
          <Line indent>
            {"  "}<span className="text-code-keyword">return</span> {"{ "}userId: payload.sub, displayName: payload.name{" }"};
          </Line>
          <Line indent>{"}"}</Line>
          <Line>{"};"}</Line>
        </CodeBlock>
        <p className="text-muted text-xs mt-3">
          Without an <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">auth</code> handler, the server
          falls back to <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">userId</code> and{" "}
          <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">displayName</code> query
          parameters on the WebSocket URL.
        </p>
      </section>

      {/* Room Callbacks */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          Room Callbacks
        </h2>
        <p className="text-muted text-sm mb-4">
          Hook into room events for logging, persistence, or custom logic. All callbacks are async-safe.
        </p>

        <div className="space-y-6">
          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">onJoin</code> &mdash; fired when a user connects to a room:
            </p>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">type</span>{" "}
                <span className="text-code-func">OnJoinHandler</span> = (
              </Line>
              <Line indent>
                roomId: <span className="text-code-func">string</span>,
              </Line>
              <Line indent>
                user: <span className="text-code-func">PresenceUser</span>
              </Line>
              <Line>
                ) =&gt; <span className="text-code-func">void</span> | <span className="text-code-func">Promise</span>{"<void>"};
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">onLeave</code> &mdash; fired when a user disconnects:
            </p>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">type</span>{" "}
                <span className="text-code-func">OnLeaveHandler</span> = (
              </Line>
              <Line indent>
                roomId: <span className="text-code-func">string</span>,
              </Line>
              <Line indent>
                user: <span className="text-code-func">PresenceUser</span>
              </Line>
              <Line>
                ) =&gt; <span className="text-code-func">void</span> | <span className="text-code-func">Promise</span>{"<void>"};
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">onMessage</code> &mdash; custom messages not handled internally:
            </p>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">type</span>{" "}
                <span className="text-code-func">OnMessageHandler</span> = (
              </Line>
              <Line indent>
                roomId: <span className="text-code-func">string</span>,
              </Line>
              <Line indent>
                senderId: <span className="text-code-func">string</span>,
              </Line>
              <Line indent>
                message: <span className="text-code-func">Record</span>{"<string, unknown>"}
              </Line>
              <Line>
                ) =&gt; <span className="text-code-func">void</span> | <span className="text-code-func">Promise</span>{"<void>"};
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">onStorageChange</code> &mdash; fired after CRDT ops are applied:
            </p>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">type</span>{" "}
                <span className="text-code-func">OnStorageChangeHandler</span> = (
              </Line>
              <Line indent>
                roomId: <span className="text-code-func">string</span>,
              </Line>
              <Line indent>
                ops: <span className="text-code-func">StorageOp</span>[]
              </Line>
              <Line>
                ) =&gt; <span className="text-code-func">void</span> | <span className="text-code-func">Promise</span>{"<void>"};
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">initialStorage</code> &mdash; load persisted CRDT state when a room is created:
            </p>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">type</span>{" "}
                <span className="text-code-func">InitialStorageHandler</span> = (
              </Line>
              <Line indent>
                roomId: <span className="text-code-func">string</span>
              </Line>
              <Line>
                ) =&gt; <span className="text-code-func">Promise</span>{"<"}<span className="text-code-func">SerializedCrdt</span> | <span className="text-code-func">null</span>{">"};
              </Line>
            </CodeBlock>
          </div>
        </div>

        <p className="text-muted text-sm mt-4">
          Example &mdash; persist storage to a database:
        </p>
        <CodeBlock filename="server.ts">
          <Line>
            <span className="text-code-keyword">const</span> server ={" "}
            <span className="text-code-keyword">new</span>{" "}
            <span className="text-code-func">LivelyServer</span>
            {"({"}
          </Line>
          <Line indent>
            <span className="text-code-keyword">async</span>{" "}
            <span className="text-code-func">initialStorage</span>(roomId) {"{"}
          </Line>
          <Line indent>
            {"  "}<span className="text-code-keyword">return</span>{" "}
            <span className="text-code-keyword">await</span> db.<span className="text-code-func">getStorage</span>(roomId);
          </Line>
          <Line indent>{"}"},{""}</Line>
          <Line indent>
            <span className="text-code-func">onStorageChange</span>(roomId, ops) {"{"}
          </Line>
          <Line indent>
            {"  "}<span className="text-code-keyword">await</span> db.<span className="text-code-func">saveOps</span>(roomId, ops);
          </Line>
          <Line indent>{"}"},{""}</Line>
          <Line>{"});"}</Line>
        </CodeBlock>
      </section>

      {/* Yjs Support */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          Yjs Support
        </h2>
        <p className="text-muted text-sm mb-4">
          The server manages a Y.Doc per room, syncing updates between clients automatically.
          Use these callbacks to persist and restore Yjs state.
        </p>

        <div className="space-y-6">
          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">initialYjs</code> &mdash; load persisted Yjs state for a room:
            </p>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">type</span>{" "}
                <span className="text-code-func">InitialYjsHandler</span> = (
              </Line>
              <Line indent>
                roomId: <span className="text-code-func">string</span>
              </Line>
              <Line>
                ) =&gt; <span className="text-code-func">Promise</span>{"<"}<span className="text-code-func">Uint8Array</span> | <span className="text-code-func">null</span>{">"};
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">onYjsChange</code> &mdash; fired after a Yjs update is applied:
            </p>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">type</span>{" "}
                <span className="text-code-func">OnYjsChangeHandler</span> = (
              </Line>
              <Line indent>
                roomId: <span className="text-code-func">string</span>,
              </Line>
              <Line indent>
                state: <span className="text-code-func">Uint8Array</span>
              </Line>
              <Line>
                ) =&gt; <span className="text-code-func">void</span> | <span className="text-code-func">Promise</span>{"<void>"};
              </Line>
            </CodeBlock>
          </div>
        </div>

        <p className="text-muted text-sm mt-4 mb-2">
          Example &mdash; persist Yjs to file:
        </p>
        <CodeBlock filename="server.ts">
          <Line>
            <span className="text-code-keyword">import</span>
            {" { "}
            <span className="text-text">writeFile, readFile</span>
            {" } "}
            <span className="text-code-keyword">from</span>{" "}
            <span className="text-code-string">&quot;node:fs/promises&quot;</span>;
          </Line>
          <Line>{""}</Line>
          <Line>
            <span className="text-code-keyword">const</span> server ={" "}
            <span className="text-code-keyword">new</span>{" "}
            <span className="text-code-func">LivelyServer</span>
            {"({"}
          </Line>
          <Line indent>
            <span className="text-code-keyword">async</span>{" "}
            <span className="text-code-func">initialYjs</span>(roomId) {"{"}
          </Line>
          <Line indent>
            {"  "}<span className="text-code-keyword">try</span> {"{"}
          </Line>
          <Line indent>
            {"    "}<span className="text-code-keyword">return await</span>{" "}
            <span className="text-code-func">readFile</span>(<span className="text-code-string">`./data/${"{"}roomId{"}"}.yjs`</span>);
          </Line>
          <Line indent>
            {"  }"} <span className="text-code-keyword">catch</span> {"{"}
          </Line>
          <Line indent>
            {"    "}<span className="text-code-keyword">return</span>{" "}
            <span className="text-code-func">null</span>;
          </Line>
          <Line indent>{"  }"}</Line>
          <Line indent>{"}"},{""}</Line>
          <Line indent>
            <span className="text-code-func">onYjsChange</span>(roomId, state) {"{"}
          </Line>
          <Line indent>
            {"  "}<span className="text-code-keyword">await</span>{" "}
            <span className="text-code-func">writeFile</span>(<span className="text-code-string">`./data/${"{"}roomId{"}"}.yjs`</span>, state);
          </Line>
          <Line indent>{"}"},{""}</Line>
          <Line>{"});"}</Line>
        </CodeBlock>
      </section>

      {/* Room (Server-Side) */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          Room (Server-Side)
        </h2>
        <p className="text-muted text-sm mb-4">
          Each room is created automatically when the first client connects. The{" "}
          <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">LivelyServer</code> exposes
          helper methods to interact with rooms from outside the WebSocket flow.
        </p>

        <CodeBlock filename="server-side room API">
          <Line>
            <span className="text-code-comment">{"// Broadcast arbitrary data to a room"}</span>
          </Line>
          <Line>
            server.<span className="text-code-func">broadcastToRoom</span>(roomId, data, excludeIds?);
          </Line>
          <Line>{""}</Line>
          <Line>
            <span className="text-code-comment">{"// Mutate CRDT storage from server code"}</span>
          </Line>
          <Line>
            <span className="text-code-keyword">await</span> server.<span className="text-code-func">mutateStorage</span>(roomId, (root) =&gt; {"{"}
          </Line>
          <Line indent>
            root.<span className="text-code-func">set</span>(<span className="text-code-string">&quot;key&quot;</span>, <span className="text-code-string">&quot;value&quot;</span>);
          </Line>
          <Line>{"});"}</Line>
          <Line>{""}</Line>
          <Line>
            <span className="text-code-comment">{"// Get connected users"}</span>
          </Line>
          <Line>
            <span className="text-code-keyword">const</span> users = server.<span className="text-code-func">getRoomUsers</span>(roomId);
          </Line>
          <Line>{""}</Line>
          <Line>
            <span className="text-code-comment">{"// Set live state from server"}</span>
          </Line>
          <Line>
            server.<span className="text-code-func">setLiveState</span>(roomId, <span className="text-code-string">&quot;theme&quot;</span>, <span className="text-code-string">&quot;dark&quot;</span>);
          </Line>
          <Line>{""}</Line>
          <Line>
            <span className="text-code-comment">{"// Access the RoomManager directly"}</span>
          </Line>
          <Line>
            <span className="text-code-keyword">const</span> manager = server.<span className="text-code-func">getRoomManager</span>();
          </Line>
        </CodeBlock>

        <p className="text-muted text-xs mt-3">
          The <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">RoomManager</code> handles
          room creation, lookup, and automatic cleanup when rooms are empty
          (default: 30s timeout).
        </p>
      </section>

      {/* Types */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          Types
        </h2>
        <p className="text-muted text-sm mb-4">
          All types are exported from <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">@waits/lively-server</code>.
        </p>

        <CodeBlock filename="imports">
          <Line>
            <span className="text-code-keyword">import</span>{" "}
            <span className="text-code-keyword">type</span>
            {" {"}
          </Line>
          <Line indent>
            <span className="text-text">ServerConfig</span>,
          </Line>
          <Line indent>
            <span className="text-text">AuthHandler</span>,
          </Line>
          <Line indent>
            <span className="text-text">RoomConfig</span>,
          </Line>
          <Line indent>
            <span className="text-text">OnJoinHandler</span>,
          </Line>
          <Line indent>
            <span className="text-text">OnLeaveHandler</span>,
          </Line>
          <Line indent>
            <span className="text-text">OnMessageHandler</span>,
          </Line>
          <Line indent>
            <span className="text-text">OnStorageChangeHandler</span>,
          </Line>
          <Line indent>
            <span className="text-text">InitialStorageHandler</span>,
          </Line>
          <Line indent>
            <span className="text-text">InitialYjsHandler</span>,
          </Line>
          <Line indent>
            <span className="text-text">OnYjsChangeHandler</span>,
          </Line>
          <Line indent>
            <span className="text-text">Connection</span>,
          </Line>
          <Line indent>
            <span className="text-text">LiveStateEntry</span>,
          </Line>
          <Line>
            {"} "}
            <span className="text-code-keyword">from</span>{" "}
            <span className="text-code-string">&quot;@waits/lively-server&quot;</span>;
          </Line>
        </CodeBlock>

        <div className="mt-4 space-y-4">
          <div>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">interface</span>{" "}
                <span className="text-code-func">RoomConfig</span> {"{"}
              </Line>
              <Line indent>
                cleanupTimeoutMs?: <span className="text-code-func">number</span>;
                {"  "}
                <span className="text-code-comment">{"// ms before empty room is destroyed"}</span>
              </Line>
              <Line indent>
                maxConnections?: <span className="text-code-func">number</span>;
                {"   "}
                <span className="text-code-comment">{"// cap per room"}</span>
              </Line>
              <Line>{"}"}</Line>
            </CodeBlock>
          </div>

          <div>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">interface</span>{" "}
                <span className="text-code-func">Connection</span> {"{"}
              </Line>
              <Line indent>
                ws: <span className="text-code-func">WebSocket</span>;
              </Line>
              <Line indent>
                user: <span className="text-code-func">PresenceUser</span>;
              </Line>
              <Line indent>
                location?: <span className="text-code-func">string</span>;
              </Line>
              <Line indent>
                metadata?: <span className="text-code-func">Record</span>{"<string, unknown>"};
              </Line>
              <Line indent>
                onlineStatus: <span className="text-code-func">OnlineStatus</span>;
              </Line>
              <Line indent>
                lastActiveAt: <span className="text-code-func">number</span>;
              </Line>
              <Line indent>
                lastHeartbeat: <span className="text-code-func">number</span>;
              </Line>
              <Line>{"}"}</Line>
            </CodeBlock>
          </div>

          <div>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">interface</span>{" "}
                <span className="text-code-func">LiveStateEntry</span> {"{"}
              </Line>
              <Line indent>
                value: <span className="text-code-func">unknown</span>;
              </Line>
              <Line indent>
                timestamp: <span className="text-code-func">number</span>;
              </Line>
              <Line indent>
                userId: <span className="text-code-func">string</span>;
              </Line>
              <Line>{"}"}</Line>
            </CodeBlock>
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
            <Link href="/docs/client" className="text-primary hover:underline">
              Client SDK reference &rarr;
            </Link>
          </li>
          <li>
            <Link href="/docs/storage" className="text-primary hover:underline">
              Storage & CRDTs &rarr;
            </Link>
          </li>
          <li>
            <Link href="/docs/quick-start" className="text-primary hover:underline">
              Quick Start guide &rarr;
            </Link>
          </li>
        </ul>
      </section>
    </>
  );
}
