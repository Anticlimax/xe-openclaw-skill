import test from "node:test";
import assert from "node:assert/strict";
import { createLiveWithPlaywright } from "../../../src/adapters/xet/live.js";

function createMockRuntime() {
  const calls = [];

  const page = {
    async goto(url) { calls.push(["goto", url]); },
    async fill(selector, value) { calls.push(["fill", selector, value]); },
    async click(selector) { calls.push(["click", selector]); },
    async waitForURL(pattern) { calls.push(["waitForURL", String(pattern)]); },
    async waitForSelector(selector) { calls.push(["waitForSelector", selector]); },
    async getAttribute(selector, attr) {
      calls.push(["getAttribute", selector, attr]);
      return "https://xet.test/live/abc123";
    },
    async setInputFiles(selector, filePath) {
      calls.push(["setInputFiles", selector, filePath]);
    }
  };

  const context = {
    async newPage() {
      calls.push(["newPage"]);
      return page;
    },
    async close() {
      calls.push(["closeContext"]);
    }
  };

  const browser = {
    async newContext() {
      calls.push(["newContext"]);
      return context;
    },
    async close() {
      calls.push(["closeBrowser"]);
    }
  };

  const playwright = {
    chromium: {
      async launch(options) {
        calls.push(["launch", options.headless]);
        return browser;
      }
    }
  };

  return { calls, playwright };
}

test("createLiveWithPlaywright runs login + create flow and returns live url", async () => {
  const runtime = createMockRuntime();

  const result = await createLiveWithPlaywright(
    {
      title: "春季新品直播",
      start_time: "2026-03-12 20:00",
      description: "新品讲解",
      cover_image: "/tmp/cover.png"
    },
    {
      playwright: runtime.playwright,
      credentials: { username: "u", password: "p" },
      baseUrl: "https://admin.xiaoe-tech.com",
      headless: true
    }
  );

  assert.equal(result.live_url, "https://xet.test/live/abc123");
  assert.equal(result.live_id, "abc123");

  const actionNames = runtime.calls.map((x) => x[0]);
  assert.ok(actionNames.includes("launch"));
  assert.ok(actionNames.includes("fill"));
  assert.ok(actionNames.includes("click"));
  assert.ok(actionNames.includes("closeBrowser"));
});

test("createLiveWithPlaywright throws when credentials are missing", async () => {
  const runtime = createMockRuntime();

  await assert.rejects(
    () =>
      createLiveWithPlaywright(
        {
          title: "春季新品直播",
          start_time: "2026-03-12 20:00"
        },
        {
          playwright: runtime.playwright,
          baseUrl: "https://admin.xiaoe-tech.com"
        }
      ),
    /credentials/
  );
});
