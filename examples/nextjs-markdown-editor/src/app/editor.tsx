"use client";

import { useEffect } from "react";
import {
  useLivelyCodeMirror,
  typoraTheme,
  typoraHighlightStyle,
  codeblockPlugin,
  FloatingToolbar,
  StatusBar,
} from "@waits/lively-react-codemirror";
import { syntaxHighlighting, indentOnInput, bracketMatching } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { indentWithTab, defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
} from "@codemirror/view";

export function MarkdownEditor({
  displayName,
  filename,
  field = "source",
  onLanguageChange,
}: {
  displayName: string;
  filename?: string;
  field?: string;
  onLanguageChange?: (name: string) => void;
}) {
  const { containerRef, viewRef, languageName } = useLivelyCodeMirror({
    field,
    user: { name: displayName },
    filename,
    extensions: [
      keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
      history(),
      closeBrackets(),
      bracketMatching(),
      indentOnInput(),
      typoraTheme,
      syntaxHighlighting(typoraHighlightStyle),
      codeblockPlugin,
      EditorView.lineWrapping,
      EditorState.tabSize.of(2),
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
    ],
  });

  useEffect(() => {
    onLanguageChange?.(languageName);
  }, [languageName, onLanguageChange]);

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      <div className="flex-1 overflow-auto" ref={containerRef} />
      {languageName === "Markdown" && <FloatingToolbar viewRef={viewRef} />}
      <StatusBar viewRef={viewRef} languageName={languageName} />
    </div>
  );
}
