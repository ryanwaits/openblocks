"use client";

import { useRef, useState } from "react";

export function CodeBlock({
  filename,
  children,
}: {
  filename?: string;
  children: React.ReactNode;
}) {
  const codeRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  function copy() {
    const text = codeRef.current?.innerText ?? "";
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="bg-code-bg border border-code-border overflow-hidden relative group">
      {filename && (
        <div className="px-4 py-2 border-b border-code-border bg-surface">
          <span className="font-mono text-[10px] text-muted">{filename}</span>
        </div>
      )}
      <div className="relative">
        <button
          onClick={copy}
          className="absolute top-2 right-2 p-1.5 bg-surface border border-code-border text-muted hover:text-text opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          aria-label="Copy code"
        >
          {copied ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
        <div
          ref={codeRef}
          className="p-4 font-mono text-sm leading-relaxed overflow-x-auto"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function Line({
  indent,
  children,
}: {
  indent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`${indent ? "pl-6" : ""} min-h-[1.5em]`}>{children}</div>
  );
}
