import test from "node:test";
import assert from "node:assert/strict";
import { attachCommerceWithPlaywright } from "../../../src/adapters/xet/commerce.js";

function createRuntime() {
  const calls = [];

  const page = {
    async goto(url) { calls.push(["goto", url]); },
    async click(selector) { calls.push(["click", selector]); },
    async fill(selector, value) { calls.push(["fill", selector, value]); },
    async waitForSelector(selector) { calls.push(["waitForSelector", selector]); },
    async waitForURL(pattern) { calls.push(["waitForURL", String(pattern)]); }
  };

  const context = {
    async newPage() { calls.push(["newPage"]); return page; },
    async close() { calls.push(["closeContext"]); }
  };

  const browser = {
    async newContext() { calls.push(["newContext"]); return context; },
    async close() { calls.push(["closeBrowser"]); }
  };

  const playwright = {
    chromium: {
      async launch(options) { calls.push(["launch", options.headless]); return browser; }
    }
  };

  return { calls, playwright };
}

test("attachCommerceWithPlaywright attaches products and coupons", async () => {
  const runtime = createRuntime();

  const result = await attachCommerceWithPlaywright(
    {
      live_id: "xet_live_123",
      product_ids: ["p1", "p2"],
      coupon_ids: ["c1"]
    },
    {
      playwright: runtime.playwright,
      credentials: { username: "u", password: "p" },
      baseUrl: "https://admin.xiaoe-tech.com"
    }
  );

  assert.equal(result.products_attached, 2);
  assert.equal(result.coupons_attached, 1);

  const names = runtime.calls.map((x) => x[0]);
  assert.ok(names.includes("goto"));
  assert.ok(names.includes("click"));
  assert.ok(names.includes("closeBrowser"));
});
