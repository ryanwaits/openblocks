import { useEffect, useMemo, useRef } from "react";
import { useRoom, useSelf } from "@waits/openblocks-react";
import { OpenBlocksYjsProvider } from "@waits/openblocks-yjs";
import { Extension } from "@tiptap/react";
import {
  ySyncPlugin,
  yCursorPlugin,
  yUndoPlugin,
  undo as yUndo,
  redo as yRedo,
} from "y-prosemirror";

/** Call yjs undo directly on an editor view — bypasses Tiptap command chain. */
export function yjsUndo(editor: { view: { state: any; dispatch: any } }): boolean {
  return yUndo(editor.view.state, editor.view.dispatch);
}

/** Call yjs redo directly on an editor view — bypasses Tiptap command chain. */
export function yjsRedo(editor: { view: { state: any; dispatch: any } }): boolean {
  return yRedo(editor.view.state, editor.view.dispatch);
}

export interface UseOpenBlocksExtensionOptions {
  /** Name of the Y.XmlFragment field in the Y.Doc. Defaults to "default". */
  field?: string;
  /** Override cursor display info. Defaults to presence name + color from server. */
  user?: { name?: string; color?: string };
}

export function useOpenBlocksExtension(
  options?: UseOpenBlocksExtensionOptions
): Extension {
  const room = useRoom();
  const self = useSelf();
  const field = options?.field ?? "default";
  // Auto-source from presence, allow override
  const userName = options?.user?.name ?? self?.displayName;
  const userColor = options?.user?.color ?? self?.color;

  // Track mount state for strict-mode-safe cleanup (same pattern as RoomProvider)
  const mountedRef = useRef(true);
  const providerRef = useRef<OpenBlocksYjsProvider | null>(null);

  // Create provider once — persists through strict mode re-renders
  // Set awareness BEFORE connect() so user info is available during sync
  if (!providerRef.current) {
    providerRef.current = new OpenBlocksYjsProvider(room);
    providerRef.current.awareness.setLocalStateField("user", {
      name: userName ?? "Anonymous",
      color: userColor ?? "#999999",
    });
    providerRef.current.connect();
  }

  const provider = providerRef.current;

  // Update awareness if user info changes after initial creation
  useEffect(() => {
    provider.awareness.setLocalStateField("user", {
      name: userName ?? "Anonymous",
      color: userColor ?? "#999999",
    });
  }, [provider, userName, userColor]);

  // Deferred cleanup — allow strict mode remount to cancel destruction
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const capturedProvider = providerRef.current;
      setTimeout(() => {
        if (!mountedRef.current && capturedProvider) {
          capturedProvider.destroy();
          if (providerRef.current === capturedProvider) {
            providerRef.current = null;
          }
        }
      }, 0);
    };
  }, []);

  const extension = useMemo(() => {
    const fragment = provider.doc.getXmlFragment(field);

    return Extension.create({
      name: "openblocks",
      addKeyboardShortcuts() {
        return {
          "Mod-z": () => yUndo(this.editor.view.state, this.editor.view.dispatch),
          "Mod-Shift-z": () => yRedo(this.editor.view.state, this.editor.view.dispatch),
          "Mod-y": () => yRedo(this.editor.view.state, this.editor.view.dispatch),
        };
      },
      addProseMirrorPlugins() {
        return [
          ySyncPlugin(fragment),
          yCursorPlugin(provider.awareness),
          yUndoPlugin(),
        ];
      },
    });
  }, [provider, field]);

  return extension;
}
