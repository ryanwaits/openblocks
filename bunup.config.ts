import { defineWorkspace } from "bunup";

export default defineWorkspace(
  [
    { name: "@waits/openblocks-types", root: "packages/types" },
    { name: "@waits/openblocks-storage", root: "packages/storage" },
    { name: "@waits/openblocks-client", root: "packages/client" },
    { name: "@waits/openblocks-server", root: "packages/server" },
    { name: "@waits/openblocks-react", root: "packages/react" },
    { name: "@waits/openblocks-ui", root: "packages/ui" },
    { name: "@waits/openblocks-cli", root: "packages/cli" },
  ],
  {
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
  }
);
