import { CopyInstall } from "./copy-install";

export function Hero() {
  return (
    <header className="relative pt-32 pb-20 border-b border-border overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Left */}
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-border bg-panel/50 mb-8">
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
              v0.0.1 SDK Released
            </span>
          </div>

          <h1 className="hero-headline font-sans font-bold text-5xl md:text-7xl leading-[0.9] tracking-tighter text-text mb-6">
            COLLABORATE
            <br />
            <span className="text-muted">IN REALTIME</span>
            <br />
            <span className="text-text">BY DEFAULT.</span>
          </h1>

          <p className="font-body text-muted text-lg max-w-md leading-relaxed mb-8">
            The multiplayer infrastructure for the modern web. Add presence,
            cursor tracking, and state synchronization with a single hook.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <CopyInstall />
            <a
              href="/docs"
              className="border border-border text-text font-mono font-medium text-sm px-6 py-4 hover:border-muted transition-colors no-underline text-center"
            >
              Read the Docs
            </a>
          </div>
        </div>

        {/* Right — demo canvas */}
        <div className="relative w-full aspect-square md:aspect-[4/3] bg-panel border border-border p-1 group select-none">
          <div className="absolute top-4 left-4 flex gap-2 z-10">
            <div className="w-2 h-2 rounded-full bg-border" />
            <div className="w-2 h-2 rounded-full bg-border" />
          </div>

          <div className="w-full h-full bg-body relative overflow-hidden flex items-center justify-center">
            {/* Center shape */}
            <div className="text-center transition-transform duration-500 hover:scale-105">
              <div className="w-32 h-32 border border-border mx-auto mb-4 flex items-center justify-center">
                <div className="w-16 h-16 bg-panel border border-border" />
              </div>
              <div className="font-mono text-xs text-muted uppercase tracking-widest">
                Shared Canvas
              </div>
            </div>

            {/* Cursor 1 */}
            <div
              className="absolute top-1/4 left-1/4"
              style={{ animation: "cursorMove 8s infinite" }}
            >
              <CursorSvg color="var(--color-cursor-1)" />
              <div className="absolute left-4 top-4 bg-cursor-1 text-white text-[10px] font-bold px-1.5 py-0.5 whitespace-nowrap">
                Sarah_Dev
              </div>
            </div>

            {/* Cursor 2 */}
            <div
              className="absolute top-2/3 right-1/4"
              style={{
                animation: "cursorMove 8s infinite",
                animationDelay: "-2s",
                animationDirection: "reverse",
              }}
            >
              <CursorSvg color="var(--color-cursor-2)" />
              <div className="absolute left-4 top-4 bg-cursor-2 text-white text-[10px] font-bold px-1.5 py-0.5 whitespace-nowrap">
                Mike_Design
              </div>
            </div>

            {/* Dashed path */}
            <div className="absolute inset-0 pointer-events-none opacity-10">
              <svg className="w-full h-full">
                <path
                  d="M100,100 Q150,50 200,150 T300,200"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function CursorSvg({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19169L11.7841 12.3673H5.65376Z"
        fill={color}
        stroke={color}
      />
    </svg>
  );
}
