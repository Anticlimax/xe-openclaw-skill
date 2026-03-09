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

export function ensureRuntime(runtime) {
  if (!runtime || !runtime.playwright) {
    throw new Error("playwright runtime is required");
  }
  if (!runtime.credentials || !runtime.credentials.username || !runtime.credentials.password) {
    throw new Error("credentials are required");
  }
}

export async function launchLoggedInPage(runtime, selectors) {
  ensureRuntime(runtime);
  const { loginUrl } = resolveXetUrls(runtime);

  const browser = await runtime.playwright.chromium.launch({
    headless: runtime.headless !== false
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(loginUrl);
  await page.fill(selectors.username, runtime.credentials.username);
  await page.fill(selectors.password, runtime.credentials.password);
  await page.click(selectors.loginSubmit);
  await page.waitForURL(/dashboard|home|index/);

  return { browser, context, page };
}
