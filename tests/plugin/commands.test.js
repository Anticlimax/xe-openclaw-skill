import test from "node:test";
import assert from "node:assert/strict";
import { loadCommands, ensureCommand } from "../../src/plugin/index.js";

test("loads all v1 commands", () => {
  const commands = loadCommands();
  assert.ok(commands.includes("xet.create_live"));
  assert.ok(commands.includes("wecom.mass_to_customer_groups"));
  assert.ok(commands.includes("wecom.mass_to_external_contacts"));
  assert.ok(commands.includes("campaign.run"));
  assert.ok(commands.includes("campaign.status"));
});

test("throws for unknown command", () => {
  assert.throws(() => ensureCommand("foo.bar"), /Unknown command/);
});
