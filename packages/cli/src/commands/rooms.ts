import { Command } from "commander";
import chalk from "chalk";
import { RoomPersistence } from "../persistence.js";
import type { SerializedCrdt } from "@waits/openblocks-types";

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function printCrdtTree(node: SerializedCrdt, indent = 0): void {
  const pad = "  ".repeat(indent);
  if (node.type === "LiveObject") {
    console.log(`${pad}${chalk.magenta("LiveObject")} {`);
    if (node.data && typeof node.data === "object") {
      for (const [key, value] of Object.entries(node.data)) {
        if (value && typeof value === "object" && "type" in value) {
          console.log(`${pad}  ${chalk.cyan(key)}:`);
          printCrdtTree(value as SerializedCrdt, indent + 2);
        } else {
          console.log(`${pad}  ${chalk.cyan(key)}: ${chalk.yellow(JSON.stringify(value))}`);
        }
      }
    }
    console.log(`${pad}}`);
  } else if (node.type === "LiveMap") {
    console.log(`${pad}${chalk.magenta("LiveMap")} {`);
    if (node.data && typeof node.data === "object") {
      for (const [key, value] of Object.entries(node.data)) {
        if (value && typeof value === "object" && "type" in value) {
          console.log(`${pad}  ${chalk.cyan(key)}:`);
          printCrdtTree(value as SerializedCrdt, indent + 2);
        } else {
          console.log(`${pad}  ${chalk.cyan(key)}: ${chalk.yellow(JSON.stringify(value))}`);
        }
      }
    }
    console.log(`${pad}}`);
  } else if (node.type === "LiveList") {
    console.log(`${pad}${chalk.magenta("LiveList")} [`);
    if (Array.isArray(node.data)) {
      for (let i = 0; i < node.data.length; i++) {
        const item = node.data[i];
        if (item && typeof item === "object" && "type" in item) {
          console.log(`${pad}  ${chalk.dim(`[${i}]`)}:`);
          printCrdtTree(item as SerializedCrdt, indent + 2);
        } else {
          console.log(`${pad}  ${chalk.dim(`[${i}]`)}: ${chalk.yellow(JSON.stringify(item))}`);
        }
      }
    }
    console.log(`${pad}]`);
  }
}

export const roomsCommand = new Command("rooms")
  .description("Manage persisted room data");

roomsCommand
  .command("list")
  .description("List all persisted rooms")
  .option("--data-dir <path>", "Data directory", ".openblocks")
  .action(async (opts) => {
    const persistence = new RoomPersistence(opts.dataDir);
    const rooms = await persistence.list();

    if (rooms.length === 0) {
      console.log(chalk.dim("No rooms found."));
      return;
    }

    // Header
    const idWidth = Math.max(8, ...rooms.map((r) => r.roomId.length)) + 2;
    console.log(
      chalk.bold("Room".padEnd(idWidth)) +
        chalk.bold("Updated".padEnd(14)) +
        chalk.bold("Size")
    );
    console.log(chalk.dim("─".repeat(idWidth + 14 + 10)));

    for (const room of rooms.sort((a, b) => b.updatedAt - a.updatedAt)) {
      console.log(
        chalk.cyan(room.roomId.padEnd(idWidth)) +
          chalk.dim(relativeTime(room.updatedAt).padEnd(14)) +
          formatBytes(room.sizeBytes)
      );
    }

    console.log(chalk.dim(`\n${rooms.length} room${rooms.length !== 1 ? "s" : ""}`));
  });

roomsCommand
  .command("clear [roomId]")
  .description("Clear persisted data (all rooms or a specific room)")
  .option("--data-dir <path>", "Data directory", ".openblocks")
  .action(async (roomId: string | undefined, opts) => {
    const persistence = new RoomPersistence(opts.dataDir);

    if (roomId) {
      if (!(await persistence.exists(roomId))) {
        console.log(chalk.red(`Room "${roomId}" not found.`));
        process.exit(1);
      }
      await persistence.delete(roomId);
      console.log(chalk.green(`Cleared room "${roomId}".`));
    } else {
      // Confirm before wiping all
      process.stdout.write(chalk.yellow("Clear all rooms? [y/N] "));
      const answer = await new Promise<string>((resolve) => {
        process.stdin.setEncoding("utf-8");
        process.stdin.once("data", (data) => resolve(data.toString().trim()));
        process.stdin.resume();
      });

      if (answer.toLowerCase() !== "y") {
        console.log(chalk.dim("Cancelled."));
        return;
      }
      await persistence.reset();
      console.log(chalk.green("All rooms cleared."));
    }
  });

roomsCommand
  .command("inspect <roomId>")
  .description("Inspect persisted storage for a room")
  .option("--data-dir <path>", "Data directory", ".openblocks")
  .action(async (roomId: string, opts) => {
    const persistence = new RoomPersistence(opts.dataDir);
    const root = await persistence.load(roomId);

    if (!root) {
      console.log(chalk.red(`Room "${roomId}" not found.`));
      process.exit(1);
    }

    console.log(chalk.bold(`Room: ${chalk.cyan(roomId)}\n`));
    printCrdtTree(root);
  });
