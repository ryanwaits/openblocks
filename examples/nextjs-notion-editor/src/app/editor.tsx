"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TableKit } from "@tiptap/extension-table";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import { common, createLowlight } from "lowlight";
import {
  useLivelyExtension,
  FloatingToolbar,
  createSlashCommandExtension,
  createCodeBlockExtension,
  BlockHandle,
  Callout,
  ImagePlaceholder,
} from "@waits/lively-react-tiptap";

const lowlight = createLowlight(common);
const codeBlock = createCodeBlockExtension(lowlight);

const slashCommand = createSlashCommandExtension();

export function NotionEditor() {
  const lively = useLivelyExtension();

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        undoRedo: false,
        codeBlock: false,
      }),
      codeBlock,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      TableKit.configure({
        table: { resizable: true },
      }),
      Underline,
      Highlight.extend({ inclusive: false }).configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
      }),
      Callout,
      ImagePlaceholder,
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") {
            const level = node.attrs.level as number;
            return `Heading ${level}`;
          }
          return "Type '/' for commands...";
        },
      }),
      lively,
      slashCommand,
    ],
  });

  return (
    <div className="notion-editor">
      <EditorContent editor={editor} />
      <FloatingToolbar editor={editor} />
      <BlockHandle editor={editor} />
    </div>
  );
}
