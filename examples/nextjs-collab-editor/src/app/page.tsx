"use client";

import { useState } from "react";
import { OpenBlocksClient, LiveObject } from "@waits/openblocks-client";
import {
  OpenBlocksProvider,
  RoomProvider,
  ClientSideSuspense,
  useStorage,
  useMutation,
} from "@waits/openblocks-react";
import { AvatarStack, ConnectionBadge } from "@waits/openblocks-ui";
import { CollaborativeEditor } from "./editor";

const serverUrl =
  process.env.NEXT_PUBLIC_OPENBLOCKS_HOST || "http://localhost:2002";
const client = new OpenBlocksClient({ serverUrl, reconnect: true });

export default function EditorPage() {
  const [userId] = useState(() => crypto.randomUUID().slice(0, 8));
  const [displayName, setDisplayName] = useState("");
  const [joined, setJoined] = useState(false);

  if (!joined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-80 rounded-xl bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-semibold">Join the editor</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (displayName.trim()) setJoined(true);
            }}
          >
            <input
              className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={!displayName.trim()}
            >
              Join
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <OpenBlocksProvider client={client}>
      <RoomProvider
        roomId="editor-default"
        userId={userId}
        displayName={displayName}
        initialStorage={{
          title: new LiveObject({ text: "Untitled Document" }),
        }}
      >
        <ClientSideSuspense
          fallback={
            <div className="flex min-h-screen items-center justify-center">
              <p className="text-gray-400">Connecting...</p>
            </div>
          }
        >
          {() => <EditorLayout />}
        </ClientSideSuspense>
      </RoomProvider>
    </OpenBlocksProvider>
  );
}

function DocumentTitle() {
  const title = useStorage((root) => {
    const obj = root.get("title") as LiveObject<{ text: string }> | undefined;
    return obj?.get("text") ?? "Untitled Document";
  }) ?? "Untitled Document";

  const updateTitle = useMutation(({ storage }, text: string) => {
    const obj = storage.root.get("title") as LiveObject<{ text: string }>;
    obj.set("text", text);
  }, []);

  return (
    <input
      className="text-base font-semibold bg-transparent outline-none border-none focus:ring-0 w-48"
      value={title}
      onChange={(e) => updateTitle(e.target.value)}
      placeholder="Untitled Document"
    />
  );
}

function EditorLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[#E5E5E5] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DocumentTitle />
          <ConnectionBadge />
        </div>
        <div className="flex items-center gap-3">
          <AvatarStack max={5} showSelf />
        </div>
      </header>

      {/* Editor */}
      <main className="flex-1 flex flex-col items-center pt-4">
        <CollaborativeEditor />
      </main>
    </div>
  );
}
