const EXAMPLES = [
  {
    title: "Whiteboard",
    description: "Multi-user canvas with live cursors and shape editing.",
    href: "https://collab.waits.dev",
    animation: (
      <svg width="100%" height="100%" viewBox="0 0 200 120" fill="none">
        {/* Nested rectangles */}
        <rect x="50" y="20" width="100" height="80" rx="2" stroke="var(--color-border)" strokeWidth="1.5" />
        <rect x="65" y="35" width="70" height="50" rx="2" stroke="var(--color-border-hover)" strokeWidth="1.5" />
        <rect x="80" y="48" width="40" height="24" rx="2" fill="var(--color-primary)" opacity="0.15" stroke="var(--color-primary)" strokeWidth="1" />
        {/* Animated cursor */}
        <g style={{ animation: "cursorMove 8s infinite" }}>
          <path d="M30,30 L30,45 L37,40 Z" fill="var(--color-cursor-1)" />
          <rect x="38" y="38" width="28" height="10" rx="2" fill="var(--color-cursor-1)" />
          <text x="42" y="46" fontSize="6" fill="white" fontFamily="var(--font-mono)">Sarah</text>
        </g>
      </svg>
    ),
  },
  {
    title: "Collab Editor",
    description: "Real-time text editing with presence indicators.",
    href: "https://editor.waits.dev",
    animation: (
      <svg width="100%" height="100%" viewBox="0 0 200 120" fill="none">
        {/* Text lines */}
        <rect x="24" y="24" width="120" height="6" rx="1" fill="var(--color-border-hover)" />
        <rect x="24" y="38" width="90" height="6" rx="1" fill="var(--color-border-hover)" />
        <rect x="24" y="52" width="140" height="6" rx="1" fill="var(--color-border-hover)" />
        <rect x="24" y="66" width="70" height="6" rx="1" fill="var(--color-border-hover)" />
        <rect x="24" y="80" width="110" height="6" rx="1" fill="var(--color-border-hover)" />
        {/* Blinking cursor */}
        <rect x="114" y="50" width="2" height="10" fill="var(--color-primary)" style={{ animation: "blink 1s step-end infinite" }} />
        {/* Highlight bar */}
        <rect x="24" y="50" width="90" height="10" rx="1" fill="var(--color-cursor-2)" opacity="0.15" />
      </svg>
    ),
  },
  {
    title: "IDE",
    description: "Collaborative code editing with syntax awareness.",
    href: "https://ide.waits.dev",
    animation: (
      <svg width="100%" height="100%" viewBox="0 0 200 120" fill="none">
        {/* Line numbers */}
        <text x="16" y="32" fontSize="8" fill="var(--color-muted)" fontFamily="var(--font-mono)" opacity="0.5">1</text>
        <text x="16" y="46" fontSize="8" fill="var(--color-muted)" fontFamily="var(--font-mono)" opacity="0.5">2</text>
        <text x="16" y="60" fontSize="8" fill="var(--color-muted)" fontFamily="var(--font-mono)" opacity="0.5">3</text>
        <text x="16" y="74" fontSize="8" fill="var(--color-muted)" fontFamily="var(--font-mono)" opacity="0.5">4</text>
        <text x="16" y="88" fontSize="8" fill="var(--color-muted)" fontFamily="var(--font-mono)" opacity="0.5">5</text>
        {/* Syntax lines */}
        <text x="30" y="32" fontSize="8" fontFamily="var(--font-mono)">
          <tspan fill="var(--color-code-keyword)">const </tspan>
          <tspan fill="var(--color-text)">fn = </tspan>
          <tspan fill="var(--color-code-keyword)">()</tspan>
          <tspan fill="var(--color-text)"> =&gt; {"{"}</tspan>
        </text>
        <text x="38" y="46" fontSize="8" fontFamily="var(--font-mono)">
          <tspan fill="var(--color-code-keyword)">return </tspan>
          <tspan fill="var(--color-code-string)">&quot;hello&quot;</tspan>
        </text>
        <text x="30" y="60" fontSize="8" fontFamily="var(--font-mono)" fill="var(--color-text)">{"}"}</text>
        <text x="30" y="74" fontSize="8" fontFamily="var(--font-mono)">
          <tspan fill="var(--color-code-comment)"># export default</tspan>
        </text>
        <text x="30" y="88" fontSize="8" fontFamily="var(--font-mono)">
          <tspan fill="var(--color-code-func)">fn</tspan>
          <tspan fill="var(--color-text)">()</tspan>
        </text>
        {/* Typing cursor */}
        <rect x="95" y="40" width="1.5" height="10" fill="var(--color-primary)" style={{ animation: "blink 1s step-end infinite" }} />
      </svg>
    ),
  },
  {
    title: "Notion Editor",
    description: "Block-based editor with drag-and-drop collaboration.",
    href: "https://notion.waits.dev",
    animation: (
      <svg width="100%" height="100%" viewBox="0 0 200 120" fill="none">
        {/* Heading block */}
        <g style={{ animation: "blockSlide 3s ease-out infinite" }}>
          <rect x="24" y="16" width="152" height="22" rx="3" fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="1" />
          <rect x="30" y="22" width="80" height="6" rx="1" fill="var(--color-text)" opacity="0.6" />
          <text x="32" y="34" fontSize="5" fill="var(--color-muted)" fontFamily="var(--font-mono)">H1</text>
        </g>
        {/* Checkbox block */}
        <g style={{ animation: "blockSlide 3s ease-out infinite", animationDelay: "0.15s" }}>
          <rect x="24" y="44" width="152" height="22" rx="3" fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="1" />
          <rect x="30" y="50" width="10" height="10" rx="2" stroke="var(--color-primary)" strokeWidth="1.5" fill="none" />
          <rect x="46" y="53" width="60" height="5" rx="1" fill="var(--color-border-hover)" />
        </g>
        {/* Table block */}
        <g style={{ animation: "blockSlide 3s ease-out infinite", animationDelay: "0.3s" }}>
          <rect x="24" y="72" width="152" height="34" rx="3" fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="1" />
          <line x1="24" y1="84" x2="176" y2="84" stroke="var(--color-border)" strokeWidth="0.5" />
          <line x1="80" y1="72" x2="80" y2="106" stroke="var(--color-border)" strokeWidth="0.5" />
          <line x1="130" y1="72" x2="130" y2="106" stroke="var(--color-border)" strokeWidth="0.5" />
          <rect x="30" y="76" width="30" height="4" rx="1" fill="var(--color-border-hover)" />
          <rect x="86" y="76" width="25" height="4" rx="1" fill="var(--color-border-hover)" />
          <rect x="136" y="76" width="20" height="4" rx="1" fill="var(--color-border-hover)" />
        </g>
      </svg>
    ),
  },
  {
    title: "Todo",
    description: "Shared task lists with real-time checkbox sync.",
    href: "https://todo.waits.dev",
    animation: (
      <svg width="100%" height="100%" viewBox="0 0 200 120" fill="none">
        {/* Todo item 1 — checked */}
        <g style={{ animation: "checkOff 4s ease infinite" }}>
          <rect x="30" y="20" width="14" height="14" rx="3" stroke="var(--color-primary)" strokeWidth="1.5" fill="var(--color-primary)" opacity="0.9" />
          <path d="M33 27 L36 30 L41 24" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="52" y1="27" x2="140" y2="27" stroke="var(--color-muted)" strokeWidth="1" opacity="0.5" />
          <rect x="52" y="24" width="70" height="5" rx="1" fill="var(--color-muted)" opacity="0.3" />
        </g>
        {/* Todo item 2 — unchecked */}
        <rect x="30" y="46" width="14" height="14" rx="3" stroke="var(--color-border-hover)" strokeWidth="1.5" fill="none" />
        <rect x="52" y="50" width="90" height="5" rx="1" fill="var(--color-border-hover)" />
        {/* Todo item 3 — checking animation */}
        <g>
          <rect x="30" y="72" width="14" height="14" rx="3" stroke="var(--color-border-hover)" strokeWidth="1.5" fill="none" style={{ animation: "checkOff 4s ease infinite", animationDelay: "2s" }} />
          <rect x="52" y="76" width="60" height="5" rx="1" fill="var(--color-border-hover)" />
        </g>
        {/* Todo item 4 */}
        <rect x="30" y="98" width="14" height="14" rx="3" stroke="var(--color-border-hover)" strokeWidth="1.5" fill="none" />
        <rect x="52" y="102" width="80" height="5" rx="1" fill="var(--color-border-hover)" />
      </svg>
    ),
  },
  {
    title: "Workflows",
    description: "Connected node graphs with real-time state flow.",
    href: "https://workflows.waits.dev",
    animation: (
      <svg width="100%" height="100%" viewBox="0 0 200 120" fill="none">
        {/* Node 1 */}
        <rect x="16" y="40" width="44" height="28" rx="4" fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="1.5" />
        <rect x="22" y="48" width="20" height="4" rx="1" fill="var(--color-primary)" opacity="0.6" />
        <rect x="22" y="56" width="30" height="3" rx="1" fill="var(--color-border-hover)" />
        {/* Node 2 */}
        <rect x="80" y="20" width="44" height="28" rx="4" fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="1.5" />
        <rect x="86" y="28" width="20" height="4" rx="1" fill="var(--color-cursor-2)" opacity="0.6" />
        <rect x="86" y="36" width="30" height="3" rx="1" fill="var(--color-border-hover)" />
        {/* Node 3 */}
        <rect x="80" y="64" width="44" height="28" rx="4" fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="1.5" />
        <rect x="86" y="72" width="20" height="4" rx="1" fill="var(--color-code-string)" opacity="0.6" />
        <rect x="86" y="80" width="30" height="3" rx="1" fill="var(--color-border-hover)" />
        {/* Node 4 */}
        <rect x="144" y="40" width="44" height="28" rx="4" fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="1.5" />
        <rect x="150" y="48" width="20" height="4" rx="1" fill="var(--color-code-keyword)" opacity="0.6" />
        <rect x="150" y="56" width="30" height="3" rx="1" fill="var(--color-border-hover)" />
        {/* Connections with animated dashes */}
        <line x1="60" y1="54" x2="80" y2="34" stroke="var(--color-border-hover)" strokeWidth="1" strokeDasharray="4 3" style={{ animation: "flowPulse 2s linear infinite" }} />
        <line x1="60" y1="54" x2="80" y2="78" stroke="var(--color-border-hover)" strokeWidth="1" strokeDasharray="4 3" style={{ animation: "flowPulse 2s linear infinite", animationDelay: "0.3s" }} />
        <line x1="124" y1="34" x2="144" y2="54" stroke="var(--color-border-hover)" strokeWidth="1" strokeDasharray="4 3" style={{ animation: "flowPulse 2s linear infinite", animationDelay: "0.6s" }} />
        <line x1="124" y1="78" x2="144" y2="54" stroke="var(--color-border-hover)" strokeWidth="1" strokeDasharray="4 3" style={{ animation: "flowPulse 2s linear infinite", animationDelay: "0.9s" }} />
      </svg>
    ),
  },
];

function ExampleCard({
  title,
  description,
  href,
  animation,
}: {
  title: string;
  description: string;
  href: string;
  animation: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group border-r border-b border-border bg-body hover:bg-panel transition-colors relative overflow-hidden block no-underline"
    >
      <div className="h-40 bg-panel flex items-center justify-center overflow-hidden border-b border-border">
        {animation}
      </div>
      <div className="p-6">
        <h3 className="font-mono text-text text-sm font-semibold mb-1">
          {title}
        </h3>
        <p className="text-muted text-xs leading-relaxed mb-3">
          {description}
        </p>
        <span className="text-primary text-xs font-mono group-hover:underline">
          View demo &rarr;
        </span>
      </div>
    </a>
  );
}

export function Examples() {
  return (
    <section id="examples" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-16">
          <h2 className="font-sans text-3xl md:text-4xl font-semibold tracking-tight text-text mb-4">
            Examples
          </h2>
          <p className="text-muted max-w-xl text-lg">
            Interactive demos built with Lively. Click any card to see it live.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border-t border-l border-border">
          {EXAMPLES.map((ex) => (
            <ExampleCard key={ex.title} {...ex} />
          ))}
        </div>
      </div>
    </section>
  );
}
