export const DEFAULT_XET_SELECTORS = {
  username: 'input[name="username"]',
  password: 'input[name="password"]',
  loginSubmit: 'button[type="submit"]',
  liveTitle: 'input[name="title"]',
  liveStartTime: 'input[name="start_time"]',
  liveDescription: 'textarea[name="description"]',
  liveCoverUpload: 'input[type="file"]',
  livePublish: '[data-testid="publish-live"]',
  liveLink: '[data-testid="live-link"]',
  addProductButton: '[data-testid="add-product"]',
  productSearchInput: '[data-testid="product-search-input"]',
  productSearchButton: '[data-testid="product-search-button"]',
  productItemByIdPrefix: '[data-testid="product-item-"]',
  addCouponButton: '[data-testid="add-coupon"]',
  couponSearchInput: '[data-testid="coupon-search-input"]',
  couponSearchButton: '[data-testid="coupon-search-button"]',
  couponItemByIdPrefix: '[data-testid="coupon-item-"]',
  commerceSaveButton: '[data-testid="commerce-save"]'
};

export function resolveXetSelectors(custom) {
  return { ...DEFAULT_XET_SELECTORS, ...(custom || {}) };
}

export function resolveXetUrls(runtime) {
  const baseUrl = runtime.baseUrl || "https://admin.xiaoe-tech.com";
  return {
    baseUrl,
    loginUrl: runtime.loginUrl || `${baseUrl}/login`
  };
}

async function tryAccess(filePath) {
  try {
    await import("node:fs/promises").then((fs) => fs.access(filePath));
    return true;
  } catch {
    return false;
  }
}

export function ensureRuntime(runtime) {
  if (!runtime || !runtime.playwright) {
    throw new Error("playwright runtime is required");
  }
  const hasCredentials = !!(
    runtime.credentials &&
    runtime.credentials.username &&
    runtime.credentials.password
  );
  const useGuide = runtime.loginGuide === true;
  if (!hasCredentials && !useGuide) {
    throw new Error("credentials are required");
  }
}

export async function launchLoggedInPage(runtime, selectors) {
  ensureRuntime(runtime);
  const { loginUrl } = resolveXetUrls(runtime);
  const headless = runtime.headless !== false;
  const usePersistentProfile = typeof runtime.userDataDir === "string" && runtime.userDataDir.trim().length > 0;
  let browser = null;
  let context = null;
  let page = null;

  if (usePersistentProfile) {
    context = await runtime.playwright.chromium.launchPersistentContext(runtime.userDataDir, { headless });
    page = context.pages()[0] || (await context.newPage());
  } else {
    browser = await runtime.playwright.chromium.launch({ headless });
    const contextOptions = {};
    if (runtime.storageStatePath && (await tryAccess(runtime.storageStatePath))) {
      contextOptions.storageState = runtime.storageStatePath;
    }
    context = await browser.newContext(contextOptions);
    page = await context.newPage();
  }

  await page.goto(loginUrl);
  const hasCredentials = !!(
    runtime.credentials &&
    runtime.credentials.username &&
    runtime.credentials.password
  );
  if (hasCredentials) {
    await page.fill(selectors.username, runtime.credentials.username);
    await page.fill(selectors.password, runtime.credentials.password);
    await page.click(selectors.loginSubmit);
  } else if (runtime.loginGuide && typeof runtime.onLoginGuide === "function") {
    await runtime.onLoginGuide(page);
  }
  await page.waitForURL(/dashboard|home|index/);

  return { browser, context, page };
}
