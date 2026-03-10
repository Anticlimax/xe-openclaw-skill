import test from "node:test";
import assert from "node:assert/strict";
import { registerXetGatewayMethods } from "../../openclaw/index.js";

test("registerXetGatewayMethods registers trace methods", () => {
  const methods = new Map();
  registerXetGatewayMethods({
    registerGatewayMethod(name, handler) {
      methods.set(name, handler);
    }
  });

  assert.equal(methods.has("xet.trace.get"), true);
  assert.equal(methods.has("xet.trace.clear"), true);
});

test("xet.trace.get responds with trace payload", async () => {
  const methods = new Map();
  registerXetGatewayMethods({
    registerGatewayMethod(name, handler) {
      methods.set(name, handler);
    }
  });

  let response = null;
  const getHandler = methods.get("xet.trace.get");
  await getHandler({
    respond(ok, payload) {
      response = { ok, payload };
    }
  });

  assert.equal(response?.ok, true);
  assert.equal(typeof response?.payload?.count, "number");
  assert.equal(Array.isArray(response?.payload?.trace), true);
});
