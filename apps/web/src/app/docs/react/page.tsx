import Link from "next/link";
import { CodeBlock, Line } from "../components/code-block";

export default function ReactReferencePage() {
  return (
    <>
      <h1 className="font-sans text-3xl md:text-4xl font-bold tracking-tight text-text mb-4">
        React
      </h1>
      <p className="text-muted text-lg mb-10 max-w-2xl">
        API reference for <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">@waits/lively-react</code>.
        Every hook listed below must be called inside a{" "}
        <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">{"<RoomProvider>"}</code>.
      </p>

      {/* ------------------------------------------------------------------ */}
      {/* Providers */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          Providers
        </h2>

        <p className="text-muted text-sm mb-4">
          Wrap your app in <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">{"<LivelyProvider>"}</code>{" "}
          with a <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">LivelyClient</code> instance,
          then nest a <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">{"<RoomProvider>"}</code> for each room.
        </p>

        {/* LivelyProvider */}
        <div className="mb-6">
          <p className="text-text text-sm font-semibold mb-2">LivelyProvider</p>
          <CodeBlock filename="LivelyProvider">
            <Line>
              <span className="text-code-keyword">import</span>
              {" { "}
              <span className="text-text">LivelyProvider</span>
              {" } "}
              <span className="text-code-keyword">from</span>{" "}
              <span className="text-code-string">&quot;@waits/lively-react&quot;</span>;
            </Line>
            <Line>{""}</Line>
            <Line>
              <span className="text-code-comment">{"// Props: { client: LivelyClient; children: ReactNode }"}</span>
            </Line>
            <Line>
              {"<"}<span className="text-code-func">LivelyProvider</span>{" "}
              <span className="text-text">client</span>={"{client}"}{">"}
            </Line>
            <Line indent>
              {"<"}<span className="text-code-func">App</span>{" />"}
            </Line>
            <Line>
              {"</"}<span className="text-code-func">LivelyProvider</span>{">"}
            </Line>
          </CodeBlock>
        </div>

        {/* RoomProvider */}
        <div className="mb-6">
          <p className="text-text text-sm font-semibold mb-2">RoomProvider</p>
          <CodeBlock filename="RoomProvider">
            <Line>
              <span className="text-code-keyword">import</span>
              {" { "}
              <span className="text-text">RoomProvider</span>
              {" } "}
              <span className="text-code-keyword">from</span>{" "}
              <span className="text-code-string">&quot;@waits/lively-react&quot;</span>;
            </Line>
            <Line>{""}</Line>
            <Line>
              <span className="text-code-comment">{"// Props: { roomId: string; userId: string; displayName: string;"}</span>
            </Line>
            <Line>
              <span className="text-code-comment">{"//   initialStorage?: Record<string, unknown>; children: ReactNode }"}</span>
            </Line>
            <Line>
              {"<"}<span className="text-code-func">RoomProvider</span>{" "}
              <span className="text-text">roomId</span>=<span className="text-code-string">&quot;my-room&quot;</span>{" "}
              <span className="text-text">userId</span>=<span className="text-code-string">&quot;user-1&quot;</span>{" "}
              <span className="text-text">displayName</span>=<span className="text-code-string">&quot;Alice&quot;</span>{">"}
            </Line>
            <Line indent>
              {"<"}<span className="text-code-func">YourApp</span>{" />"}
            </Line>
            <Line>
              {"</"}<span className="text-code-func">RoomProvider</span>{">"}
            </Line>
          </CodeBlock>
        </div>

        {/* Context hooks */}
        <div className="mb-6">
          <p className="text-text text-sm font-semibold mb-2">useClient</p>
          <CodeBlock>
            <Line>
              <span className="text-code-keyword">const</span> client ={" "}
              <span className="text-code-func">useClient</span>();
            </Line>
            <Line>
              <span className="text-code-comment">{"// Returns the LivelyClient from <LivelyProvider>"}</span>
            </Line>
          </CodeBlock>
        </div>

        <div className="mb-6">
          <p className="text-text text-sm font-semibold mb-2">useRoom</p>
          <CodeBlock>
            <Line>
              <span className="text-code-keyword">const</span> room ={" "}
              <span className="text-code-func">useRoom</span>();
            </Line>
            <Line>
              <span className="text-code-comment">{"// Returns the current Room instance from <RoomProvider>"}</span>
            </Line>
          </CodeBlock>
        </div>

        <div className="mb-6">
          <p className="text-text text-sm font-semibold mb-2">useIsInsideRoom</p>
          <CodeBlock>
            <Line>
              <span className="text-code-keyword">const</span> inside ={" "}
              <span className="text-code-func">useIsInsideRoom</span>();
            </Line>
            <Line>
              <span className="text-code-comment">{"// Returns true if called inside a <RoomProvider>"}</span>
            </Line>
          </CodeBlock>
        </div>

        <div>
          <p className="text-text text-sm font-semibold mb-2">useStorageRoot</p>
          <CodeBlock>
            <Line>
              <span className="text-code-keyword">const</span> storageRoot ={" "}
              <span className="text-code-func">useStorageRoot</span>();
            </Line>
            <Line>
              <span className="text-code-comment">{"// Returns { root: LiveObject } | null. Prefer useStorage(selector)."}</span>
            </Line>
          </CodeBlock>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Connection */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          Connection
        </h2>

        <div className="mb-6">
          <p className="text-text text-sm font-semibold mb-2">useStatus</p>
          <CodeBlock>
            <Line>
              <span className="text-code-keyword">const</span> status ={" "}
              <span className="text-code-func">useStatus</span>();
            </Line>
            <Line>
              <span className="text-code-comment">{"// \"connecting\" | \"connected\" | \"reconnecting\" | \"disconnected\""}</span>
            </Line>
            <Line>
              <span className="text-code-keyword">if</span> (status !== <span className="text-code-string">&quot;connected&quot;</span>) <span className="text-code-keyword">return</span> {"<"}<span className="text-code-func">Spinner</span>{" />;"}</Line>
          </CodeBlock>
        </div>

        <div className="mb-6">
          <p className="text-text text-sm font-semibold mb-2">useSyncStatus</p>
          <CodeBlock>
            <Line>
              <span className="text-code-keyword">const</span> sync ={" "}
              <span className="text-code-func">useSyncStatus</span>();
            </Line>
            <Line>
              <span className="text-code-comment">{"// \"synchronized\" | \"synchronizing\" | \"not-synchronized\""}</span>
            </Line>
            <Line>
              <span className="text-code-keyword">if</span> (sync === <span className="text-code-string">&quot;not-synchronized&quot;</span>) <span className="text-code-keyword">return</span> {"<"}<span className="text-code-func">OfflineBanner</span>{" />;"}</Line>
          </CodeBlock>
        </div>

        <div>
          <p className="text-text text-sm font-semibold mb-2">useLostConnectionListener</p>
          <CodeBlock>
            <Line>
              <span className="text-code-func">useLostConnectionListener</span>{"(() => {"}
            </Line>
            <Line indent>
              <span className="text-code-func">toast</span>(<span className="text-code-string">&quot;Connection lost, reconnecting...&quot;</span>);
            </Line>
            <Line>{"});"}</Line>
          </CodeBlock>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Presence */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          Presence
        </h2>

        <div className="mb-6">
          <p className="text-text text-sm font-semibold mb-2">useSelf</p>
          <CodeBlock>
            <Line>
              <span className="text-code-keyword">const</span> self ={" "}
              <span className="text-code-func">useSelf</span>();
            </Line>
            <Line>
              <span className="text-code-comment">{"// PresenceUser | null — your own presence data"}</span>
            </Line>
            <Line>
              <span className="text-code-keyword">if</span> (self) console.<span className="text-code-func">log</span>(self.displayName);
            </Line>
          </CodeBlock>
        </div>

        <div className="mb-6">
          <p className="text-text text-sm font-semibold mb-2">useMyPresence</p>
          <CodeBlock>
            <Line>
              <span className="text-code-keyword">const</span> [me, updatePresence] ={" "}
              <span className="text-code-func">useMyPresence</span>();
            </Line>
            <Line>
              <span className="text-code-comment">{"// Convenience tuple combining useSelf + useUpdateMyPresence"}</span>
            </Line>
            <Line>
              <span className="text-code-func">updatePresence</span>{"({ "}location: <span className="text-code-string">&quot;settings&quot;</span>{" });"}</Line>
          </CodeBlock>
        </div>

        <div className="mb-6">
          <p className="text-text text-sm font-semibold mb-2">useUpdateMyPresence</p>
          <CodeBlock>
            <Line>
              <span className="text-code-keyword">const</span> updatePresence ={" "}
              <span className="text-code-func">useUpdateMyPresence</span>();
            </Line>
            <Line>
              <span className="text-code-func">updatePresence</span>{"({ "}metadata: {"{ "}<span className="text-text">typing</span>: <span className="text-code-keyword">true</span>{" } });"}</Line>
          </CodeBlock>
        </div>

        <div className="mb-6">
          <p className="text-text text-sm font-semibold mb-2">useOthers</p>
          <CodeBlock>
            <Line>
              <span className="text-code-keyword">const</span> others ={" "}
              <span className="text-code-func">useOthers</span>();
            </Line>
            <Line>
              <span className="text-code-comment">{"// PresenceUser[] — all other users in the room"}</span>
            </Line>
            <Line>
              others.<span className="text-code-func">map</span>{"(u => "}<span className="text-code-func">console</span>.log(u.displayName){");"}</Line>
          </CodeBlock>
        </div>

        <div className="mb-6">
          <p className="text-text text-sm font-semibold mb-2">useOther</p>
          <CodeBlock>
            <Line>
              <span className="text-code-keyword">const</span> user ={" "}
              <span className="text-code-func">useOther</span>(<span className="text-code-string">&quot;user-2&quot;</span>);
            </Line>
            <Line>
              <span className="text-code-comment">{"// PresenceUser | null — single user by userId"}</span>
            </Line>
            <Line>
              <span className="text-code-keyword">const</span> name ={" "}
              <span className="text-code-func">useOther</span>(<span className="text-code-string">&quot;user-2&quot;</span>, u ={">"} u.displayName);
            </Line>
          </CodeBlock>
        </div>

        <div className="mb-6">
          <p className="text-text text-sm font-semibold mb-2">useOthersMapped</p>
          <CodeBlock>
            <Line>
              <span className="text-code-keyword">const</span> names ={" "}
              <span className="text-code-func">useOthersMapped</span>(u ={">"} u.displayName);
            </Line>
            <Line>
              <span className="text-code-comment">{"// T[] — mapped array, re-renders only when output changes"}</span>
            </Line>
          </CodeBlock>
        </div>

        <div>
          <p className="text-text text-sm font-semibold mb-2">useOthersUserIds</p>
          <CodeBlock>
            <Line>
              <span className="text-code-keyword">const</span> ids ={" "}
              <span className="text-code-func">useOthersUserIds</span>();
            </Line>
            <Line>
              <span className="text-code-comment">{"// string[] — sorted userIds, re-renders only on join/leave"}</span>
            </Line>
            <Line>
              ids.<span className="text-code-func">map</span>{"(id => <"}<span className="text-code-func">Cursor</span>{" "}key={"{id}"} userId={"{id}"}{" />);"}</Line>
          </CodeBlock>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Storage */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          Storage
        </h2>

        <div className="mb-6">
          <p className="text-text text-sm font-semibold mb-2">useStorage</p>
          <CodeBlock>
            <Line>
              <span className="text-code-keyword">const</span> count ={" "}
              <span className="text-code-func">useStorage</span>{"(root => root."}
              <span className="text-code-func">get</span>
              {"("}<span className="text-code-string">&quot;count&quot;</span>{"));"}</Line>
            <Line>
              <span className="text-code-comment">{"// T | null — null while storage is loading"}</span>
            </Line>
            <Line>
              <span className="text-code-keyword">if</span> (count === <span className="text-code-keyword">null</span>) <span className="text-code-keyword">return</span> {"<"}<span className="text-code-func">Loading</span>{" />;"}</Line>
          </CodeBlock>
        </div>

        <div className="mb-6">
          <p className="text-text text-sm font-semibold mb-2">useMutation</p>
          <CodeBlock>
            <Line>
              <span className="text-code-keyword">const</span> increment ={" "}
              <span className="text-code-func">useMutation</span>{"(("}{"{ storage }"}{", step: number) => {"}
            </Line>
            <Line indent>
              <span className="text-code-keyword">const</span> prev = storage.root.<span className="text-code-func">get</span>(<span className="text-code-string">&quot;count&quot;</span>) <span className="text-code-keyword">as</span> number;
            </Line>
            <Line indent>
              storage.root.<span className="text-code-func">set</span>(<span className="text-code-string">&quot;count&quot;</span>, prev + step);
            </Line>
            <Line>{"}, []);"}</Line>
          </CodeBlock>
        </div>

        <div className="mb-6">
          <p className="text-text text-sm font-semibold mb-2">useBatch</p>
          <CodeBlock>
            <Line>
              <span className="text-code-keyword">const</span> batch ={" "}
              <span className="text-code-func">useBatch</span>();
            </Line>
            <Line>
              <span className="text-code-func">batch</span>{"(() => {"} root.<span className="text-code-func">set</span>(<span className="text-code-string">&quot;x&quot;</span>, 1); root.<span className="text-code-func">set</span>(<span className="text-code-string">&quot;y&quot;</span>, 2); {"});"}</Line>
            <Line>
              <span className="text-code-comment">{"// Combines mutations into one history entry + network message"}</span>
            </Line>
          </CodeBlock>
        </div>

        <div className="mb-6">
          <p className="text-text text-sm font-semibold mb-2">useObject</p>
          <CodeBlock>
            <Line>
              <span className="text-code-keyword">const</span> settings ={" "}
              <span className="text-code-func">useObject</span>{"<{ theme: string }>"}(<span className="text-code-string">&quot;settings&quot;</span>);
            </Line>
            <Line>
              <span className="text-code-comment">{"// LiveObject<T> | null — shorthand for useStorage(root => root.get(key))"}</span>
            </Line>
            <Line>
              settings?.<span className="text-code-func">get</span>(<span className="text-code-string">&quot;theme&quot;</span>);
            </Line>
          </CodeBlock>
        </div>

        <div className="mb-6">
          <p className="text-text text-sm font-semibold mb-2">useMap</p>
          <CodeBlock>
            <Line>
              <span className="text-code-keyword">const</span> users ={" "}
              <span className="text-code-func">useMap</span>{"<UserData>"}(<span className="text-code-string">&quot;users&quot;</span>);
            </Line>
            <Line>
              <span className="text-code-comment">{"// LiveMap<string, V> | null"}</span>
            </Line>
            <Line>
              users?.<span className="text-code-func">get</span>(<span className="text-code-string">&quot;user-1&quot;</span>);
            </Line>
          </CodeBlock>
        </div>

        <div>
          <p className="text-text text-sm font-semibold mb-2">useList</p>
          <CodeBlock>
            <Line>
              <span className="text-code-keyword">const</span> items ={" "}
              <span className="text-code-func">useList</span>{"<string>"}(<span className="text-code-string">&quot;items&quot;</span>);
            </Line>
            <Line>
              <span className="text-code-comment">{"// LiveList<T> | null"}</span>
            </Line>
            <Line>
              items?.<span className="text-code-func">toArray</span>();
            </Line>
          </CodeBlock>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Cursors */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          Cursors
        </h2>

        <div className="mb-6">
          <p className="text-text text-sm font-semibold mb-2">useCursors</p>
          <CodeBlock>
            <Line>
              <span className="text-code-keyword">const</span> cursors ={" "}
              <span className="text-code-func">useCursors</span>();
            </Line>
            <Line>
              <span className="text-code-comment">{"// Map<string, CursorData> — keyed by userId"}</span>
            </Line>
            <Line>
              cursors.<span className="text-code-func">forEach</span>{"((c, id) => console.log(id, c.x, c.y));"}</Line>
          </CodeBlock>
        </div>

        <div>
          <p className="text-text text-sm font-semibold mb-2">useUpdateCursor</p>
          <CodeBlock>
            <Line>
              <span className="text-code-keyword">const</span> updateCursor ={" "}
              <span className="text-code-func">useUpdateCursor</span>();
            </Line>
            <Line>{""}</Line>
            <Line>
              {"<"}<span className="text-code-func">div</span>{" "}
              <span className="text-text">onMouseMove</span>={"{e => "}
              <span className="text-code-func">updateCursor</span>(e.clientX, e.clientY){"}"}{" />"}
            </Line>
          </CodeBlock>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Events */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          Events
        </h2>

        <div className="mb-6">
          <p className="text-text text-sm font-semibold mb-2">useBroadcastEvent</p>
          <CodeBlock>
            <Line>
              <span className="text-code-keyword">const</span> broadcast ={" "}
              <span className="text-code-func">useBroadcastEvent</span>{"<{ type: \"ping\" }>"};
            </Line>
            <Line>
              <span className="text-code-func">broadcast</span>{"({ "}type: <span className="text-code-string">&quot;ping&quot;</span>{" });"}</Line>
            <Line>
              <span className="text-code-comment">{"// Ephemeral — not persisted to storage"}</span>
            </Line>
          </CodeBlock>
        </div>

        <div>
          <p className="text-text text-sm font-semibold mb-2">useEventListener</p>
          <CodeBlock>
            <Line>
              <span className="text-code-func">useEventListener</span>{"<{ type: string }>"}{"(event => {"}
            </Line>
            <Line indent>
              <span className="text-code-keyword">if</span> (event.type === <span className="text-code-string">&quot;ping&quot;</span>) console.<span className="text-code-func">log</span>(<span className="text-code-string">&quot;got ping&quot;</span>);
            </Line>
            <Line>{"});"}</Line>
          </CodeBlock>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* History */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          History
        </h2>

        <div className="mb-6">
          <p className="text-text text-sm font-semibold mb-2">useUndo / useRedo</p>
          <CodeBlock>
            <Line>
              <span className="text-code-keyword">const</span> undo ={" "}
              <span className="text-code-func">useUndo</span>();
            </Line>
            <Line>
              <span className="text-code-keyword">const</span> redo ={" "}
              <span className="text-code-func">useRedo</span>();
            </Line>
            <Line>
              <span className="text-code-comment">{"// () => void — trigger undo/redo on storage"}</span>
            </Line>
          </CodeBlock>
        </div>

        <div className="mb-6">
          <p className="text-text text-sm font-semibold mb-2">useCanUndo / useCanRedo</p>
          <CodeBlock>
            <Line>
              <span className="text-code-keyword">const</span> canUndo ={" "}
              <span className="text-code-func">useCanUndo</span>();
            </Line>
            <Line>
              <span className="text-code-keyword">const</span> canRedo ={" "}
              <span className="text-code-func">useCanRedo</span>();
            </Line>
            <Line>
              <span className="text-code-comment">{"// boolean — re-renders when availability changes"}</span>
            </Line>
          </CodeBlock>
        </div>

        <div>
          <p className="text-text text-sm font-semibold mb-2">useHistory</p>
          <CodeBlock>
            <Line>
              <span className="text-code-keyword">const</span> {"{ "}undo, redo, canUndo, canRedo{" }"} ={" "}
              <span className="text-code-func">useHistory</span>();
            </Line>
            <Line>
              <span className="text-code-comment">{"// Combined hook returning all undo/redo utilities"}</span>
            </Line>
          </CodeBlock>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Suspense */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          Suspense
        </h2>

        <p className="text-muted text-sm mb-4">
          Suspense variants throw a promise while storage loads, removing the need
          for <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">null</code> checks.
          Wrap in a React{" "}
          <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">{"<Suspense>"}</code>{" "}
          boundary or use{" "}
          <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">{"<ClientSideSuspense>"}</code>.
        </p>

        <CodeBlock>
          <Line>
            <span className="text-code-keyword">import</span>
            {" { "}
            <span className="text-text">useStorageSuspense, useObjectSuspense, useMapSuspense, useListSuspense</span>
            {" } "}
            <span className="text-code-keyword">from</span>{" "}
            <span className="text-code-string">&quot;@waits/lively-react&quot;</span>;
          </Line>
          <Line>{""}</Line>
          <Line>
            <span className="text-code-keyword">const</span> count ={" "}
            <span className="text-code-func">useStorageSuspense</span>{"(root => root."}
            <span className="text-code-func">get</span>
            {"("}<span className="text-code-string">&quot;count&quot;</span>{"));"}</Line>
          <Line>
            <span className="text-code-keyword">const</span> settings ={" "}
            <span className="text-code-func">useObjectSuspense</span>(<span className="text-code-string">&quot;settings&quot;</span>);
          </Line>
          <Line>
            <span className="text-code-keyword">const</span> users ={" "}
            <span className="text-code-func">useMapSuspense</span>(<span className="text-code-string">&quot;users&quot;</span>);
          </Line>
          <Line>
            <span className="text-code-keyword">const</span> items ={" "}
            <span className="text-code-func">useListSuspense</span>(<span className="text-code-string">&quot;items&quot;</span>);
          </Line>
        </CodeBlock>

        <div className="mt-6">
          <p className="text-text text-sm font-semibold mb-2">ClientSideSuspense</p>
          <CodeBlock>
            <Line>
              <span className="text-code-keyword">import</span>
              {" { "}
              <span className="text-text">ClientSideSuspense</span>
              {" } "}
              <span className="text-code-keyword">from</span>{" "}
              <span className="text-code-string">&quot;@waits/lively-react&quot;</span>;
            </Line>
            <Line>{""}</Line>
            <Line>
              {"<"}<span className="text-code-func">ClientSideSuspense</span>{" "}
              <span className="text-text">fallback</span>={"{"}<span className="text-code-func">{"<Loading />"}</span>{"}"}{">"}
            </Line>
            <Line indent>
              {"<"}<span className="text-code-func">CollaborativeEditor</span>{" />"}
            </Line>
            <Line>
              {"</"}<span className="text-code-func">ClientSideSuspense</span>{">"}
            </Line>
          </CodeBlock>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Next Steps */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          See Also
        </h2>
        <ul className="space-y-2 text-sm">
          <li>
            <Link href="/docs/quick-start" className="text-primary hover:underline">
              Quick Start guide &rarr;
            </Link>
          </li>
          <li>
            <Link href="/docs/storage" className="text-primary hover:underline">
              Storage & CRDTs &rarr;
            </Link>
          </li>
          <li>
            <Link href="/docs/client" className="text-primary hover:underline">
              Client reference &rarr;
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
