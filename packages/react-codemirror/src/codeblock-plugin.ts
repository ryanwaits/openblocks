import { syntaxTree } from "@codemirror/language";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import type { Extension } from "@codemirror/state";

const codeblockLine = Decoration.line({ class: "cm-codeblock-line" });
const codeblockStart = Decoration.line({
  class: "cm-codeblock-line cm-codeblock-start",
});
const codeblockEnd = Decoration.line({
  class: "cm-codeblock-line cm-codeblock-end",
});

function buildDecorations(view: EditorView): DecorationSet {
  const decorations: { from: number; deco: Decoration }[] = [];
  const tree = syntaxTree(view.state);

  tree.iterate({
    enter(node) {
      if (node.name === "FencedCode") {
        const doc = view.state.doc;
        const startLine = doc.lineAt(node.from).number;
        const endLine = doc.lineAt(node.to).number;

        for (let ln = startLine; ln <= endLine; ln++) {
          const lineStart = doc.line(ln).from;
          if (ln === startLine) {
            decorations.push({ from: lineStart, deco: codeblockStart });
          } else if (ln === endLine) {
            decorations.push({ from: lineStart, deco: codeblockEnd });
          } else {
            decorations.push({ from: lineStart, deco: codeblockLine });
          }
        }
      }
    },
  });

  // Decorations must be sorted by from position
  decorations.sort((a, b) => a.from - b.from);
  return Decoration.set(decorations.map((d) => d.deco.range(d.from)));
}

const codeblockViewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.startState.facet(EditorView.darkTheme) !== update.state.facet(EditorView.darkTheme)) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);

/**
 * Extension that adds block-level background styling to fenced code blocks.
 * Decorates lines inside ``` blocks with `.cm-codeblock-line`, `.cm-codeblock-start`,
 * and `.cm-codeblock-end` classes for rounded corners.
 */
export const codeblockPlugin: Extension = codeblockViewPlugin;
