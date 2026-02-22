import { OpenBlocksServer } from "@waits/openblocks-server";
import {
  buildInitialStorage,
  createStorageChangeHandler,
  createLeaveHandler,
} from "./persistence";

const PORT = parseInt(process.env.PORT || process.env.OPENBLOCKS_PORT || "1999", 10);

// Handlers reference `server` via closure — assigned before start()
let storageChangeHandler: ReturnType<typeof createStorageChangeHandler>;
let leaveHandler: ReturnType<typeof createLeaveHandler>;

const server = new OpenBlocksServer({
  path: "/rooms",
  initialStorage: buildInitialStorage,
  onStorageChange: (roomId, ops) => storageChangeHandler(roomId, ops),
  onJoin: (roomId, user) => {
    console.log(`[openblocks] join: ${user.displayName} (${user.userId}) → room ${roomId}`);
  },
  onLeave: (roomId, user) => {
    console.log(`[openblocks] leave: ${user.displayName} (${user.userId}) ← room ${roomId}`);
    leaveHandler(roomId, user);
  },
});

// Now that server exists, create handlers with stable reference
storageChangeHandler = createStorageChangeHandler(server);
leaveHandler = createLeaveHandler(server);

await server.start(PORT);
console.log(`[openblocks] Server listening on :${server.port}`);
