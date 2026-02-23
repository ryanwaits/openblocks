import Link from "next/link";
import { CodeBlock, Line } from "../components/code-block";

export default function QuickStartPage() {
  return (
    <>
      <h1 className="font-sans text-3xl md:text-4xl font-bold tracking-tight text-text mb-4">
        Quick Start
      </h1>
      <p className="text-muted text-lg mb-10 max-w-2xl">
        Get real-time collaboration running in your React app in under 5 minutes.
      </p>

      {/* Step 1: Install */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          1. Install
        </h2>
        <CodeBlock filename="terminal">
          <Line>
            <span className="text-code-keyword">$</span>{" "}
            <span className="text-text">
              bun add @waits/lively-client @waits/lively-react @waits/lively-server
            </span>
          </Line>
        </CodeBlock>
      </section>

      {/* Step 2: Start server */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          2. Start the server
        </h2>
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
            {"({ "}port: <span className="text-code-func">1999</span>{" });"}</Line>
          <Line>
            server.<span className="text-code-func">start</span>();
          </Line>
        </CodeBlock>
        <p className="text-muted text-xs mt-3">
          Run with <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">bun run server.ts</code> — the
          WebSocket server starts on port 1999.
        </p>
      </section>

      {/* Step 3: Wrap app */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          3. Wrap your app
        </h2>
        <CodeBlock filename="app.tsx">
          <Line>
            <span className="text-code-keyword">import</span>
            {" { "}
            <span className="text-text">LivelyProvider, RoomProvider</span>
            {" } "}
            <span className="text-code-keyword">from</span>{" "}
            <span className="text-code-string">&quot;@waits/lively-react&quot;</span>;
          </Line>
          <Line>{""}</Line>
          <Line>
            <span className="text-code-keyword">function</span>{" "}
            <span className="text-code-func">App</span>() {"{"}
          </Line>
          <Line indent>
            <span className="text-code-keyword">return</span> (
          </Line>
          <Line indent>
            {"  <"}<span className="text-code-func">LivelyProvider</span>{" "}
            <span className="text-text">serverUrl</span>=<span className="text-code-string">&quot;ws://localhost:1999&quot;</span>{">"}
          </Line>
          <Line indent>
            {"    <"}<span className="text-code-func">RoomProvider</span>{" "}
            <span className="text-text">roomId</span>=<span className="text-code-string">&quot;my-room&quot;</span>{">"}
          </Line>
          <Line indent>
            {"      <"}<span className="text-code-func">YourApp</span>{" />"}
          </Line>
          <Line indent>
            {"    </"}<span className="text-code-func">RoomProvider</span>{">"}
          </Line>
          <Line indent>
            {"  </"}<span className="text-code-func">LivelyProvider</span>{">"}
          </Line>
          <Line indent>);</Line>
          <Line>{"}"}</Line>
        </CodeBlock>
      </section>

      {/* Step 4: Use hooks */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          4. Use the hooks
        </h2>

        <div className="space-y-6">
          <div>
            <p className="text-muted text-sm mb-2">
              Show who&apos;s online:
            </p>
            <CodeBlock filename="who-is-here.tsx">
              <Line>
                <span className="text-code-keyword">import</span>
                {" { "}
                <span className="text-text">useOthers</span>
                {" } "}
                <span className="text-code-keyword">from</span>{" "}
                <span className="text-code-string">&quot;@waits/lively-react&quot;</span>;
              </Line>
              <Line>{""}</Line>
              <Line>
                <span className="text-code-keyword">function</span>{" "}
                <span className="text-code-func">WhoIsHere</span>() {"{"}
              </Line>
              <Line indent>
                <span className="text-code-keyword">const</span> others ={" "}
                <span className="text-code-func">useOthers</span>();
              </Line>
              <Line indent>
                <span className="text-code-keyword">return</span>{" "}
                {"<"}<span className="text-code-func">div</span>{">"}{"{"}others.length{"}"} others online{"</"}<span className="text-code-func">div</span>{">"};
              </Line>
              <Line>{"}"}</Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              Share cursor position:
            </p>
            <CodeBlock filename="cursors.tsx">
              <Line>
                <span className="text-code-keyword">import</span>
                {" { "}
                <span className="text-text">useMyPresence</span>
                {" } "}
                <span className="text-code-keyword">from</span>{" "}
                <span className="text-code-string">&quot;@waits/lively-react&quot;</span>;
              </Line>
              <Line>{""}</Line>
              <Line>
                <span className="text-code-keyword">const</span> [me, update] ={" "}
                <span className="text-code-func">useMyPresence</span>();
              </Line>
              <Line>
                <span className="text-code-comment">{"// Call update({ cursor: { x, y } }) on mousemove"}</span>
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              Sync shared state:
            </p>
            <CodeBlock filename="counter.tsx">
              <Line>
                <span className="text-code-keyword">import</span>
                {" { "}
                <span className="text-text">useStorage, useMutation</span>
                {" } "}
                <span className="text-code-keyword">from</span>{" "}
                <span className="text-code-string">&quot;@waits/lively-react&quot;</span>;
              </Line>
              <Line>{""}</Line>
              <Line>
                <span className="text-code-keyword">const</span> count ={" "}
                <span className="text-code-func">useStorage</span>
                {"(root => root."}
                <span className="text-code-func">get</span>
                {"("}<span className="text-code-string">&quot;count&quot;</span>{"));"}</Line>
              <Line>
                <span className="text-code-keyword">const</span> increment ={" "}
                <span className="text-code-func">useMutation</span>
                {"((root) => {"}
              </Line>
              <Line indent>
                root.<span className="text-code-func">set</span>
                {"("}<span className="text-code-string">&quot;count&quot;</span>
                {", root."}<span className="text-code-func">get</span>
                {"("}<span className="text-code-string">&quot;count&quot;</span>
                {") + 1);"}
              </Line>
              <Line>{"}, []);"}</Line>
            </CodeBlock>
          </div>
        </div>
      </section>

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
          <li>
            <a href="/#examples" className="text-primary hover:underline">
              Live examples &rarr;
            </a>
          </li>
        </ul>
      </section>
    </>
  );
}
