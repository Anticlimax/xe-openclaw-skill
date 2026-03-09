import test from "node:test";
import assert from "node:assert/strict";
import {
  __setActiveSessionForTest,
  handleXetCommand,
  parseCreateLiveArgs
} from "../../openclaw/index.js";

function createMockPage() {
  const calls = [];
  const selectors = new Map();

  function setSelector(selector, impl) {
    selectors.set(selector, impl);
  }

  const page = {
    calls,
    setSelector,
    async goto(url) {
      calls.push(["goto", url]);
    },
    locator(selector) {
      const impl = selectors.get(selector) || {};
      return {
        first() {
          return {
            async count() {
              return impl.count ?? 0;
            },
            async fill(value) {
              calls.push(["fill", selector, value]);
            },
            async click() {
              calls.push(["click", selector]);
            },
            async getAttribute(attr) {
              calls.push(["getAttribute", selector, attr]);
              return impl.href || "";
            }
          };
        }
      };
    }
  };

  return page;
}

test("parseCreateLiveArgs parses required fields", () => {
  const parsed = parseCreateLiveArgs([
    "--title",
    "晚8点新品直播",
    "--start",
    "2026-03-10 20:00",
    "--desc",
    "福利专场"
  ]);

  assert.equal(parsed.title, "晚8点新品直播");
  assert.equal(parsed.start_time, "2026-03-10 20:00");
  assert.equal(parsed.description, "福利专场");
});

test("xet live create requires active session", async () => {
  __setActiveSessionForTest(null);

  const result = await handleXetCommand({
    api: { config: {} },
    argsText: 'live create --title "t" --start "2026-03-10 20:00"'
  });

  assert.match(result.text, /run \/xet login first/i);
});

test("xet live create runs on active session and returns live info", async () => {
  const page = createMockPage();
  page.setSelector('input[name="title"]', { count: 1 });
  page.setSelector('input[name="start_time"]', { count: 1 });
  page.setSelector('[data-testid="publish-live"]', { count: 1 });
  page.setSelector('[data-testid="live-link"]', {
    count: 1,
    href: "https://xet.test/live/live_001"
  });

  __setActiveSessionForTest({
    page,
    userDataDir: "/tmp/xet",
    startedAt: Date.now()
  });

  const result = await handleXetCommand({
    api: { config: { baseUrl: "https://admin.xiaoe-tech.com" } },
    argsText: 'live create --title 晚8点新品直播 --start "2026-03-10 20:00"'
  });

  assert.match(result.text, /XET live create executed/i);
  assert.match(result.text, /live_001/);
  assert.ok(page.calls.find((x) => x[0] === "goto"));
  assert.ok(page.calls.find((x) => x[0] === "fill"));

  __setActiveSessionForTest(null);
});
