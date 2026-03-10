import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

let activeSession = null;
const traceBuffer = [];
const TRACE_LIMIT = 200;
const promptByRunId = new Map();

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
      debugLogs: { type: "boolean" },
      forceXetToolRouting: { type: "boolean" },
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
    registerXetTools(api);
    registerXetGatewayMethods(api);
    if (typeof api?.on === "function") {
      api.on("llm_input", async (event) => {
        const runId = String(event?.runId || "");
        if (!runId) return;
        promptByRunId.set(runId, String(event?.prompt || ""));
      });
      api.on("before_tool_call", async (event, ctx) => {
        const runId = String(event?.runId || ctx?.runId || "");
        const promptText = runId ? promptByRunId.get(runId) : "";
        const forceRouting = api?.config?.forceXetToolRouting !== false;
        if (forceRouting && shouldBlockGenericToolForXet(event?.toolName, promptText)) {
          addTrace(api, "hook.before_tool_call.block_generic_for_xet", {
            toolName: event?.toolName || "",
            runId,
            promptHint: String(promptText || "").slice(0, 120)
          });
          return {
            block: true,
            blockReason:
              "Xiaoe tasks must use xet_router/xet_login/xet_live_create tools. Do not use generic tools."
          };
        }
        addTrace(api, "hook.before_tool_call", {
          toolName: event?.toolName || "",
          toolCallId: event?.toolCallId || "",
          runId: ctx?.runId || "",
          sessionId: ctx?.sessionId || ""
        });
      });
      api.on("after_tool_call", async (event, ctx) => {
        addTrace(api, "hook.after_tool_call", {
          toolName: event?.toolName || "",
          toolCallId: event?.toolCallId || "",
          ok: event?.success !== false,
          runId: ctx?.runId || "",
          sessionId: ctx?.sessionId || ""
        });
      });
      api.on("agent_end", async () => {
        if (promptByRunId.size > 1000) {
          promptByRunId.clear();
        }
      });
      api.on("before_prompt_build", async () => ({
        prependSystemContext: [
          "Tool-routing policy for Xiaoe:",
          "1) For ANY Xiaoe-related request, call tool `xet_router` first.",
          "2) Do NOT use exec/shell tools for Xiaoe login/live tasks.",
          "3) Do NOT ask user for Xiaoe account/password before attempting tool call.",
          "4) If required params missing for create_live, ask concise follow-up question.",
          "Chinese examples:",
          "- 用户: 帮我登录小鹅通后台 -> 调用 xet_router",
          "- 用户: 帮我创建直播，标题春季上新，开始时间2026-03-10 20:00 -> 调用 xet_router"
        ].join("\n")
      }));
    }
    api.registerCommand({
      name: "xet",
      description: "Xiaoe helper commands: /xet login | /xet live create | /xet smoke",
      acceptsArgs: true,
      handler: async (ctx) => handleXetCommand({ api, argsText: ctx.args || "" })
    });
  }
};

async function runSmoke(api) {
  const done = traceSpan(api, "runSmoke");
  const stateDir = resolveStateDir(api);
  await fs.mkdir(stateDir, { recursive: true });
  const screenshotPath = path.join(stateDir, "xet-smoke.png");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
    const title = await page.title();
    await page.screenshot({ path: screenshotPath, fullPage: true });
    done({ status: "ok", title, screenshotPath });
    return { text: `XET smoke ok. title=${title}\nscreenshot=${screenshotPath}` };
  } finally {
    await browser.close();
  }
}

async function runLogin(api) {
  const done = traceSpan(api, "runLogin");
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
  addTrace(api, "runLogin.config", {
    loginUrl,
    timeoutMs,
    headless,
    userDataDir
  });

  const session = await ensureActiveSession({ userDataDir, headless });
  const context = session.context;
  const page = session.page;

  try {
    addTrace(api, "runLogin.goto.start", { loginUrl });
    await page.goto(loginUrl, { waitUntil: "domcontentloaded" });
    addTrace(api, "runLogin.goto.done", { currentUrl: safePageUrl(page) });

    const username = cfg.credentials?.username;
    const password = cfg.credentials?.password;
    if (username && password) {
      await page.fill('input[name="username"]', username);
      await page.fill('input[name="password"]', password);
      await page.click('button[type="submit"]');
      addTrace(api, "runLogin.credentialSubmit", { hasUsername: !!username });
    }

    addTrace(api, "runLogin.waitForMerchant.start", { timeoutMs });
    await page.waitForURL((url) => isMerchantLandingUrl(url), { timeout: timeoutMs });
    addTrace(api, "runLogin.waitForMerchant.done", { currentUrl: safePageUrl(page) });
    await context.storageState({ path: storageStatePath });
    done({ status: "ok", storageStatePath, currentUrl: safePageUrl(page) });

    return {
      text:
        "XET login completed. Session remains active for subsequent operations.\n" +
        `storageState=${storageStatePath}\n` +
        `userDataDir=${userDataDir}\n` +
        `headless=${headless}\n` +
        `trace_hint=/xet trace`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    done({ status: "error", error: message, currentUrl: safePageUrl(page) });
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
  const done = traceSpan(api, "runLiveCreateWithInput");
  if (!activeSession?.page) {
    done({ status: "blocked", reason: "session_not_active" });
    return { text: "XET session is not active. Please run /xet login first." };
  }

  if (!input.title || !input.start_time) {
    done({ status: "blocked", reason: "missing_required_args" });
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
  addTrace(api, "runLiveCreate.goto.start", { createLiveUrl });
  await page.goto(createLiveUrl, { waitUntil: "domcontentloaded" });
  addTrace(api, "runLiveCreate.goto.done", { currentUrl: safePageUrl(page) });

  const titleFilled = await fillByCandidates(page, TITLE_CANDIDATES, input.title);
  const startFilled = await fillByCandidates(page, START_TIME_CANDIDATES, input.start_time);
  await fillByCandidates(page, DESCRIPTION_CANDIDATES, input.description);
  addTrace(api, "runLiveCreate.fill.done", { titleFilled, startFilled });

  if (!titleFilled || !startFilled) {
    done({ status: "error", reason: "selectors_not_found", createLiveUrl });
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
  done({ status: "ok", liveId, liveUrl: liveUrl || "" });

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
  const done = traceSpan(api, "handleXetCommand", { argsText: String(argsText || "") });
  const args = tokenizeArgs(argsText);
  const action = (args[0] || "help").toLowerCase();

  if (action === "smoke") {
    const result = await runSmoke(api);
    done({ action, status: "ok" });
    return result;
  }

  if (action === "login") {
    const result = await runLogin(api);
    done({ action, status: "ok" });
    return result;
  }

  if (action === "live" && (args[1] || "").toLowerCase() === "create") {
    const result = await runLiveCreate(api, args.slice(2));
    done({ action: "live.create", status: "ok" });
    return result;
  }

  if (action === "trace") {
    const subAction = (args[1] || "show").toLowerCase();
    if (subAction === "clear") {
      clearTrace();
      done({ action: "trace.clear", status: "ok" });
      return { text: "XET trace cleared." };
    }
    done({ action, status: "ok" });
    return { text: formatTraceText() };
  }

  if (action === "session") {
    const subAction = (args[1] || "status").toLowerCase();
    if (subAction === "close" || subAction === "logout") {
      await closeActiveSession();
      promptByRunId.clear();
      done({ action: "session.close", status: "ok" });
      return { text: "XET session closed." };
    }
    if (subAction === "trace") {
      done({ action: "session.trace", status: "ok" });
      return { text: formatTraceText() };
    }
    done({ action: "session.status", status: "ok" });
    return {
      text: activeSession
        ? `XET session is active.\nuserDataDir=${activeSession.userDataDir}\nstartedAt=${new Date(activeSession.startedAt).toISOString()}`
        : "XET session is not active."
    };
  }

  if (String(argsText || "").trim()) {
    const result = await routeNaturalLanguage({ api, text: String(argsText || "") });
    done({ action: "natural_language", status: "ok" });
    return result;
  }

  done({ action: "help", status: "ok" });
  return {
    text:
      "Usage:\n" +
      "/xet login  - open Xiaoe admin login and save session state\n" +
      "/xet live create --title \"直播标题\" --start \"2026-03-10 20:00\" [--desc \"简介\"]\n" +
      "/xet trace [clear] - show/clear recent plugin traces for diagnosis\n" +
      "/xet smoke  - browser smoke check (open example.com + screenshot)\n" +
      "/xet session status|close|trace - session state and traces"
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
  const done = traceSpan(api, "routeNaturalLanguage", { text });
  const resolver = resolveIntent || resolveIntentFromText;
  const executor = executeIntent || executeResolvedIntent;

  const intent = await resolver({ api, text });
  addTrace(api, "routeNaturalLanguage.intent", { intent: intent?.intent || "unknown" });
  const result = await executor({ api, intent });
  done({ status: "ok", resolvedIntent: intent?.intent || "unknown" });
  return result;
}

export async function resolveIntentFromText({ api, text }) {
  const done = traceSpan(api, "resolveIntentFromText");
  const source = String(text || "").trim();
  if (!source) {
    done({ status: "empty_input" });
    return { intent: "unknown", reason: "empty_input" };
  }

  const runtimeResolver = api?.runtime?.intent?.resolve;
  if (typeof runtimeResolver !== "function") {
    done({ status: "resolver_unavailable" });
    return {
      intent: "unknown",
      reason: "intent_resolver_unavailable",
      raw: source
    };
  }

  try {
    addTrace(api, "resolveIntentFromText.runtimeResolve.start", { task: "xet_intent_v1" });
    const resolved = await runtimeResolver({
      task: "xet_intent_v1",
      text: source,
      schema: XET_INTENT_SCHEMA
    });
    const normalized = normalizeIntentResult(resolved, source);
    done({ status: "ok", intent: normalized.intent });
    return normalized;
  } catch (error) {
    done({ status: "error", error: error instanceof Error ? error.message : String(error) });
    return {
      intent: "unknown",
      reason: "intent_resolver_error",
      error: error instanceof Error ? error.message : String(error),
      raw: source
    };
  }
}

export async function executeResolvedIntent({ api, intent }) {
  const done = traceSpan(api, "executeResolvedIntent", { intent: intent?.intent || "unknown" });
  const name = String(intent?.intent || "");
  if (name === "xet.login") {
    const result = await runLogin(api);
    done({ status: "ok" });
    return result;
  }

  if (name === "xet.live.create") {
    const input = {
      title: intent?.params?.title || "",
      start_time: intent?.params?.start_time || "",
      description: intent?.params?.description || ""
    };
    const result = await runLiveCreateWithInput(api, input);
    done({ status: "ok", hasTitle: !!input.title, hasStartTime: !!input.start_time });
    return result;
  }

  done({ status: "unsupported", reason: intent?.reason || "unsupported" });
  return {
    text:
      "Natural language is enabled but intent is unresolved.\n" +
      `intent=${name || "unknown"}\n` +
      `reason=${intent?.reason || "unsupported"}\n` +
      "Tip: use explicit command, e.g. /xet login or /xet live create --title \"...\" --start \"YYYY-MM-DD HH:mm\""
  };
}

export function registerXetTools(api) {
  if (typeof api?.registerTool !== "function") {
    return;
  }
  api.registerTool(createXetRouterTool(api));
  api.registerTool(createXetLoginTool(api));
  api.registerTool(createXetLiveCreateTool(api));
}

export function registerXetGatewayMethods(api) {
  if (typeof api?.registerGatewayMethod !== "function") {
    return;
  }
  api.registerGatewayMethod("xet.trace.get", ({ respond }) => {
    respond(true, {
      trace: getRecentTraceEntries(),
      count: traceBuffer.length
    });
  });
  api.registerGatewayMethod("xet.trace.clear", ({ respond }) => {
    clearTrace();
    respond(true, { ok: true });
  });
}

function createXetLoginTool(api) {
  return {
    name: "xet_login",
    label: "XET Login",
    description:
      "Open Xiaoe admin login flow and keep browser session active until merchant index page is reached.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {}
    },
    execute: async () => {
      const done = traceSpan(api, "tool.xet_login");
      const result = await runLogin(api);
      done({ status: /failed|timed out/i.test(String(result.text || "")) ? "error" : "ok" });
      return {
        content: [{ type: "text", text: result.text || "xet_login completed." }],
        details: { ok: !/failed|timed out/i.test(String(result.text || "")) }
      };
    }
  };
}

function createXetRouterTool(api) {
  return {
    name: "xet_router",
    label: "XET Router",
    description:
      "Route natural-language Xiaoe requests to the right action. Use this first for Xiaoe login/live tasks.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        text: { type: "string" }
      },
      required: ["text"]
    },
    execute: async (_toolCallId, params = {}) => {
      const done = traceSpan(api, "tool.xet_router");
      const text = String(params.text || "").trim();
      const result = await routeNaturalLanguage({ api, text });
      done({ status: "ok", hasText: !!text });
      return {
        content: [{ type: "text", text: result.text || "xet_router completed." }],
        details: { routed: true }
      };
    }
  };
}

function createXetLiveCreateTool(api) {
  return {
    name: "xet_live_create",
    label: "XET Live Create",
    description:
      "Create a Xiaoe live in current logged-in session. Requires title and start_time in format YYYY-MM-DD HH:mm.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        start_time: { type: "string" },
        description: { type: "string" }
      },
      required: ["title", "start_time"]
    },
    execute: async (_toolCallId, params = {}) => {
      const done = traceSpan(api, "tool.xet_live_create");
      const input = {
        title: String(params.title || "").trim(),
        start_time: String(params.start_time || "").trim(),
        description: String(params.description || "").trim()
      };
      const result = await runLiveCreateWithInput(api, input);
      done({
        status: /not active|missing required|not found/i.test(String(result.text || "")) ? "error" : "ok",
        hasTitle: !!input.title,
        hasStartTime: !!input.start_time
      });
      return {
        content: [{ type: "text", text: result.text || "xet_live_create completed." }],
        details: input
      };
    }
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
  const start = Date.now();
  if (activeSession && activeSession.userDataDir === userDataDir) {
    try {
      const currentUrl = activeSession.page.url();
      if (typeof currentUrl === "string") {
        addTrace(null, "ensureActiveSession.reuse", {
          userDataDir,
          elapsedMs: Date.now() - start,
          currentUrl
        });
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
  addTrace(null, "ensureActiveSession.new", {
    userDataDir,
    headless,
    elapsedMs: Date.now() - start
  });
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

function addTrace(api, event, details = {}) {
  const entry = {
    ts: new Date().toISOString(),
    event,
    details
  };
  traceBuffer.push(entry);
  if (traceBuffer.length > TRACE_LIMIT) {
    traceBuffer.splice(0, traceBuffer.length - TRACE_LIMIT);
  }

  const debugLogs = api?.config?.debugLogs === true;
  if (debugLogs && api?.logger && typeof api.logger.info === "function") {
    api.logger.info({ plugin: "xe-openclaw-skill", event, ...details }, "[xet-trace]");
  }
}

function traceSpan(api, event, seedDetails = {}) {
  const startedAt = Date.now();
  addTrace(api, `${event}.start`, seedDetails);
  return (endDetails = {}) => {
    addTrace(api, `${event}.end`, {
      elapsedMs: Date.now() - startedAt,
      ...endDetails
    });
  };
}

function formatTraceText(limit = 40) {
  const recent = getRecentTraceEntries(limit);
  if (recent.length === 0) {
    return "No traces yet.";
  }
  const lines = recent.map((item) => {
    const compactDetails = safeJson(item.details);
    return `${item.ts} | ${item.event} | ${compactDetails}`;
  });
  return ["Recent XET traces:", ...lines].join("\n");
}

function clearTrace() {
  traceBuffer.length = 0;
}

function getRecentTraceEntries(limit = 40) {
  return traceBuffer.slice(-Math.max(1, Number(limit) || 40));
}

export function shouldBlockGenericToolForXet(toolName, promptText) {
  const tool = String(toolName || "").toLowerCase();
  const isGeneric = ["exec", "read", "write", "grep", "glob", "ls", "bash", "shell"].includes(tool);
  if (!isGeneric) return false;
  const text = String(promptText || "").toLowerCase();
  if (!text) return false;
  const xet = /(小鹅通|xiaoe|xet)/.test(text);
  const action = /(登录|login|直播|live|店铺|后台|merchant)/.test(text);
  return xet && action;
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
}

function safePageUrl(page) {
  try {
    return page?.url?.() || "";
  } catch {
    return "";
  }
}
