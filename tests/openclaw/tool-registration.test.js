import test from "node:test";
import assert from "node:assert/strict";
import {
  __setActiveSessionForTest,
  registerXetTools
} from "../../openclaw/index.js";

test("registerXetTools registers xet_router + xet_login + xet_live_create", () => {
  const tools = [];
  registerXetTools({
    registerTool(tool) {
      tools.push(tool);
    }
  });

  const names = tools.map((t) => t.name);
  assert.deepEqual(names, ["xet_router", "xet_login", "xet_live_create"]);
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

test("xet_router tool returns unresolved guidance when resolver is unavailable", async () => {
  const tools = [];
  registerXetTools({
    registerTool(tool) {
      tools.push(tool);
    },
    config: {}
  });

  const router = tools.find((t) => t.name === "xet_router");
  const result = await router.execute("call_1", { text: "帮我登录小鹅通后台" });
  const text = result?.content?.[0]?.text || "";
  assert.match(text, /intent is unresolved/i);
});
