import Link from "next/link";

export function Nav() {
  return (
    <nav className="fixed top-0 w-full z-50 border-b border-border bg-body/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 no-underline">
          <div className="w-4 h-4 bg-primary" />
          <span className="font-sans font-bold tracking-tight text-lg text-text">
            LIVELY
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8 font-mono text-xs tracking-wide text-muted uppercase">
          <Link href="/docs" className="hover:text-text transition-colors no-underline">
            Documentation
          </Link>
          <a href="#examples" className="hover:text-text transition-colors no-underline">
            Examples
          </a>
        </div>

        <Link
          href="/docs/quick-start"
          className="bg-accent text-accent-fg text-xs font-bold font-mono px-4 py-2 hover:bg-text transition-colors duration-200 no-underline"
        >
          GET STARTED
        </Link>
      </div>
    </nav>
  );
}
