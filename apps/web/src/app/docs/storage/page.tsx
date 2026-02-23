import Link from "next/link";
import { CodeBlock, Line } from "../components/code-block";

export default function StoragePage() {
  return (
    <>
      <h1 className="font-sans text-3xl md:text-4xl font-bold tracking-tight text-text mb-4">
        Storage
      </h1>
      <p className="text-muted text-lg mb-10 max-w-2xl">
        CRDT primitives for conflict-free collaborative state.
        The <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">@waits/lively-storage</code> package
        provides <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">LiveObject</code>,{" "}
        <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">LiveMap</code>, and{" "}
        <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">LiveList</code> —
        nestable data structures that automatically resolve conflicts using last-writer-wins semantics and Lamport clocks.
      </p>

      {/* Installation */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          Install
        </h2>
        <CodeBlock filename="terminal">
          <Line>
            <span className="text-code-keyword">$</span>{" "}
            <span className="text-text">bun add @waits/lively-storage</span>
          </Line>
        </CodeBlock>
      </section>

      {/* StorageDocument */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          StorageDocument
        </h2>
        <p className="text-muted text-sm mb-4">
          The top-level container that owns the CRDT tree, manages subscriptions, and coordinates serialization.
        </p>

        <div className="space-y-6">
          <div>
            <p className="text-muted text-sm mb-2">Create a document with a root object:</p>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">import</span>
                {" { "}
                <span className="text-text">StorageDocument, LiveObject</span>
                {" } "}
                <span className="text-code-keyword">from</span>{" "}
                <span className="text-code-string">&quot;@waits/lively-storage&quot;</span>;
              </Line>
              <Line>{""}</Line>
              <Line>
                <span className="text-code-keyword">const</span> root ={" "}
                <span className="text-code-keyword">new</span>{" "}
                <span className="text-code-func">LiveObject</span>
                {"({ count: 0, name: "}<span className="text-code-string">&quot;untitled&quot;</span>{" });"}
              </Line>
              <Line>
                <span className="text-code-keyword">const</span> doc ={" "}
                <span className="text-code-keyword">new</span>{" "}
                <span className="text-code-func">StorageDocument</span>(root);
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">getRoot()</code> returns
              the root <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">LiveObject</code>:
            </p>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">const</span> root = doc.<span className="text-code-func">getRoot</span>();
              </Line>
              <Line>
                root.<span className="text-code-func">get</span>(<span className="text-code-string">&quot;count&quot;</span>);{" "}
                <span className="text-code-comment">{"// 0"}</span>
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">Serialize and deserialize for persistence:</p>
            <CodeBlock>
              <Line>
                <span className="text-code-comment">{"// Serialize the entire tree"}</span>
              </Line>
              <Line>
                <span className="text-code-keyword">const</span> snapshot = doc.<span className="text-code-func">serialize</span>();
              </Line>
              <Line>{""}</Line>
              <Line>
                <span className="text-code-comment">{"// Restore from snapshot"}</span>
              </Line>
              <Line>
                <span className="text-code-keyword">const</span> restored = StorageDocument.<span className="text-code-func">deserialize</span>(snapshot);
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              Subscribe to changes — shallow or deep:
            </p>
            <CodeBlock>
              <Line>
                <span className="text-code-comment">{"// Shallow: fires when root fields change"}</span>
              </Line>
              <Line>
                <span className="text-code-keyword">const</span> unsub = doc.<span className="text-code-func">subscribe</span>(root, () ={"> {"}
              </Line>
              <Line indent>
                console.<span className="text-code-func">log</span>(<span className="text-code-string">&quot;root changed&quot;</span>);
              </Line>
              <Line>{"});"}</Line>
              <Line>{""}</Line>
              <Line>
                <span className="text-code-comment">{"// Deep: fires on any nested change"}</span>
              </Line>
              <Line>
                <span className="text-code-keyword">const</span> unsub2 = doc.<span className="text-code-func">subscribe</span>(root, () ={"> {"}{" "}
              </Line>
              <Line indent>
                console.<span className="text-code-func">log</span>(<span className="text-code-string">&quot;something changed&quot;</span>);
              </Line>
              <Line>{"}, { isDeep: true });"}</Line>
              <Line>{""}</Line>
              <Line>
                <span className="text-code-comment">{"// Call unsub() to remove the listener"}</span>
              </Line>
              <Line>
                <span className="text-code-func">unsub</span>();
              </Line>
            </CodeBlock>
          </div>
        </div>
      </section>

      {/* LiveObject */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          LiveObject
        </h2>
        <p className="text-muted text-sm mb-4">
          A conflict-free replicated object. Each field uses last-writer-wins with Lamport clocks.
          Supports nested CRDT values.
        </p>

        <div className="space-y-6">
          <div>
            <p className="text-muted text-sm mb-2">Constructor and basic operations:</p>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">import</span>
                {" { "}
                <span className="text-text">LiveObject</span>
                {" } "}
                <span className="text-code-keyword">from</span>{" "}
                <span className="text-code-string">&quot;@waits/lively-storage&quot;</span>;
              </Line>
              <Line>{""}</Line>
              <Line>
                <span className="text-code-keyword">const</span> obj ={" "}
                <span className="text-code-keyword">new</span>{" "}
                <span className="text-code-func">LiveObject</span>
                {"({ x: 0, y: 0, label: "}<span className="text-code-string">&quot;origin&quot;</span>{" });"}
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">get(key)</code> — read a field:
            </p>
            <CodeBlock>
              <Line>
                obj.<span className="text-code-func">get</span>(<span className="text-code-string">&quot;x&quot;</span>);{" "}
                <span className="text-code-comment">{"// 0"}</span>
              </Line>
              <Line>
                obj.<span className="text-code-func">get</span>(<span className="text-code-string">&quot;label&quot;</span>);{" "}
                <span className="text-code-comment">{"// \"origin\""}</span>
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">set(key, value)</code> — write a field.
              Generates an op, ticks the clock, and notifies subscribers:
            </p>
            <CodeBlock>
              <Line>
                obj.<span className="text-code-func">set</span>(<span className="text-code-string">&quot;x&quot;</span>, 100);
              </Line>
              <Line>
                obj.<span className="text-code-func">set</span>(<span className="text-code-string">&quot;label&quot;</span>,{" "}
                <span className="text-code-string">&quot;moved&quot;</span>);
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">delete(key)</code> — remove a field:
            </p>
            <CodeBlock>
              <Line>
                obj.<span className="text-code-func">set</span>(<span className="text-code-string">&quot;temp&quot;</span>, true);
              </Line>
              <Line>
                <span className="text-code-comment">{"// LiveObject inherits delete from set with a delete op"}</span>
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">toObject()</code> — snapshot as a plain JS object:
            </p>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">const</span> plain = obj.<span className="text-code-func">toObject</span>();
              </Line>
              <Line>
                <span className="text-code-comment">{"// { x: 100, y: 0, label: \"moved\" }"}</span>
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">toImmutable()</code> — frozen snapshot (cached until next mutation):
            </p>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">const</span> frozen = obj.<span className="text-code-func">toImmutable</span>();
              </Line>
              <Line>
                <span className="text-code-comment">{"// Object.isFrozen(frozen) === true"}</span>
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              Nesting CRDTs inside a <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">LiveObject</code>:
            </p>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">import</span>
                {" { "}
                <span className="text-text">LiveObject, LiveList</span>
                {" } "}
                <span className="text-code-keyword">from</span>{" "}
                <span className="text-code-string">&quot;@waits/lively-storage&quot;</span>;
              </Line>
              <Line>{""}</Line>
              <Line>
                <span className="text-code-keyword">const</span> root ={" "}
                <span className="text-code-keyword">new</span>{" "}
                <span className="text-code-func">LiveObject</span>({"{"}
              </Line>
              <Line indent>
                settings: <span className="text-code-keyword">new</span>{" "}
                <span className="text-code-func">LiveObject</span>({"{ theme: "}
                <span className="text-code-string">&quot;dark&quot;</span>{" }),"}
              </Line>
              <Line indent>
                items: <span className="text-code-keyword">new</span>{" "}
                <span className="text-code-func">LiveList</span>([]),
              </Line>
              <Line>{"});"}</Line>
            </CodeBlock>
          </div>
        </div>
      </section>

      {/* LiveMap */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          LiveMap
        </h2>
        <p className="text-muted text-sm mb-4">
          A conflict-free replicated map with string keys. Uses tombstones for deletes so concurrent
          set/delete pairs resolve correctly.
        </p>

        <div className="space-y-6">
          <div>
            <p className="text-muted text-sm mb-2">Constructor:</p>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">import</span>
                {" { "}
                <span className="text-text">LiveMap</span>
                {" } "}
                <span className="text-code-keyword">from</span>{" "}
                <span className="text-code-string">&quot;@waits/lively-storage&quot;</span>;
              </Line>
              <Line>{""}</Line>
              <Line>
                <span className="text-code-keyword">const</span> map ={" "}
                <span className="text-code-keyword">new</span>{" "}
                <span className="text-code-func">LiveMap</span>([
              </Line>
              <Line indent>
                [<span className="text-code-string">&quot;alice&quot;</span>, {"{ score: 10 }"}],
              </Line>
              <Line indent>
                [<span className="text-code-string">&quot;bob&quot;</span>, {"{ score: 20 }"}],
              </Line>
              <Line>]);</Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">get(key)</code> /{" "}
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">set(key, value)</code> /{" "}
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">delete(key)</code> /{" "}
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">has(key)</code>:
            </p>
            <CodeBlock>
              <Line>
                map.<span className="text-code-func">get</span>(<span className="text-code-string">&quot;alice&quot;</span>);{" "}
                <span className="text-code-comment">{"// { score: 10 }"}</span>
              </Line>
              <Line>{""}</Line>
              <Line>
                map.<span className="text-code-func">set</span>(<span className="text-code-string">&quot;carol&quot;</span>, {"{ score: 30 }"});
              </Line>
              <Line>{""}</Line>
              <Line>
                map.<span className="text-code-func">has</span>(<span className="text-code-string">&quot;carol&quot;</span>);{" "}
                <span className="text-code-comment">{"// true"}</span>
              </Line>
              <Line>{""}</Line>
              <Line>
                map.<span className="text-code-func">delete</span>(<span className="text-code-string">&quot;bob&quot;</span>);
              </Line>
              <Line>
                map.<span className="text-code-func">has</span>(<span className="text-code-string">&quot;bob&quot;</span>);{" "}
                <span className="text-code-comment">{"// false"}</span>
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">size</code> — number of live (non-deleted) entries:
            </p>
            <CodeBlock>
              <Line>
                map.size;{" "}
                <span className="text-code-comment">{"// 2"}</span>
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">Iteration — <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">entries()</code>,{" "}
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">keys()</code>,{" "}
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">values()</code>,{" "}
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">forEach()</code>:
            </p>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">for</span> (<span className="text-code-keyword">const</span> [key, val]{" "}
                <span className="text-code-keyword">of</span> map.<span className="text-code-func">entries</span>()) {"{"}
              </Line>
              <Line indent>
                console.<span className="text-code-func">log</span>(key, val);
              </Line>
              <Line>{"}"}</Line>
              <Line>{""}</Line>
              <Line>
                map.<span className="text-code-func">forEach</span>((value, key) ={"> {"}
              </Line>
              <Line indent>
                console.<span className="text-code-func">log</span>(key, value);
              </Line>
              <Line>{"});"}</Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">toImmutable()</code> — frozen{" "}
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">ReadonlyMap</code> snapshot:
            </p>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">const</span> snapshot = map.<span className="text-code-func">toImmutable</span>();
              </Line>
              <Line>
                <span className="text-code-comment">{"// ReadonlyMap<string, V>"}</span>
              </Line>
            </CodeBlock>
          </div>
        </div>
      </section>

      {/* LiveList */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          LiveList
        </h2>
        <p className="text-muted text-sm mb-4">
          A conflict-free replicated list. Uses fractional indexing so concurrent inserts
          never collide — items interleave deterministically without shifting indices.
        </p>

        <div className="space-y-6">
          <div>
            <p className="text-muted text-sm mb-2">Constructor:</p>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">import</span>
                {" { "}
                <span className="text-text">LiveList</span>
                {" } "}
                <span className="text-code-keyword">from</span>{" "}
                <span className="text-code-string">&quot;@waits/lively-storage&quot;</span>;
              </Line>
              <Line>{""}</Line>
              <Line>
                <span className="text-code-keyword">const</span> list ={" "}
                <span className="text-code-keyword">new</span>{" "}
                <span className="text-code-func">LiveList</span>([<span className="text-code-string">&quot;a&quot;</span>,{" "}
                <span className="text-code-string">&quot;b&quot;</span>,{" "}
                <span className="text-code-string">&quot;c&quot;</span>]);
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">push(item)</code> — append to end:
            </p>
            <CodeBlock>
              <Line>
                list.<span className="text-code-func">push</span>(<span className="text-code-string">&quot;d&quot;</span>);
              </Line>
              <Line>
                list.<span className="text-code-func">toArray</span>();{" "}
                <span className="text-code-comment">{"// [\"a\", \"b\", \"c\", \"d\"]"}</span>
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">insert(item, index)</code> — insert at position:
            </p>
            <CodeBlock>
              <Line>
                list.<span className="text-code-func">insert</span>(<span className="text-code-string">&quot;x&quot;</span>, 1);
              </Line>
              <Line>
                list.<span className="text-code-func">toArray</span>();{" "}
                <span className="text-code-comment">{"// [\"a\", \"x\", \"b\", \"c\", \"d\"]"}</span>
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">delete(index)</code> — remove by index:
            </p>
            <CodeBlock>
              <Line>
                list.<span className="text-code-func">delete</span>(1);{" "}
                <span className="text-code-comment">{"// removes \"x\""}</span>
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">move(from, to)</code> — reorder an item:
            </p>
            <CodeBlock>
              <Line>
                list.<span className="text-code-func">move</span>(0, 2);{" "}
                <span className="text-code-comment">{"// move first item to index 2"}</span>
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">get(index)</code> /{" "}
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">length</code>:
            </p>
            <CodeBlock>
              <Line>
                list.<span className="text-code-func">get</span>(0);{" "}
                <span className="text-code-comment">{"// first item"}</span>
              </Line>
              <Line>
                list.length;{" "}
                <span className="text-code-comment">{"// number of items"}</span>
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">toArray()</code> — snapshot as plain array.{" "}
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">toImmutable()</code> — frozen{" "}
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">readonly T[]</code>:
            </p>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">const</span> arr = list.<span className="text-code-func">toArray</span>();
              </Line>
              <Line>
                <span className="text-code-keyword">const</span> frozen = list.<span className="text-code-func">toImmutable</span>();
              </Line>
              <Line>
                <span className="text-code-comment">{"// Object.isFrozen(frozen) === true"}</span>
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              Subscribe to list changes:
            </p>
            <CodeBlock>
              <Line>
                <span className="text-code-comment">{"// Via StorageDocument — works for all CRDT types"}</span>
              </Line>
              <Line>
                doc.<span className="text-code-func">subscribe</span>(list, () ={"> {"}
              </Line>
              <Line indent>
                console.<span className="text-code-func">log</span>(<span className="text-code-string">&quot;list changed&quot;</span>, list.<span className="text-code-func">toArray</span>());
              </Line>
              <Line>{"});"}</Line>
            </CodeBlock>
          </div>
        </div>
      </section>

      {/* HistoryManager */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          HistoryManager
        </h2>
        <p className="text-muted text-sm mb-4">
          Built-in undo/redo with automatic inverse-op computation. Every mutation on a{" "}
          <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">StorageDocument</code> is recorded.
          Group related mutations into a single undo step with{" "}
          <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">batch()</code>.
        </p>

        <div className="space-y-6">
          <div>
            <p className="text-muted text-sm mb-2">Access from the document:</p>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">const</span> history = doc.<span className="text-code-func">getHistory</span>();
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">undo()</code> /{" "}
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">redo()</code>:
            </p>
            <CodeBlock>
              <Line>
                history.<span className="text-code-func">undo</span>();{" "}
                <span className="text-code-comment">{"// returns inverse ops or null"}</span>
              </Line>
              <Line>
                history.<span className="text-code-func">redo</span>();{" "}
                <span className="text-code-comment">{"// returns forward ops or null"}</span>
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">canUndo()</code> /{" "}
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">canRedo()</code>:
            </p>
            <CodeBlock>
              <Line>
                history.<span className="text-code-func">canUndo</span>();{" "}
                <span className="text-code-comment">{"// boolean"}</span>
              </Line>
              <Line>
                history.<span className="text-code-func">canRedo</span>();{" "}
                <span className="text-code-comment">{"// boolean"}</span>
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">startBatch()</code> /{" "}
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">endBatch()</code> — group mutations into one undo entry:
            </p>
            <CodeBlock>
              <Line>
                history.<span className="text-code-func">startBatch</span>();
              </Line>
              <Line>
                root.<span className="text-code-func">set</span>(<span className="text-code-string">&quot;x&quot;</span>, 10);
              </Line>
              <Line>
                root.<span className="text-code-func">set</span>(<span className="text-code-string">&quot;y&quot;</span>, 20);
              </Line>
              <Line>
                history.<span className="text-code-func">endBatch</span>();
              </Line>
              <Line>{""}</Line>
              <Line>
                <span className="text-code-comment">{"// Single undo() reverts both x and y"}</span>
              </Line>
              <Line>
                history.<span className="text-code-func">undo</span>();
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">subscribe(cb)</code> — listen for undo/redo stack changes:
            </p>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">const</span> unsub = history.<span className="text-code-func">subscribe</span>(() ={"> {"}
              </Line>
              <Line indent>
                console.<span className="text-code-func">log</span>(
              </Line>
              <Line indent>
                {"  "}<span className="text-code-string">&quot;can undo:&quot;</span>, history.<span className="text-code-func">canUndo</span>(),
              </Line>
              <Line indent>
                {"  "}<span className="text-code-string">&quot;can redo:&quot;</span>, history.<span className="text-code-func">canRedo</span>()
              </Line>
              <Line indent>);</Line>
              <Line>{"});"}</Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              Constructor config:
            </p>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">new</span>{" "}
                <span className="text-code-func">StorageDocument</span>(root, {"{"}
              </Line>
              <Line indent>
                maxEntries: 50,{" "}
                <span className="text-code-comment">{"// default: 100"}</span>
              </Line>
              <Line indent>
                enabled: <span className="text-code-keyword">true</span>,{" "}
                <span className="text-code-comment">{"// default: true"}</span>
              </Line>
              <Line>{"});"}</Line>
            </CodeBlock>
          </div>
        </div>
      </section>

      {/* Utilities */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          Utilities
        </h2>

        <div className="space-y-6">
          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">generateKeyBetween(a, b)</code> — fractional indexing.
              Returns a string key that sorts between{" "}
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">a</code> and{" "}
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">b</code>.
              Pass <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">null</code> for start/end of list:
            </p>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">import</span>
                {" { "}
                <span className="text-text">generateKeyBetween</span>
                {" } "}
                <span className="text-code-keyword">from</span>{" "}
                <span className="text-code-string">&quot;@waits/lively-storage&quot;</span>;
              </Line>
              <Line>{""}</Line>
              <Line>
                <span className="text-code-keyword">const</span> first ={" "}
                <span className="text-code-func">generateKeyBetween</span>(<span className="text-code-keyword">null</span>,{" "}
                <span className="text-code-keyword">null</span>);{" "}
                <span className="text-code-comment">{"// \"V\""}</span>
              </Line>
              <Line>
                <span className="text-code-keyword">const</span> after ={" "}
                <span className="text-code-func">generateKeyBetween</span>(first,{" "}
                <span className="text-code-keyword">null</span>);{" "}
                <span className="text-code-comment">{"// sorts after first"}</span>
              </Line>
              <Line>
                <span className="text-code-keyword">const</span> between ={" "}
                <span className="text-code-func">generateKeyBetween</span>(first, after);{" "}
                <span className="text-code-comment">{"// sorts between"}</span>
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">generateNKeysBetween(a, b, n)</code> — generate{" "}
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">n</code> evenly-spaced keys:
            </p>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">import</span>
                {" { "}
                <span className="text-text">generateNKeysBetween</span>
                {" } "}
                <span className="text-code-keyword">from</span>{" "}
                <span className="text-code-string">&quot;@waits/lively-storage&quot;</span>;
              </Line>
              <Line>{""}</Line>
              <Line>
                <span className="text-code-keyword">const</span> keys ={" "}
                <span className="text-code-func">generateNKeysBetween</span>(<span className="text-code-keyword">null</span>,{" "}
                <span className="text-code-keyword">null</span>, 5);
              </Line>
              <Line>
                <span className="text-code-comment">{"// 5 keys in sorted order"}</span>
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">computeInverseOp(op)</code> — compute the inverse of a storage op (used internally by HistoryManager):
            </p>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">import</span>
                {" { "}
                <span className="text-text">computeInverseOp</span>
                {" } "}
                <span className="text-code-keyword">from</span>{" "}
                <span className="text-code-string">&quot;@waits/lively-storage&quot;</span>;
              </Line>
              <Line>{""}</Line>
              <Line>
                <span className="text-code-keyword">const</span> inverse ={" "}
                <span className="text-code-func">computeInverseOp</span>(op);
              </Line>
            </CodeBlock>
          </div>

          <div>
            <p className="text-muted text-sm mb-2">
              <code className="bg-code-bg px-1 py-0.5 border border-code-border text-[11px]">LamportClock</code> — logical clock for causal ordering:
            </p>
            <CodeBlock>
              <Line>
                <span className="text-code-keyword">import</span>
                {" { "}
                <span className="text-text">LamportClock</span>
                {" } "}
                <span className="text-code-keyword">from</span>{" "}
                <span className="text-code-string">&quot;@waits/lively-storage&quot;</span>;
              </Line>
              <Line>{""}</Line>
              <Line>
                <span className="text-code-keyword">const</span> clock ={" "}
                <span className="text-code-keyword">new</span>{" "}
                <span className="text-code-func">LamportClock</span>();
              </Line>
              <Line>
                clock.<span className="text-code-func">tick</span>();{" "}
                <span className="text-code-comment">{"// increments and returns new value"}</span>
              </Line>
              <Line>
                clock.<span className="text-code-func">merge</span>(remoteClock);{" "}
                <span className="text-code-comment">{"// max(local, remote) + 1"}</span>
              </Line>
            </CodeBlock>
          </div>
        </div>
      </section>

      {/* Types */}
      <section className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          Types
        </h2>
        <p className="text-muted text-sm mb-4">
          Exported TypeScript types for advanced usage.
        </p>
        <CodeBlock>
          <Line>
            <span className="text-code-keyword">import</span>{" "}
            <span className="text-code-keyword">type</span>
            {" {"}
          </Line>
          <Line indent>
            <span className="text-text">StorageDocumentHost</span>,{" "}
            <span className="text-code-comment">{"// interface for doc host"}</span>
          </Line>
          <Line indent>
            <span className="text-text">HistoryEntry</span>,{" "}
            <span className="text-code-comment">{"// { forward: Op[], inverse: Op[] }"}</span>
          </Line>
          <Line indent>
            <span className="text-text">HistoryConfig</span>,{" "}
            <span className="text-code-comment">{"// { maxEntries?, enabled? }"}</span>
          </Line>
          <Line indent>
            <span className="text-text">FieldSnapshot</span>,{" "}
            <span className="text-code-comment">{"// snapshot for inverse computation"}</span>
          </Line>
          <Line>
            {"} "}
            <span className="text-code-keyword">from</span>{" "}
            <span className="text-code-string">&quot;@waits/lively-storage&quot;</span>;
          </Line>
        </CodeBlock>
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
            <Link href="/docs/client" className="text-primary hover:underline">
              Client configuration &rarr;
            </Link>
          </li>
          <li>
            <Link href="/docs/server" className="text-primary hover:underline">
              Server configuration &rarr;
            </Link>
          </li>
          <li>
            <Link href="/docs/quick-start" className="text-primary hover:underline">
              Quick start guide &rarr;
            </Link>
          </li>
        </ul>
      </section>
    </>
  );
}
