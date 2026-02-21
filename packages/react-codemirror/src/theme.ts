import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { HighlightStyle } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

/**
 * Zed-inspired CodeMirror theme.
 *
 * Reference (exact values from Zed HTML mockup):
 *   Gutter:  w-[52px] pr-4 text-[#a1a1aa] text-right font-mono text-[13px] leading-6
 *   Content: font-mono text-[13px] leading-6, lines pl-2
 *   Active:  content bg-[#f4f4f5], gutter text-gray-800 font-medium
 *   Both:    py-3 (12px) top/bottom padding
 */
export const typoraTheme: Extension = EditorView.theme({
  // Root editor
  "&": {
    height: "100%",
    fontSize: "13px",
    fontFamily: "var(--ob-editor-font, 'JetBrains Mono', ui-monospace, monospace)",
  },
  "&.cm-focused": {
    outline: "none",
  },

  // Scroller fills height
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "inherit",
    fontSize: "13px",
    lineHeight: "24px",
  },

  // Content area: py-3 = 12px top/bottom
  ".cm-content": {
    padding: "12px 0",
    caretColor: "#333",
    color: "#333",
  },

  // Each line: pl-2 = 8px left padding
  ".cm-line": {
    lineHeight: "24px",
    padding: "0 0 0 8px",
  },

  // Gutter: white bg, no right border, matches py-3 via CM internal alignment
  ".cm-gutters": {
    backgroundColor: "white",
    borderRight: "none",
  },

  // Line numbers: w-[52px] pr-4(16px) text-right text-[#a1a1aa] text-[13px] leading-6
  ".cm-lineNumbers": {
    minWidth: "52px",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    color: "#a1a1aa",
    fontFamily: "inherit",
    fontSize: "13px",
    lineHeight: "24px",
    paddingRight: "16px",
    paddingLeft: "0",
    textAlign: "right",
  },

  // Active line gutter: text-gray-800 font-medium, bg stays white
  ".cm-lineNumbers .cm-activeLineGutter": {
    color: "#1f2937",
    fontWeight: "500",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "white !important",
  },

  // Active line content: bg-[#f4f4f5]
  ".cm-activeLine": {
    backgroundColor: "#f4f4f5",
  },

  // Cursor
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "#333",
    borderLeftWidth: "1.5px",
  },

  // Selection
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    background: "rgba(59, 130, 246, 0.15) !important",
  },

  // y-codemirror.next collaborative cursors
  ".cm-ySelectionCaret": {
    position: "relative",
    borderLeft: "2px solid",
    marginLeft: "-1px",
    marginRight: "-1px",
    wordBreak: "normal",
    pointerEvents: "none",
  },
  ".cm-ySelectionInfo": {
    position: "absolute",
    top: "-1.5em",
    left: "-1px",
    fontSize: "10px",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    fontWeight: "600",
    fontStyle: "normal",
    lineHeight: "1",
    color: "white",
    padding: "2px 5px",
    borderRadius: "3px 3px 3px 0",
    whiteSpace: "nowrap",
    userSelect: "none",
    pointerEvents: "none",
  },

  // Code block line decorations
  ".cm-codeblock-line": {
    backgroundColor: "#fafafa !important",
    borderLeft: "2px solid #e5e5e5",
  },
  ".cm-codeblock-start": {
    borderRadius: "4px 4px 0 0",
    marginTop: "4px",
    paddingTop: "4px",
  },
  ".cm-codeblock-end": {
    borderRadius: "0 0 4px 4px",
    marginBottom: "4px",
    paddingBottom: "4px",
  },
});

/**
 * Zed-inspired syntax highlight style for Markdown.
 */
export const typoraHighlightStyle: HighlightStyle = HighlightStyle.define([
  // Markdown tags
  { tag: t.heading1, fontSize: "1.5em", fontWeight: "700", lineHeight: "1.4" },
  { tag: t.heading2, fontSize: "1.25em", fontWeight: "600", lineHeight: "1.45" },
  { tag: t.heading3, fontSize: "1.1em", fontWeight: "600", lineHeight: "1.5" },
  { tag: t.processingInstruction, color: "#C2185B" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through", color: "#a1a1aa" },
  { tag: t.monospace, color: "#7C5CBF", backgroundColor: "#f5f3fa", borderRadius: "3px" },
  { tag: t.quote, color: "#059669" },
  { tag: t.link, color: "#2563EB" },
  { tag: t.url, color: "#a1a1aa" },
  { tag: t.meta, color: "#a1a1aa" },

  // Code-language tags (fenced blocks + non-markdown files)
  { tag: [t.keyword, t.operatorKeyword], color: "#ea5e23" },
  { tag: [t.string, t.special(t.string)], color: "#3f8538" },
  { tag: [t.propertyName, t.definition(t.variableName)], color: "#0b6bc7" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "#a1a1aa" },
  { tag: t.number, color: "#C2185B" },
  { tag: [t.typeName, t.className], color: "#0b6bc7" },
  { tag: [t.bool, t.null], color: "#ea5e23" },
]);
