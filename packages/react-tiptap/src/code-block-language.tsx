import { useState, useCallback, useRef, useEffect, type JSX } from "react";
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from "@tiptap/react";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import type { Node } from "@tiptap/react";

// ── Language list ──

const LANGUAGES = [
  { value: "", label: "Plain text" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "jsx", label: "JSX" },
  { value: "tsx", label: "TSX" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
  { value: "python", label: "Python" },
  { value: "ruby", label: "Ruby" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "php", label: "PHP" },
  { value: "swift", label: "Swift" },
  { value: "kotlin", label: "Kotlin" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash" },
  { value: "shell", label: "Shell" },
  { value: "yaml", label: "YAML" },
  { value: "xml", label: "XML" },
  { value: "markdown", label: "Markdown" },
  { value: "graphql", label: "GraphQL" },
  { value: "dockerfile", label: "Dockerfile" },
  { value: "diff", label: "Diff" },
];

// ── NodeView ──

function CodeBlockView({
  node,
  updateAttributes,
  extension,
}: {
  node: any;
  updateAttributes: (attrs: Record<string, any>) => void;
  extension: any;
}): JSX.Element {
  const language = (node.attrs.language as string) ?? "";
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const label =
    LANGUAGES.find((l) => l.value === language)?.label ?? (language || "Plain text");

  const filtered = search
    ? LANGUAGES.filter((l) =>
        l.label.toLowerCase().includes(search.toLowerCase())
      )
    : LANGUAGES;

  const handleSelect = useCallback(
    (value: string) => {
      updateAttributes({ language: value });
      setOpen(false);
      setSearch("");
    },
    [updateAttributes]
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as HTMLElement)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <NodeViewWrapper className="ob-code-block-wrapper">
      <div className="ob-code-block-header" contentEditable={false}>
        <div className="ob-code-block-lang-picker" ref={dropdownRef}>
          <button
            type="button"
            className="ob-code-block-lang-btn"
            onClick={() => setOpen((v) => !v)}
          >
            {label}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {open && (
            <div className="ob-code-block-lang-dropdown">
              <input
                ref={inputRef}
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ob-code-block-lang-search"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setOpen(false);
                    setSearch("");
                  }
                  if (e.key === "Enter" && filtered.length > 0) {
                    handleSelect(filtered[0].value);
                  }
                }}
              />
              <div className="ob-code-block-lang-list">
                {filtered.map((lang) => (
                  <button
                    key={lang.value}
                    type="button"
                    className={`ob-code-block-lang-option${lang.value === language ? " ob-code-block-lang-option-active" : ""}`}
                    onClick={() => handleSelect(lang.value)}
                  >
                    {lang.label}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="ob-code-block-lang-empty">No match</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <pre>
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  );
}

// ── Extension factory ──

/**
 * Creates a CodeBlockLowlight extension with a language picker NodeView.
 * Pass the `lowlight` instance (from `lowlight` package) to enable highlighting.
 *
 * @example
 * ```ts
 * import { createCodeBlockExtension } from "@waits/lively-react-tiptap";
 * import { common, createLowlight } from "lowlight";
 * const lowlight = createLowlight(common);
 * const codeBlock = createCodeBlockExtension(lowlight);
 * ```
 */
export function createCodeBlockExtension(lowlight: any): Node {
  return CodeBlockLowlight.extend({
    addNodeView() {
      return ReactNodeViewRenderer(CodeBlockView);
    },
  }).configure({
    lowlight,
    defaultLanguage: null,
  }) as unknown as Node;
}
