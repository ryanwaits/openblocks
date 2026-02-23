import Link from "next/link";
import { CodeBlock } from "./components/code-block";

const PACKAGES = [
  {
    name: "@waits/lively-client",
    description: "WebSocket client, room management, presence, cursors, and storage sync.",
    href: "/docs/client",
  },
  {
    name: "@waits/lively-react",
    description: "React hooks and providers for presence, storage, cursors, events, and undo/redo.",
    href: "/docs/react",
  },
  {
    name: "@waits/lively-server",
    description: "Bun-native WebSocket server with auth, room callbacks, and Yjs support.",
    href: "/docs/server",
  },
  {
    name: "@waits/lively-storage",
    description: "CRDT primitives — LiveObject, LiveMap, LiveList — with history and fractional indexing.",
    href: "/docs/storage",
  },
];

export default function DocsOverview() {
  return (
    <>
      <h1 className="font-sans text-3xl md:text-4xl font-bold tracking-tight text-text mb-4">
        Lively Documentation
      </h1>
      <p className="text-muted text-lg mb-8 max-w-2xl">
        Lively is a self-hosted, real-time collaboration SDK for the modern web.
        Add presence, cursor tracking, shared storage, and event broadcasting to
        any application with a few lines of code.
      </p>

      <div className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          Architecture
        </h2>
        <p className="text-muted text-sm mb-4">
          The SDK is organized as a layered package stack. Each layer builds on the one below it:
        </p>
        <CodeBlock>
          <span className="text-code-comment">{"// Package dependency graph"}</span>
          <br />
          <span className="text-muted">{"@waits/lively-types"}</span>
          <span className="text-code-comment">{" ← shared type definitions"}</span>
          <br />
          <span className="text-muted">{"  └─ "}</span>
          <span className="text-text">{"@waits/lively-storage"}</span>
          <span className="text-code-comment">{" ← CRDTs + history"}</span>
          <br />
          <span className="text-muted">{"      ├─ "}</span>
          <span className="text-text">{"@waits/lively-client"}</span>
          <span className="text-code-comment">{" ← WebSocket client"}</span>
          <br />
          <span className="text-muted">{"      ├─ "}</span>
          <span className="text-text">{"@waits/lively-server"}</span>
          <span className="text-code-comment">{" ← Bun server"}</span>
          <br />
          <span className="text-muted">{"      └─ "}</span>
          <span className="text-text">{"@waits/lively-react"}</span>
          <span className="text-code-comment">{" ← React hooks"}</span>
        </CodeBlock>
      </div>

      <div className="mb-12">
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          Packages
        </h2>
        <div className="grid grid-cols-1 gap-0 border-t border-l border-border">
          {PACKAGES.map((pkg) => (
            <Link
              key={pkg.name}
              href={pkg.href}
              className="block border-r border-b border-border p-5 hover:bg-panel transition-colors no-underline"
            >
              <div className="font-mono text-sm text-text font-semibold mb-1">
                {pkg.name}
              </div>
              <div className="text-muted text-xs">{pkg.description}</div>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-mono text-sm font-semibold text-text uppercase tracking-wide mb-4">
          Quick Links
        </h2>
        <ul className="space-y-2 text-sm">
          <li>
            <Link href="/docs/quick-start" className="text-primary hover:underline">
              Quick Start Guide &rarr;
            </Link>
          </li>
          <li>
            <a href="/#examples" className="text-primary hover:underline">
              Live Examples &rarr;
            </a>
          </li>
        </ul>
      </div>
    </>
  );
}
