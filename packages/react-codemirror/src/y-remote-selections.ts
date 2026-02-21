/**
 * Fixed remote selections plugin for y-codemirror.next.
 *
 * Upstream bug: both anchor and head use assoc=0 (right-associating),
 * so remote selections expand when another user types at the boundary.
 * Fix: head uses assoc=-1 when there's an active selection.
 */
import { Annotation, RangeSet, type Range } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { ySyncFacet } from "y-codemirror.next";
import * as Y from "yjs";

const yRemoteSelectionsAnnotation = Annotation.define<number[]>();

class YRemoteCaretWidget extends WidgetType {
  constructor(
    readonly color: string,
    readonly name: string
  ) {
    super();
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-ySelectionCaret";
    span.style.backgroundColor = this.color;
    span.style.borderColor = this.color;
    span.appendChild(document.createTextNode("\u2060"));
    const dot = document.createElement("div");
    dot.className = "cm-ySelectionCaretDot";
    span.appendChild(dot);
    span.appendChild(document.createTextNode("\u2060"));
    const info = document.createElement("div");
    info.className = "cm-ySelectionInfo";
    info.appendChild(document.createTextNode(this.name));
    span.appendChild(info);
    span.appendChild(document.createTextNode("\u2060"));
    return span;
  }

  eq(widget: YRemoteCaretWidget) {
    return widget.color === this.color;
  }

  get estimatedHeight() {
    return -1;
  }

  ignoreEvent() {
    return true;
  }
}

class YRemoteSelectionsPluginValue {
  decorations: DecorationSet = RangeSet.of([]);
  private conf = {} as ReturnType<typeof ySyncFacet["__"]>;
  private _awareness: Y.Awareness;
  private _listener: (...args: any[]) => void;

  constructor(view: EditorView) {
    this.conf = (view.state.facet as any)(ySyncFacet);
    this._awareness = this.conf.awareness;
    this._listener = ({ added, updated, removed }: any) => {
      const clients = (added as number[])
        .concat(updated as number[])
        .concat(removed as number[]);
      if (
        clients.findIndex(
          (id: number) => id !== this.conf.awareness.doc!.clientID
        ) >= 0
      ) {
        view.dispatch({
          annotations: [yRemoteSelectionsAnnotation.of([])],
        });
      }
    };
    this._awareness.on("change", this._listener);
  }

  destroy() {
    this._awareness.off("change", this._listener);
  }

  update(update: ViewUpdate) {
    const ytext = this.conf.ytext;
    const ydoc = ytext.doc!;
    const awareness = this.conf.awareness;
    const decorations: Range<Decoration>[] = [];
    const localAwarenessState = awareness.getLocalState();

    // Set local awareness state (cursor/selection)
    if (localAwarenessState != null) {
      const hasFocus =
        update.view.hasFocus &&
        update.view.dom.ownerDocument.hasFocus();
      const sel = hasFocus ? update.state.selection.main : null;
      const currentAnchor =
        localAwarenessState.cursor == null
          ? null
          : Y.createRelativePositionFromJSON(
              localAwarenessState.cursor.anchor
            );
      const currentHead =
        localAwarenessState.cursor == null
          ? null
          : Y.createRelativePositionFromJSON(
              localAwarenessState.cursor.head
            );

      if (sel != null) {
        // FIX: For a real selection, the rightmost boundary uses assoc=-1
        // (left-associating) so it doesn't expand when another user inserts
        // at that edge. The leftmost boundary uses assoc=0 (right-associating)
        // so it stays put. For a plain cursor, both use assoc=0.
        let anchorAssoc = 0;
        let headAssoc = 0;
        if (sel.anchor !== sel.head) {
          // whichever is the right boundary gets -1
          if (sel.anchor > sel.head) {
            anchorAssoc = -1;
          } else {
            headAssoc = -1;
          }
        }
        const anchor = Y.createRelativePositionFromTypeIndex(
          ytext,
          sel.anchor,
          anchorAssoc
        );
        const head = Y.createRelativePositionFromTypeIndex(
          ytext,
          sel.head,
          headAssoc
        );
        if (
          localAwarenessState.cursor == null ||
          !Y.compareRelativePositions(currentAnchor, anchor) ||
          !Y.compareRelativePositions(currentHead, head)
        ) {
          awareness.setLocalStateField("cursor", { anchor, head });
        }
      } else if (localAwarenessState.cursor != null && hasFocus) {
        awareness.setLocalStateField("cursor", null);
      }
    }

    // Render remote selections as decorations
    awareness.getStates().forEach((state, clientid) => {
      if (clientid === awareness.doc!.clientID) return;
      const cursor = state.cursor;
      if (cursor == null || cursor.anchor == null || cursor.head == null)
        return;
      const anchor = Y.createAbsolutePositionFromRelativePosition(
        Y.createRelativePositionFromJSON(cursor.anchor),
        ydoc
      );
      const head = Y.createAbsolutePositionFromRelativePosition(
        Y.createRelativePositionFromJSON(cursor.head),
        ydoc
      );
      if (
        anchor == null ||
        head == null ||
        anchor.type !== ytext ||
        head.type !== ytext
      )
        return;
      const { color = "#30bced", name = "Anonymous" } = state.user || {};
      const colorLight =
        (state.user && state.user.colorLight) || color + "33";
      const start = Math.min(anchor.index, head.index);
      const end = Math.max(anchor.index, head.index);
      const startLine = update.view.state.doc.lineAt(start);
      const endLine = update.view.state.doc.lineAt(end);

      if (startLine.number === endLine.number) {
        decorations.push({
          from: start,
          to: end,
          value: Decoration.mark({
            attributes: { style: `background-color: ${colorLight}` },
            class: "cm-ySelection",
          }),
        });
      } else {
        // First line
        decorations.push({
          from: start,
          to: startLine.from + startLine.length,
          value: Decoration.mark({
            attributes: { style: `background-color: ${colorLight}` },
            class: "cm-ySelection",
          }),
        });
        // Last line
        decorations.push({
          from: endLine.from,
          to: end,
          value: Decoration.mark({
            attributes: { style: `background-color: ${colorLight}` },
            class: "cm-ySelection",
          }),
        });
        // Middle lines
        for (let i = startLine.number + 1; i < endLine.number; i++) {
          const linePos = update.view.state.doc.line(i).from;
          decorations.push({
            from: linePos,
            to: linePos,
            value: Decoration.line({
              attributes: {
                style: `background-color: ${colorLight}`,
                class: "cm-yLineSelection",
              },
            }),
          });
        }
      }

      decorations.push({
        from: head.index,
        to: head.index,
        value: Decoration.widget({
          side: head.index - anchor.index > 0 ? -1 : 1,
          block: false,
          widget: new YRemoteCaretWidget(color, name),
        }),
      });
    });

    this.decorations = Decoration.set(decorations, true);
  }
}

export const yRemoteSelectionsFixed = ViewPlugin.fromClass(
  YRemoteSelectionsPluginValue,
  { decorations: (v) => v.decorations }
);
