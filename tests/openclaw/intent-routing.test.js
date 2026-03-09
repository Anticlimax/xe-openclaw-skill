import test from "node:test";
import assert from "node:assert/strict";
import {
  executeResolvedIntent,
  resolveIntentFromText,
  routeNaturalLanguage
} from "../../openclaw/index.js";

test("resolveIntentFromText returns unknown when runtime resolver is unavailable", async () => {
  const intent = await resolveIntentFromText({
    api: {},
    text: "帮我创建今晚八点直播"
  });

  assert.equal(intent.intent, "unknown");
  assert.equal(intent.reason, "intent_resolver_unavailable");
});

test("resolveIntentFromText normalizes xet.login intent", async () => {
  const intent = await resolveIntentFromText({
    api: {
      runtime: {
        intent: {
          resolve: async () => ({ intent: "xet.login" })
        }
      }
    },
    text: "登录小鹅通后台"
  });

  assert.equal(intent.intent, "xet.login");
});

test("resolveIntentFromText normalizes xet.live.create intent with params", async () => {
  const intent = await resolveIntentFromText({
    api: {
      runtime: {
        intent: {
          resolve: async () => ({
            intent: "xet.live.create",
            params: {
              title: "春季上新",
              start_time: "2026-03-10 20:00",
              description: "今晚主推爆品"
            }
          })
        }
      }
    },
    text: "帮我创建直播"
  });

  assert.equal(intent.intent, "xet.live.create");
  assert.equal(intent.params.title, "春季上新");
  assert.equal(intent.params.start_time, "2026-03-10 20:00");
});

test("executeResolvedIntent returns guidance for unknown intent", async () => {
  const result = await executeResolvedIntent({
    api: {},
    intent: { intent: "unknown", reason: "intent_resolver_unavailable" }
  });

  assert.match(result.text, /intent is unresolved/i);
});

test("routeNaturalLanguage composes resolver + executor", async () => {
  const result = await routeNaturalLanguage({
    api: {},
    text: "帮我创建直播",
    resolveIntent: async () => ({ intent: "xet.login" }),
    executeIntent: async ({ intent }) => ({ text: `intent=${intent.intent}` })
  });

  assert.equal(result.text, "intent=xet.login");
});
