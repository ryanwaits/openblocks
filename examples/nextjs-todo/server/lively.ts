import { LivelyServer } from "@waits/lively-server";

const PORT = parseInt(process.env.LIVELY_PORT || "2001", 10);

const server = new LivelyServer({
  path: "/rooms",
  initialStorage: async (_roomId: string) => ({
    type: "LiveObject" as const,
    data: {
      todos: {
        type: "LiveList" as const,
        items: [],
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
