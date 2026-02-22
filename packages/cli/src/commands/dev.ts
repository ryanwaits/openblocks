import { Command } from "commander";

export const devCommand = new Command("dev")
  .description("Start the Lively dev server")
  .option("-p, --port <number>", "WebSocket server port", "1999")
  .option("--data-dir <path>", "Directory for persisted room data", ".lively")
  .option("--reset", "Clear all persisted data before starting")
  .action(async (opts) => {
    const { startDevServer } = await import("./dev.action.js");
    await startDevServer({
      port: parseInt(opts.port, 10),
      dataDir: opts.dataDir,
      reset: opts.reset ?? false,
    });
  });
