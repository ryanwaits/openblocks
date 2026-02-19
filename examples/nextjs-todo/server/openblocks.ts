import { OpenBlocksServer } from "@waits/openblocks-server";

const PORT = parseInt(process.env.OPENBLOCKS_PORT || "2001", 10);

const server = new OpenBlocksServer({
  path: "/rooms",
  initialStorage: async (_roomId: string) => ({
    type: "LiveObject" as const,
    data: {
      todos: {
        type: "LiveMap" as const,
        entries: {},
      },
    },
  }),
  onJoin: (roomId, user) => {
    console.log(`[todo] join: ${user.displayName} → room ${roomId}`);
  },
  onLeave: (roomId, user) => {
    console.log(`[todo] leave: ${user.displayName} ← room ${roomId}`);
  },
});

await server.start(PORT);
console.log(`[todo] Server listening on :${server.port}`);
