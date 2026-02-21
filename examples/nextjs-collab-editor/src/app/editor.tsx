"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  useOpenBlocksExtension,
  Toolbar,
  FloatingToolbar,
} from "@waits/openblocks-react-tiptap";

export function CollaborativeEditor() {
  const openblocks = useOpenBlocksExtension();

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        undoRedo: false, // Yjs owns undo/redo
      }),
      openblocks,
      Placeholder.configure({
        placeholder: "Start writing...",
      }),
    ],
  });

  return (
    <>
      {/* Toolbar */}
      <div className="sticky top-0 z-10 flex justify-center py-2">
        <Toolbar editor={editor} />
      </div>

      {/* Canvas */}
      <div className="w-full max-w-[720px] mx-auto px-6 py-8">
        <EditorContent editor={editor} className="prose-editor" />
      </div>

      {/* Floating toolbar on selection */}
      <FloatingToolbar editor={editor} />
    </>
  );
}
