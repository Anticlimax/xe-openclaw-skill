import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

let activeSession = null;

const plugin = {
  id: "xe-openclaw-skill",
  name: "Xiaoe OpenClaw Skill",
  description: "XiaoeTech browser automation helpers for login and smoke checks.",
  configSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      baseUrl: { type: "string" },
      loginUrl: { type: "string" },
      storageStatePath: { type: "string" },
      userDataDir: { type: "string" },
      headless: { type: "boolean" },
      loginTimeoutMs: { type: "number", minimum: 1000 },
      credentials: {
        type: "object",
        additionalProperties: false,
        properties: {
          username: { type: "string" },
          password: { type: "string" }
        }
      }
    }
  },
  register(api) {
    api.registerCommand({
      name: "xet",
      description: "Xiaoe helper commands: /xet login | /xet live create | /xet smoke",
      acceptsArgs: true,
      handler: async (ctx) => handleXetCommand({ api, argsText: ctx.args || "" })
    });
  }
};

async function runSmoke(api) {
  const stateDir = resolveStateDir(api);
  await fs.mkdir(stateDir, { recursive: true });
  const screenshotPath = path.join(stateDir, "xet-smoke.png");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
    const title = await page.title();
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return { text: `XET smoke ok. title=${title}\nscreenshot=${screenshotPath}` };
  } finally {
    await browser.close();
  }
}

async function runLogin(api) {
  const cfg = api.config || {};
  const baseUrl = cfg.baseUrl || "https://admin.xiaoe-tech.com";
  const loginUrl = cfg.loginUrl || `${baseUrl}/login`;
  const timeoutMs = Number.isFinite(cfg.loginTimeoutMs) ? cfg.loginTimeoutMs : 120000;
  const headless = cfg.headless === true;

  const stateDir = resolveStateDir(api);
  await fs.mkdir(stateDir, { recursive: true });
  const storageStatePath = cfg.storageStatePath || path.join(stateDir, "xet-storage-state.json");
  const userDataDir = cfg.userDataDir || path.join(stateDir, "xet-browser-profile");
  await fs.mkdir(userDataDir, { recursive: true });

  const session = await ensureActiveSession({ userDataDir, headless });
  const context = session.context;
  const page = session.page;

  try {
    await page.goto(loginUrl, { waitUntil: "domcontentloaded" });

    const username = cfg.credentials?.username;
    const password = cfg.credentials?.password;
    if (username && password) {
      await page.fill('input[name="username"]', username);
      await page.fill('input[name="password"]', password);
      await page.click('button[type="submit"]');
    }

    await page.waitForURL((url) => isMerchantLandingUrl(url), { timeout: timeoutMs });
    await context.storageState({ path: storageStatePath });

    return {
      text:
        "XET login completed. Session remains active for subsequent operations.\n" +
        `storageState=${storageStatePath}\n` +
        `userDataDir=${userDataDir}\n` +
        `headless=${headless}`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      text:
        "XET login guide timed out or failed.\n" +
        `url=${loginUrl}\n` +
        `error=${message}\n` +
        `userDataDir=${userDataDir}\n` +
        "Tip: session stays open for manual login; re-run /xet login after you complete auth."
    };
  }
}

async function runLiveCreate(api, rawArgs) {
  const input = parseCreateLiveArgs(rawArgs);
  return runLiveCreateWithInput(api, input);
}

async function runLiveCreateWithInput(api, input) {
  if (!activeSession?.page) {
    return { text: "XET session is not active. Please run /xet login first." };
  }

  if (!input.title || !input.start_time) {
    return {
      text:
        "Missing required args.\n" +
        "Usage: /xet live create --title \"直播标题\" --start \"2026-03-10 20:00\" [--desc \"简介\"]"
    };
  }

  const cfg = api.config || {};
  const page = activeSession.page;
  const baseUrl = cfg.baseUrl || "https://admin.xiaoe-tech.com";
  const createLiveUrl = cfg.createLiveUrl || `${baseUrl}/t/live/add`;
  await page.goto(createLiveUrl, { waitUntil: "domcontentloaded" });

  const titleFilled = await fillByCandidates(page, TITLE_CANDIDATES, input.title);
  const startFilled = await fillByCandidates(page, START_TIME_CANDIDATES, input.start_time);
  await fillByCandidates(page, DESCRIPTION_CANDIDATES, input.description);

  if (!titleFilled || !startFilled) {
    return {
      text:
        "Live page opened but required fields were not found.\n" +
        `url=${createLiveUrl}\n` +
        "Please update selectors in plugin code for your current Xiaoe UI."
    };
  }

  await clickFirstCandidate(page, PUBLISH_CANDIDATES);
  const liveUrl = await readFirstAttribute(page, LIVE_LINK_CANDIDATES, "href");
  const liveId = extractLiveId(liveUrl);

  return {
    text:
      "XET live create executed in active session.\n" +
      `title=${input.title}\n` +
      `start_time=${input.start_time}\n` +
      `live_id=${liveId}\n` +
      `live_url=${liveUrl || ""}`
  };
}

function resolveStateDir(api) {
  const byRuntime = api?.runtime?.state?.resolveStateDir?.();
  if (typeof byRuntime === "string" && byRuntime.trim()) {
    return byRuntime;
  }
  return path.resolve(process.cwd(), ".openclaw-state");
}

export default plugin;

export function isMerchantLandingUrl(url) {
  const href = String(url || "").toLowerCase();
  if (!href) return false;
  return href.includes("admin.xiaoe-tech.com/t/merchant/index");
}

export function parseCreateLiveArgs(rawArgs = []) {
  const parsed = {};
  const list = Array.isArray(rawArgs) ? rawArgs : [];
  for (let i = 0; i < list.length; i += 1) {
    const token = list[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2).toLowerCase();
    const value = list[i + 1] && !list[i + 1].startsWith("--") ? list[++i] : "";
    if (key === "title") parsed.title = value;
    if (key === "start") parsed.start_time = value;
    if (key === "desc") parsed.description = value;
  }
  return parsed;
}

export async function handleXetCommand({ api, argsText }) {
  const args = tokenizeArgs(argsText);
  const action = (args[0] || "help").toLowerCase();

  if (action === "smoke") {
    return await runSmoke(api);
  }

  if (action === "login") {
    return await runLogin(api);
  }

  if (action === "live" && (args[1] || "").toLowerCase() === "create") {
    return await runLiveCreate(api, args.slice(2));
  }

  if (action === "session") {
    const subAction = (args[1] || "status").toLowerCase();
    if (subAction === "close" || subAction === "logout") {
      await closeActiveSession();
      return { text: "XET session closed." };
    }
    return {
      text: activeSession
        ? `XET session is active.\nuserDataDir=${activeSession.userDataDir}\nstartedAt=${new Date(activeSession.startedAt).toISOString()}`
        : "XET session is not active."
    };
  }

  if (String(argsText || "").trim()) {
    return routeNaturalLanguage({ api, text: String(argsText || "") });
  }

  return {
    text:
      "Usage:\n" +
      "/xet login  - open Xiaoe admin login and save session state\n" +
      "/xet live create --title \"直播标题\" --start \"2026-03-10 20:00\" [--desc \"简介\"]\n" +
      "/xet smoke  - browser smoke check (open example.com + screenshot)\n" +
      "/xet session status|close - view/close the in-memory active browser session"
  };
}

function tokenizeArgs(input) {
  const text = String(input || "").trim();
  if (!text) return [];
  const tokens = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3]);
  }
  return tokens;
}

export async function routeNaturalLanguage({ api, text, resolveIntent, executeIntent }) {
  const resolver = resolveIntent || resolveIntentFromText;
  const executor = executeIntent || executeResolvedIntent;

  const intent = await resolver({ api, text });
  return executor({ api, intent });
}

export async function resolveIntentFromText({ api, text }) {
  const source = String(text || "").trim();
  if (!source) {
    return { intent: "unknown", reason: "empty_input" };
  }

  const runtimeResolver = api?.runtime?.intent?.resolve;
  if (typeof runtimeResolver !== "function") {
    return {
      intent: "unknown",
      reason: "intent_resolver_unavailable",
      raw: source
    };
  }

  try {
    const resolved = await runtimeResolver({
      task: "xet_intent_v1",
      text: source,
      schema: XET_INTENT_SCHEMA
    });
    return normalizeIntentResult(resolved, source);
  } catch (error) {
    return {
      intent: "unknown",
      reason: "intent_resolver_error",
      error: error instanceof Error ? error.message : String(error),
      raw: source
    };
  }
}

export async function executeResolvedIntent({ api, intent }) {
  const name = String(intent?.intent || "");
  if (name === "xet.login") {
    return runLogin(api);
  }

  if (name === "xet.live.create") {
    const input = {
      title: intent?.params?.title || "",
      start_time: intent?.params?.start_time || "",
      description: intent?.params?.description || ""
    };
    return runLiveCreateWithInput(api, input);
  }

  return {
    text:
      "Natural language is enabled but intent is unresolved.\n" +
      `intent=${name || "unknown"}\n` +
      `reason=${intent?.reason || "unsupported"}\n` +
      "Tip: use explicit command, e.g. /xet login or /xet live create --title \"...\" --start \"YYYY-MM-DD HH:mm\""
  };
}

function normalizeIntentResult(resolved, raw) {
  const intent = String(resolved?.intent || "").trim();
  if (intent === "xet.login") {
    return { intent, raw };
  }
  if (intent === "xet.live.create") {
    const params = {
      title: String(resolved?.params?.title || "").trim(),
      start_time: String(resolved?.params?.start_time || "").trim(),
      description: String(resolved?.params?.description || "").trim()
    };
    return { intent, params, raw };
  }
  return { intent: "unknown", reason: "unsupported_intent", raw };
}

const XET_INTENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: {
      type: "string",
      enum: ["xet.login", "xet.live.create", "unknown"]
    },
    params: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        start_time: { type: "string" },
        description: { type: "string" }
      }
    }
  },
  required: ["intent"]
};

function extractLiveId(liveUrl) {
  if (!liveUrl || typeof liveUrl !== "string") return "";
  const parts = liveUrl.split("/").filter(Boolean);
  return parts.at(-1) || "";
}

const TITLE_CANDIDATES = [
  'input[name="title"]',
  '[data-testid="live-title"] input',
  'input[placeholder*="标题"]'
];
const START_TIME_CANDIDATES = [
  'input[name="start_time"]',
  '[data-testid="live-start-time"] input',
  'input[placeholder*="开始"]'
];
const DESCRIPTION_CANDIDATES = [
  'textarea[name="description"]',
  '[data-testid="live-description"] textarea',
  'textarea[placeholder*="简介"]'
];
const PUBLISH_CANDIDATES = [
  '[data-testid="publish-live"]',
  'button:has-text("发布")',
  'button:has-text("创建直播")'
];
const LIVE_LINK_CANDIDATES = [
  '[data-testid="live-link"]',
  'a[href*="/live/"]'
];

async function fillByCandidates(page, candidates, value) {
  if (!value || typeof value !== "string" || value.trim().length === 0) return false;
  for (const selector of candidates) {
    try {
      const locator = page.locator(selector).first();
      if ((await locator.count()) > 0) {
        await locator.fill(value);
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

async function clickFirstCandidate(page, candidates) {
  for (const selector of candidates) {
    try {
      const locator = page.locator(selector).first();
      if ((await locator.count()) > 0) {
        await locator.click();
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

async function readFirstAttribute(page, candidates, attr) {
  for (const selector of candidates) {
    try {
      const locator = page.locator(selector).first();
      if ((await locator.count()) > 0) {
        return await locator.getAttribute(attr);
      }
    } catch {
      continue;
    }
  }
  return "";
}

async function ensureActiveSession({ userDataDir, headless }) {
  if (activeSession && activeSession.userDataDir === userDataDir) {
    try {
      const currentUrl = activeSession.page.url();
      if (typeof currentUrl === "string") {
        return activeSession;
      }
    } catch {
      await closeActiveSession();
    }
  } else if (activeSession) {
    await closeActiveSession();
  }

  const context = await chromium.launchPersistentContext(userDataDir, { headless });
  const page = context.pages()[0] || (await context.newPage());
  activeSession = { context, page, userDataDir, startedAt: Date.now() };
  return activeSession;
}

async function closeActiveSession() {
  if (!activeSession) return;
  try {
    await activeSession.context.close();
  } finally {
    activeSession = null;
  }
}

export function __setActiveSessionForTest(session) {
  activeSession = session;
}
