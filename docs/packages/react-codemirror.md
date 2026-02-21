# @waits/openblocks-react-codemirror

Collaborative CodeMirror 6 editor integration for OpenBlocks. Provides a hook that wires Yjs sync, collaborative cursors, and language detection into a CodeMirror instance — plus a theme, floating toolbar, status bar, and code block styling.

```bash
npm install @waits/openblocks-react-codemirror @waits/openblocks-yjs @codemirror/state @codemirror/view @codemirror/language @codemirror/lang-markdown @codemirror/language-data
```

---

## Quick Start

```tsx
import {
  useOpenBlocksCodeMirror,
  typoraTheme,
  typoraHighlightStyle,
  FloatingToolbar,
  StatusBar,
  codeblockPlugin,
} from "@waits/openblocks-react-codemirror";
import { syntaxHighlighting } from "@codemirror/language";
import { lineNumbers } from "@codemirror/view";

function MarkdownEditor() {
  const { containerRef, viewRef, languageName } = useOpenBlocksCodeMirror({
    field: "source",
    extensions: [
      typoraTheme,
      syntaxHighlighting(typoraHighlightStyle),
      lineNumbers(),
      codeblockPlugin,
    ],
  });

  return (
    <div className="flex flex-col h-full">
      <FloatingToolbar viewRef={viewRef} />
      <div ref={containerRef} className="flex-1 overflow-auto" />
      <StatusBar viewRef={viewRef} languageName={languageName} />
    </div>
  );
}
```

---

## API Reference

### `useOpenBlocksCodeMirror`

```ts
function useOpenBlocksCodeMirror(
  options?: UseOpenBlocksCodeMirrorOptions
): {
  containerRef: RefObject<HTMLDivElement | null>;
  viewRef: RefObject<EditorView | null>;
  languageName: string;
};
```

Creates a collaborative CodeMirror editor backed by Yjs. Manages the `OpenBlocksYjsProvider` lifecycle internally (connect on mount, destroy on unmount). Strict-mode safe.

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `field` | `string` | `"source"` | Y.Text field name in the Y.Doc. Different fields create independent text buffers. |
| `user` | `{ name?: string; color?: string }` | -- | Override cursor display info. Omitted fields auto-source from server presence (`useSelf`). |
| `extensions` | `Extension[]` | `[]` | Additional CodeMirror extensions (theme, keymaps, etc.). |
| `filename` | `string` | -- | Filename used to auto-detect language mode (e.g., `"index.ts"` loads TypeScript). Falls back to markdown. |

#### Returns

| Property | Type | Description |
|----------|------|-------------|
| `containerRef` | `RefObject<HTMLDivElement>` | Attach to a `<div>` — CodeMirror mounts inside it. |
| `viewRef` | `RefObject<EditorView>` | Direct access to the CodeMirror `EditorView`. Pass to `FloatingToolbar` and `StatusBar`. |
| `languageName` | `string` | Detected language name (e.g., `"TypeScript"`, `"Markdown"`). Updates async after language loads. |

---

### `typoraTheme`

```ts
const typoraTheme: Extension;
```

Zed-inspired CodeMirror theme. Monospace font, line numbers with muted styling, active line highlight, collaborative cursor styling, and code block line decorations.

Key styles:
- Font: `13px JetBrains Mono` (falls back to `ui-monospace, monospace`)
- Line height: `24px`
- Active line: `#f4f4f5` background
- Gutter: white background, `#a1a1aa` line numbers, active line number bold `#1f2937`
- Selection: blue 15% opacity
- Collaborative cursors: `2px` border-left, name label above

---

### `typoraHighlightStyle`

```ts
const typoraHighlightStyle: HighlightStyle;
```

Syntax highlighting for markdown and code. Headings are larger/bolder. Code spans are purple with light background. Keywords are orange, strings green, types blue.

---

### `FloatingToolbar`

```tsx
<FloatingToolbar viewRef={viewRef} />
```

Markdown-aware selection toolbar. Appears above selected text and wraps/unwraps markdown syntax markers. Toggling works — if text is already wrapped in `**`, clicking Bold unwraps it.

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `viewRef` | `RefObject<EditorView>` | The CodeMirror view ref from `useOpenBlocksCodeMirror`. |

#### Actions

| Button | Markdown | Keyboard |
|--------|----------|----------|
| **B** (Bold) | `**text**` | -- |
| *I* (Italic) | `*text*` | -- |
| ~~S~~ (Strikethrough) | `~~text~~` | -- |
| `</>` (Code) | `` `text` `` | -- |

---

### `StatusBar`

```tsx
<StatusBar viewRef={viewRef} languageName={languageName} />
```

Bottom status bar showing cursor position, language, and online user count.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `viewRef` | `RefObject<EditorView>` | -- | The CodeMirror view ref. |
| `languageName` | `string` | `"Markdown"` | Language label. Pass `languageName` from `useOpenBlocksCodeMirror`. |

#### Displays

| Left | Right |
|------|-------|
| Online user count (green dot + N) | `line:col` cursor position |
| | Language name |

---

### `codeblockPlugin`

```ts
const codeblockPlugin: Extension;
```

Line decoration extension for fenced code blocks. Adds CSS classes to lines inside ` ``` ` blocks:

| Class | Applied to |
|-------|-----------|
| `cm-codeblock-line` | Every line inside a fenced code block. Light gray background + left border. |
| `cm-codeblock-start` | First line. Rounded top corners + top margin. |
| `cm-codeblock-end` | Last line. Rounded bottom corners + bottom margin. |

These classes are styled by `typoraTheme`. If using a custom theme, define these classes yourself.

---

## Real-World Use Cases

- [nextjs-markdown-editor](../examples/nextjs-markdown-editor) — Tabbed collaborative markdown editor with Typora-inspired styling
