export function Footer() {
  return (
    <footer className="border-t border-border bg-panel">
      {/* CTA */}
      <div className="max-w-7xl mx-auto px-6 py-24 text-center">
        <h2 className="font-sans font-bold text-5xl md:text-7xl text-text tracking-tighter mb-8">
          READY TO <span className="text-muted">BUILD?</span>
        </h2>
        <p className="text-muted text-lg mb-10 max-w-2xl mx-auto">
          Open-source real-time collaboration for the modern web. Start
          building with Lively in minutes.
        </p>

        <div className="flex flex-col items-center gap-6">
          <a
            href="/docs/quick-start"
            className="bg-accent text-accent-fg font-mono font-bold text-base px-10 py-5 hover:scale-105 transition-transform no-underline"
          >
            GET STARTED
          </a>
          <span className="text-muted text-xs font-mono">
            MIT LICENSED &middot; OPEN SOURCE
          </span>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border bg-body">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-primary" />
            <span className="font-sans font-bold text-text tracking-tight">
              LIVELY
            </span>
          </div>

          <div className="flex gap-8 text-sm text-muted">
            <a href="#" className="hover:text-text transition-colors no-underline">
              GitHub
            </a>
          </div>

          <div className="text-xs text-muted font-mono">
            &copy; {new Date().getFullYear()} Lively
          </div>
        </div>
      </div>
    </footer>
  );
}
