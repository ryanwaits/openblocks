"use client";

import { LivelyClient, LiveObject, LiveMap } from "@waits/lively-client";

const serverUrl =
  process.env.NEXT_PUBLIC_LIVELY_HOST || "http://localhost:1999";

export const client = new LivelyClient({ serverUrl, reconnect: true });

export function buildInitialStorage() {
  return {
    meta: new LiveObject({ name: "Untitled Workflow", status: "draft" }),
    nodes: new LiveMap<LiveObject>(),
    edges: new LiveMap<LiveObject>(),
  };
}
