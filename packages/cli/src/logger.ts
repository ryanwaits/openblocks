import chalk from "chalk";

function timestamp(): string {
  return chalk.dim(new Date().toLocaleTimeString());
}

export function printBanner(port: number, dataDir: string): void {
  const url = `ws://localhost:${port}`;
  const lines = [
    "",
    chalk.bold("  OpenBlocks Dev Server"),
    "",
    `  ${chalk.dim("WebSocket")}    ${chalk.cyan(url)}`,
    `  ${chalk.dim("Rooms")}        ${chalk.cyan(`${url}/rooms/{roomId}`)}`,
    `  ${chalk.dim("Data dir")}     ${chalk.yellow(dataDir)}`,
    "",
    `  ${chalk.dim("Press")} ${chalk.bold("q")} ${chalk.dim("to quit,")} ${chalk.bold("c")} ${chalk.dim("to clear console")}`,
    "",
  ];
  console.log(lines.join("\n"));
}

export function logJoin(roomId: string, displayName: string): void {
  console.log(
    `${timestamp()} ${chalk.green("→")} ${chalk.bold(displayName)} joined ${chalk.cyan(roomId)}`
  );
}

export function logLeave(roomId: string, displayName: string): void {
  console.log(
    `${timestamp()} ${chalk.red("←")} ${chalk.bold(displayName)} left ${chalk.cyan(roomId)}`
  );
}

export function logStorageChange(roomId: string, opCount: number): void {
  console.log(
    `${timestamp()} ${chalk.yellow("●")} ${chalk.cyan(roomId)} ${chalk.dim(`${opCount} op${opCount !== 1 ? "s" : ""} → saved`)}`
  );
}

export function logRoomCreated(roomId: string): void {
  console.log(
    `${timestamp()} ${chalk.magenta("+")} Room ${chalk.cyan(roomId)} created`
  );
}
