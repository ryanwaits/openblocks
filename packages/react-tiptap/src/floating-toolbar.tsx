import { useEffect, useState, useCallback, useRef, type JSX } from "react";
import type { Editor } from "@tiptap/react";
import { ToolbarButton } from "./toolbar.js";

// Inline SVG icons (16x16)
const iconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconBold() {
  return (
    <svg {...iconProps}>
      <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
      <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
    </svg>
  );
}

function IconItalic() {
  return (
    <svg {...iconProps}>
      <line x1="19" y1="4" x2="10" y2="4" />
      <line x1="14" y1="20" x2="5" y2="20" />
      <line x1="15" y1="4" x2="9" y2="20" />
    </svg>
  );
}

function IconStrikethrough() {
  return (
    <svg {...iconProps}>
      <path d="M16 4H9a3 3 0 0 0-2.83 4" />
      <path d="M14 12a4 4 0 0 1 0 8H6" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </svg>
  );
}

function IconCode() {
  return (
    <svg {...iconProps}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

export interface FloatingToolbarProps {
  editor: Editor | null;
}

export function FloatingToolbar({ editor }: FloatingToolbarProps): JSX.Element | null {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!editor) return;

    const { from, to, empty } = editor.state.selection;
    if (empty || from === to) {
      setVisible(false);
      return;
    }

    const domSelection = window.getSelection();
    if (!domSelection || domSelection.rangeCount === 0) {
      setVisible(false);
      return;
    }

    const range = domSelection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) {
      setVisible(false);
      return;
    }

    const toolbarWidth = toolbarRef.current?.offsetWidth ?? 200;
    setPosition({
      top: rect.top + window.scrollY - 48,
      left: rect.left + window.scrollX + rect.width / 2 - toolbarWidth / 2,
    });
    setVisible(true);
  }, [editor]);

  const handleBlur = useCallback(() => setVisible(false), []);

  useEffect(() => {
    if (!editor) return;

    editor.on("selectionUpdate", updatePosition);
    editor.on("blur", handleBlur);

    return () => {
      editor.off("selectionUpdate", updatePosition);
      editor.off("blur", handleBlur);
    };
  }, [editor, updatePosition, handleBlur]);

  if (!editor || !visible) return null;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 transition-opacity duration-150"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="inline-flex items-center gap-0.5 bg-white shadow-lg rounded-lg border border-gray-200 p-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          title="Bold"
        >
          <IconBold />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          title="Italic"
        >
          <IconItalic />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive("strike")}
          title="Strikethrough"
        >
          <IconStrikethrough />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive("code")}
          title="Code"
        >
          <IconCode />
        </ToolbarButton>
      </div>
    </div>
  );
}
