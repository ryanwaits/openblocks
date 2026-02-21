# @waits/openblocks-react-tiptap

Collaborative TipTap editor integration for OpenBlocks. Provides a hook that wires Yjs sync, collaborative cursors, and undo/redo into TipTap — plus toolbar components, slash commands, and block-level extensions.

```bash
npm install @waits/openblocks-react-tiptap @waits/openblocks-yjs @tiptap/react @tiptap/starter-kit y-prosemirror
```

---

## Quick Start

```tsx
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  useOpenBlocksExtension,
  Toolbar,
  FloatingToolbar,
} from "@waits/openblocks-react-tiptap";

function CollabEditor() {
  const openblocks = useOpenBlocksExtension();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }), // disable built-in history — yjs handles it
      openblocks,
    ],
    editorProps: {
      attributes: { class: "prose max-w-none focus:outline-none" },
    },
  });

  return (
    <div>
      <Toolbar editor={editor} />
      <FloatingToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
```

> **Important:** Disable TipTap's built-in `history` extension. The OpenBlocks extension uses Yjs undo/redo instead.

### Cursor CSS

Add these styles to your `globals.css` for collaborative cursor carets:

```css
.collaboration-cursor__caret {
  border-left: 2px solid;
  border-color: inherit;
  margin-left: -1px;
  margin-right: -1px;
  pointer-events: none;
  position: relative;
  word-break: normal;
}

.collaboration-cursor__label {
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  left: -1px;
  line-height: 1;
  padding: 2px 6px;
  position: absolute;
  top: -1.4em;
  user-select: none;
  white-space: nowrap;
}
```

---

## Core API

### `useOpenBlocksExtension`

```ts
function useOpenBlocksExtension(
  options?: UseOpenBlocksExtensionOptions
): Extension;
```

Returns a TipTap `Extension` that bundles Yjs document sync (`ySyncPlugin`), collaborative cursors (`yCursorPlugin`), and Yjs undo/redo (`yUndoPlugin`). Manages the `OpenBlocksYjsProvider` lifecycle internally. Strict-mode safe.

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `field` | `string` | `"default"` | Y.XmlFragment field name in the Y.Doc. |
| `user` | `{ name?: string; color?: string }` | -- | Override cursor display info. Omitted fields auto-source from server presence (`useSelf().displayName` / `useSelf().color`). |

#### Keyboard Shortcuts

The extension registers these shortcuts automatically:

| Shortcut | Action |
|----------|--------|
| `Mod-z` | Yjs undo |
| `Mod-Shift-z` | Yjs redo |
| `Mod-y` | Yjs redo (Windows) |

---

### `yjsUndo` / `yjsRedo`

```ts
function yjsUndo(editor: { view: { state: any; dispatch: any } }): boolean;
function yjsRedo(editor: { view: { state: any; dispatch: any } }): boolean;
```

Call Yjs undo/redo directly on an editor view, bypassing the TipTap command chain. Useful for custom toolbar buttons:

```ts
<button onClick={() => { yjsUndo(editor); editor.commands.focus(); }}>Undo</button>
```

---

### `Toolbar`

```tsx
<Toolbar editor={editor} className="mb-2" />
```

Fixed toolbar with heading, inline formatting, block formatting, and history buttons.

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `editor` | `Editor \| null` | TipTap editor instance. Returns `null` if editor is null. |
| `className` | `string` | Additional CSS classes. |

#### Buttons

| Section | Buttons |
|---------|---------|
| Text type | Paragraph, Heading 1, Heading 2, Heading 3 |
| Inline | Bold, Italic, Strikethrough, Code |
| Block | Blockquote, Bullet List, Ordered List |
| History | Undo, Redo (calls `yjsUndo`/`yjsRedo`) |

Also exports `ToolbarButton` and `ToolbarDivider` for building custom toolbars.

---

### `FloatingToolbar`

```tsx
<FloatingToolbar editor={editor} />
```

Selection-triggered inline toolbar. Appears above selected text with formatting actions. Disappears on blur or when selection collapses.

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `editor` | `Editor \| null` | TipTap editor instance. |

#### Actions

| Button | Requires Extension | Keyboard |
|--------|-------------------|----------|
| Bold | Built-in | -- |
| Italic | Built-in | -- |
| Underline | `@tiptap/extension-underline` | -- |
| Strikethrough | Built-in | -- |
| Code | Built-in | -- |
| Highlight | `@tiptap/extension-highlight` | -- |
| Link | `@tiptap/extension-link` | `Cmd+K` |

Underline, Highlight, and Link buttons only render if the corresponding TipTap extension is registered. The toolbar auto-detects available extensions.

**Highlight** opens a color picker with 7 presets (yellow, red, blue, green, purple, orange, gray) and a remove option.

**Link** opens an inline URL input with Enter to apply and Escape to cancel.

---

## Extensions

### `createSlashCommandExtension`

```ts
function createSlashCommandExtension(items?: SlashMenuItem[]): Extension;
```

Creates a TipTap extension that shows a command menu when the user types `/`. Pass custom items or use the 13 built-in defaults.

#### `SlashMenuItem` Type

```ts
interface SlashMenuItem {
  title: string;
  description: string;
  icon: ReactNode;
  section?: string;        // Groups items under headers. Default: "Basic blocks"
  keywords?: string[];     // Additional search terms
  command: (editor: { chain: () => any }) => void;
}
```

#### Default Items (13)

| Section | Items |
|---------|-------|
| **Basic blocks** | Text, Heading 1, Heading 2, Heading 3, To-do List, Bullet List, Numbered List, Blockquote, Code Block, Divider |
| **Media** | Image |
| **Advanced** | Table, Callout |

#### Custom Items

```ts
const myItems: SlashMenuItem[] = [
  {
    title: "Alert",
    description: "Colored alert box",
    icon: <AlertIcon />,
    section: "Custom",
    keywords: ["warning", "notice"],
    command: ({ chain }) => chain().focus().setCallout({ type: "warning" }).run(),
  },
];

const slashCommand = createSlashCommandExtension(myItems);
```

Items are filtered by title and keywords as the user types after `/`. Arrow keys navigate, Enter selects, Escape closes.

---

### `BlockHandle`

```tsx
<BlockHandle editor={editor} />
```

Notion-style drag handle that appears on hover. Shows a 6-dot grip icon to the left of the hovered block. Click opens a context menu.

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `editor` | `Editor \| null` | TipTap editor instance. |

#### Context Menu Actions

| Action | Description |
|--------|-------------|
| Delete | Remove the block |
| Duplicate | Insert a copy below |
| Move up | Swap with previous sibling |
| Move down | Swap with next sibling |

The handle resolves block positions correctly for both top-level blocks and list items (resolves to individual `<li>` rather than the entire `<ul>`/`<ol>`).

---

### `Callout`

```ts
import { Callout } from "@waits/openblocks-react-tiptap";
```

Block-level callout node with type and emoji attributes.

#### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | `"info" \| "warning" \| "tip" \| "danger"` | `"info"` | Callout style. Stored as `data-callout-type`. |
| `emoji` | `string` | `"💡"` | Leading emoji. Stored as `data-callout-emoji`. |

#### Command

```ts
editor.chain().focus().setCallout({ type: "warning", emoji: "⚠️" }).run();
```

#### CSS Classes

| Class | Element |
|-------|---------|
| `ob-callout` | Outer `<div>` |
| `ob-callout-emoji` | Emoji `<span>` (non-editable) |
| `ob-callout-content` | Content `<div>` (editable) |

Style these in your CSS to differentiate callout types:

```css
.ob-callout[data-callout-type="info"] { background: #e7f3fe; border-left: 4px solid #2196f3; }
.ob-callout[data-callout-type="warning"] { background: #fff8e1; border-left: 4px solid #ff9800; }
.ob-callout[data-callout-type="tip"] { background: #e8f5e9; border-left: 4px solid #4caf50; }
.ob-callout[data-callout-type="danger"] { background: #fce4ec; border-left: 4px solid #f44336; }
```

---

### `ImagePlaceholder`

```ts
import { ImagePlaceholder } from "@waits/openblocks-react-tiptap";
```

Image node extension that renders a URL input placeholder when `src` is empty. Once a URL is entered, renders the image inline.

Replaces TipTap's default `Image` extension (uses `name: "image"`). Do not use both.

#### Attributes

| Attribute | Type | Default |
|-----------|------|---------|
| `src` | `string` | `""` |
| `alt` | `string \| null` | `null` |
| `title` | `string \| null` | `null` |

#### CSS Classes

| Class | Element |
|-------|---------|
| `ob-image` | `<img>` element when src is set |
| `ob-image-placeholder` | Placeholder `<div>` when src is empty |
| `ob-image-placeholder-input` | Input container inside placeholder |

---

### `createCodeBlockExtension`

```ts
function createCodeBlockExtension(lowlight: any): Node;
```

Creates a syntax-highlighted code block extension with a language picker dropdown. Extends `CodeBlockLowlight` from TipTap.

#### Setup

```ts
import { createCodeBlockExtension } from "@waits/openblocks-react-tiptap";
import { common, createLowlight } from "lowlight";

const lowlight = createLowlight(common);
const codeBlock = createCodeBlockExtension(lowlight);
```

#### Supported Languages (28)

Plain text, JavaScript, TypeScript, JSX, TSX, HTML, CSS, JSON, Python, Ruby, Go, Rust, Java, C, C++, C#, PHP, Swift, Kotlin, SQL, Bash, Shell, YAML, XML, Markdown, GraphQL, Dockerfile, Diff.

#### CSS Classes

| Class | Element |
|-------|---------|
| `ob-code-block-wrapper` | Outer `<div>` wrapper |
| `ob-code-block-header` | Header bar with language picker |
| `ob-code-block-lang-btn` | Language button |
| `ob-code-block-lang-dropdown` | Dropdown container |
| `ob-code-block-lang-search` | Search input |
| `ob-code-block-lang-list` | Scrollable list |
| `ob-code-block-lang-option` | Individual language option |
| `ob-code-block-lang-option-active` | Currently selected language |

---

## Full Export List

| Export | Type | Description |
|--------|------|-------------|
| `useOpenBlocksExtension` | Hook | Yjs-backed TipTap extension |
| `yjsUndo` | Function | Direct Yjs undo |
| `yjsRedo` | Function | Direct Yjs redo |
| `Toolbar` | Component | Fixed formatting toolbar |
| `ToolbarButton` | Component | Individual toolbar button |
| `ToolbarDivider` | Component | Visual separator |
| `FloatingToolbar` | Component | Selection-triggered toolbar |
| `createSlashCommandExtension` | Function | Slash command menu factory |
| `BlockHandle` | Component | Hover block handle + menu |
| `Callout` | Extension | Callout block node |
| `ImagePlaceholder` | Extension | Image with URL placeholder |
| `createCodeBlockExtension` | Function | Syntax-highlighted code blocks |

---

## Real-World Use Cases

- [nextjs-collab-editor](../examples/nextjs-collab-editor) — Rich text editor with toolbar, floating toolbar, and collaborative cursors
- [nextjs-notion-editor](../examples/nextjs-notion-editor) — Notion-style editor with slash commands, callouts, block handle, and code blocks
