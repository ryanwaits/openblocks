import type { NextConfig } from "next";
import path from "path";

const yjsPath = path.resolve(process.cwd(), "node_modules/yjs");

const nextConfig: NextConfig = {
  // Force all yjs imports to resolve to a single instance.
  // Multiple workspace packages (lively-server, lively-yjs, y-prosemirror)
  // each import yjs independently, causing duplicate module initialization.
  // See: https://github.com/yjs/yjs/issues/438
  turbopack: {
    resolveAlias: {
      yjs: "./node_modules/yjs",
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      yjs: yjsPath,
    };
    return config;
  },
};

export default nextConfig;
