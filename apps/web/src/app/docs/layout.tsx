"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  {
    heading: "Getting Started",
    links: [
      { href: "/docs", label: "Overview" },
      { href: "/docs/quick-start", label: "Quick Start" },
    ],
  },
  {
    heading: "Packages",
    links: [
      { href: "/docs/client", label: "Client" },
      { href: "/docs/react", label: "React" },
      { href: "/docs/server", label: "Server" },
      { href: "/docs/storage", label: "Storage" },
    ],
  },
];

function Sidebar({ pathname, onNav }: { pathname: string; onNav?: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <Link
        href="/"
        className="flex items-center gap-2 no-underline px-6 pt-6 pb-8"
        onClick={onNav}
      >
        <div className="w-3 h-3 bg-primary" />
        <span className="font-sans font-bold tracking-tight text-base text-text">
          LIVELY
        </span>
      </Link>

      <nav className="flex-1 px-4 space-y-6 overflow-y-auto">
        {NAV.map((section) => (
          <div key={section.heading}>
            <div className="px-2 mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">
              {section.heading}
            </div>
            <ul className="space-y-0.5">
              {section.links.map((link) => {
                const active = pathname === link.href;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={onNav}
                      className={`block px-3 py-1.5 text-sm no-underline transition-colors ${
                        active
                          ? "text-text font-semibold border-l-2 border-primary bg-panel"
                          : "text-muted hover:text-text border-l-2 border-transparent"
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-6 py-4 border-t border-border">
        <span className="font-mono text-[10px] text-muted">v0.0.1</span>
      </div>
    </div>
  );
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:block w-56 shrink-0 border-r border-border bg-body fixed top-0 left-0 h-screen">
        <Sidebar pathname={pathname} />
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 w-full z-50 bg-body/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 h-12">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <div className="w-3 h-3 bg-primary" />
            <span className="font-sans font-bold tracking-tight text-sm text-text">
              LIVELY
            </span>
          </Link>
          <button
            onClick={() => setOpen(!open)}
            className="p-1 text-muted hover:text-text"
            aria-label="Toggle navigation"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? (
                <path d="M18 6L6 18M6 6l12 12" />
              ) : (
                <path d="M3 12h18M3 6h18M3 18h18" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-12 bottom-0 w-64 bg-body border-r border-border">
            <Sidebar pathname={pathname} onNav={() => setOpen(false)} />
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 md:ml-56">
        <div className="max-w-3xl mx-auto px-6 py-16 md:py-12">
          {children}
        </div>
      </main>
    </div>
  );
}
