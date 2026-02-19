"use client";

import { OpenBlocksClient, LiveObject, LiveMap } from "@waits/openblocks-client";

const serverUrl =
  process.env.NEXT_PUBLIC_OPENBLOCKS_HOST || "http://localhost:1999";

export const client = new OpenBlocksClient({ serverUrl, reconnect: true });

export function buildInitialStorage() {
  const defaultFrameId = crypto.randomUUID();
  return {
    objects: new LiveMap<LiveObject>(),
    frames: new LiveMap<LiveObject>([
      [
        defaultFrameId,
        new LiveObject({ id: defaultFrameId, index: 0, label: "Frame 1" }),
      ],
    ]),
  };
}
