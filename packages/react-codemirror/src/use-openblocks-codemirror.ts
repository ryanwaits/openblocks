import { useEffect, useRef, useState, type RefObject } from "react";
import { useRoom, useSelf } from "@waits/openblocks-react";
import { OpenBlocksYjsProvider } from "@waits/openblocks-yjs";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  ySync,
  ySyncFacet,
  YSyncConfig,
  yRemoteSelectionsTheme,
} from "y-codemirror.next";
import { yRemoteSelectionsFixed } from "./y-remote-selections.js";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { LanguageDescription } from "@codemirror/language";

function defaultMarkdown() {
  return markdown({ base: markdownLanguage, codeLanguages: languages });
}

export interface UseOpenBlocksCodeMirrorOptions {
  /** Y.Text field name in the Y.Doc. Defaults to "source". */
  field?: string;
  /** Cursor display info. Omitted fields auto-source from server presence. */
  user?: { name?: string; color?: string };
  /** Additional CodeMirror extensions. */
  extensions?: Extension[];
  /** Filename used to resolve language mode (e.g. "index.ts" → TypeScript). Falls back to markdown. */
  filename?: string;
}

export function useOpenBlocksCodeMirror(
  options?: UseOpenBlocksCodeMirrorOptions
): {
  containerRef: RefObject<HTMLDivElement | null>;
  viewRef: RefObject<EditorView | null>;
  languageName: string;
} {
  const room = useRoom();
  const self = useSelf();
  const field = options?.field ?? "source";
  const userName = options?.user?.name ?? self?.displayName ?? "Anonymous";
  const userColor = options?.user?.color ?? self?.color ?? "#999999";
  const filename = options?.filename;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const mountedRef = useRef(true);
  const providerRef = useRef<OpenBlocksYjsProvider | null>(null);
  const langCompartmentRef = useRef(new Compartment());

  const [languageName, setLanguageName] = useState("Markdown");

  // Create provider once — set awareness BEFORE connect()
  if (!providerRef.current) {
    providerRef.current = new OpenBlocksYjsProvider(room);
    providerRef.current.awareness.setLocalStateField("user", {
      name: userName,
      color: userColor,
    });
    providerRef.current.connect();
  }

  const provider = providerRef.current;

  // Update awareness on user change
  useEffect(() => {
    provider.awareness.setLocalStateField("user", {
      name: userName,
      color: userColor,
    });
  }, [provider, userName, userColor]);

  // Mount/rebuild EditorView when field or filename changes.
  // Provider stays stable — only the EditorView is recreated.
  useEffect(() => {
    mountedRef.current = true;

    // Destroy previous view if switching fields
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    if (containerRef.current) {
      const ytext = provider.doc.getText(field);
      const userExtensions = options?.extensions ?? [];

      // Reset language compartment for fresh view
      langCompartmentRef.current = new Compartment();

      const initialLang = defaultMarkdown();
      const state = EditorState.create({
        doc: ytext.toString(),
        extensions: [
          ...userExtensions,
          langCompartmentRef.current.of(initialLang),
          ySyncFacet.of(new YSyncConfig(ytext, provider.awareness)),
          ySync,
          yRemoteSelectionsTheme,
          yRemoteSelectionsFixed,
        ],
      });

      viewRef.current = new EditorView({
        state,
        parent: containerRef.current,
      });

      viewRef.current.focus();

      setLanguageName("Markdown");

      // Async-load the correct language if filename is set
      if (filename) {
        const desc = LanguageDescription.matchFilename(languages, filename);
        if (desc) {
          desc.load().then((langSupport) => {
            if (mountedRef.current && viewRef.current) {
              viewRef.current.dispatch({
                effects: langCompartmentRef.current.reconfigure(langSupport),
              });
              setLanguageName(desc.name);
            }
          });
        }
      }
    }

    return () => {
      mountedRef.current = false;
      const capturedView = viewRef.current;
      const capturedProvider = providerRef.current;

      setTimeout(() => {
        if (!mountedRef.current) {
          if (capturedView) {
            capturedView.destroy();
            if (viewRef.current === capturedView) {
              viewRef.current = null;
            }
          }
          if (capturedProvider) {
            capturedProvider.destroy();
            if (providerRef.current === capturedProvider) {
              providerRef.current = null;
            }
          }
        }
      }, 0);
    };
  }, [field, filename]); // eslint-disable-line react-hooks/exhaustive-deps

  return { containerRef, viewRef, languageName };
}
