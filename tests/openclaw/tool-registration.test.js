import test from "node:test";
import assert from "node:assert/strict";
import {
  __setActiveSessionForTest,
  registerXetTools,
  shouldBlockExecForXetPrompt
} from "../../openclaw/index.js";

test("registerXetTools registers xet_login and xet_live_create", () => {
  const tools = [];
  registerXetTools({
    registerTool(tool) {
      tools.push(tool);
    }
  });

  const names = tools.map((t) => t.name);
  assert.deepEqual(names, ["xet_login", "xet_live_create"]);
});

test("xet_live_create tool requires an active session at execution", async () => {
  const tools = [];
  registerXetTools({
    registerTool(tool) {
      tools.push(tool);
    },
    config: {}
  });
  __setActiveSessionForTest(null);

  const liveCreate = tools.find((t) => t.name === "xet_live_create");
  const result = await liveCreate.execute("call_1", {
    title: "春季上新",
    start_time: "2026-03-10 20:00"
  });

  const text = result?.content?.[0]?.text || "";
  assert.match(text, /run \/xet login first/i);
});

test("shouldBlockExecForXetPrompt blocks exec on xet login/live prompts", () => {
  assert.equal(
    shouldBlockExecForXetPrompt("exec", "帮我登录小鹅通后台"),
    true
  );
  assert.equal(
    shouldBlockExecForXetPrompt("exec", "Create xet live for tonight"),
    true
  );
  assert.equal(
    shouldBlockExecForXetPrompt("exec", "帮我发一条普通消息"),
    false
  );
  assert.equal(
    shouldBlockExecForXetPrompt("xet_login", "帮我登录小鹅通后台"),
    false
  );
});
