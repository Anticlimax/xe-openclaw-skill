import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

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
      description: "Xiaoe helper commands: /xet login | /xet smoke",
      acceptsArgs: true,
      handler: async (ctx) => {
        const args = (ctx.args || "").trim().split(/\s+/).filter(Boolean);
        const action = (args[0] || "help").toLowerCase();

        if (action === "smoke") {
          return await runSmoke(api);
        }

        if (action === "login") {
          return await runLogin(api);
        }

        return {
          text:
            "Usage:\n" +
            "/xet login  - open Xiaoe admin login and save session state\n" +
            "/xet smoke  - browser smoke check (open example.com + screenshot)"
        };
      }
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

  const context = await chromium.launchPersistentContext(userDataDir, { headless });
  const page = context.pages()[0] || (await context.newPage());

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
        "XET login completed and session saved.\n" +
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
        "Tip: set plugin config headless=false and complete login manually in opened browser."
    };
  } finally {
    await context.close();
  }
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
