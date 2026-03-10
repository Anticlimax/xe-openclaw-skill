import test from "node:test";
import assert from "node:assert/strict";
import { getXetSystemPrompt, handleXetCommand } from "../../openclaw/index.js";

test("xet prompt returns injected system prompt text", async () => {
  const result = await handleXetCommand({
    api: { config: {} },
    argsText: "prompt"
  });

  assert.match(result.text, /prependSystemContext chars=/i);
  assert.match(result.text, /xet_router/);
  assert.equal(result.text.includes(getXetSystemPrompt()), true);
});
