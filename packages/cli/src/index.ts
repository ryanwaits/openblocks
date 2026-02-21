#!/usr/bin/env node
import { Command } from "commander";
import { devCommand } from "./commands/dev.js";
import { roomsCommand } from "./commands/rooms.js";

const program = new Command()
  .name("openblocks")
  .description("OpenBlocks — open-source real-time collaboration toolkit")
  .version("0.0.1");

program.addCommand(devCommand);
program.addCommand(roomsCommand);

program.parse(process.argv);
