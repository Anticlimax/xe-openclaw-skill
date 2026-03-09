import { V1_COMMANDS } from "./commands.js";
import { isValidCommand } from "./types.js";

export function loadCommands() {
  return [...V1_COMMANDS];
}

export function ensureCommand(command) {
  if (!isValidCommand(command)) {
    throw new Error(`Unknown command: ${command}`);
  }
  return command;
}
