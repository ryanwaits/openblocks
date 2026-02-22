import { defineWorkspace } from "bunup";

export default defineWorkspace(
  [
    { name: "@waits/lively-types", root: "packages/types" },
    { name: "@waits/lively-storage", root: "packages/storage" },
    { name: "@waits/lively-client", root: "packages/client" },
    { name: "@waits/lively-server", root: "packages/server" },
    { name: "@waits/lively-react", root: "packages/react" },
    { name: "@waits/lively-yjs", root: "packages/yjs" },
    { name: "@waits/lively-react-tiptap", root: "packages/react-tiptap" },
    { name: "@waits/lively-react-codemirror", root: "packages/react-codemirror" },
    { name: "@waits/lively-ui", root: "packages/ui" },
    { name: "@waits/lively-cli", root: "packages/cli" },
  ],
  {
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
  }
);
