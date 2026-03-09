import { launchLoggedInPage, resolveXetSelectors, resolveXetUrls, ensureRuntime } from "./session.js";

function itemSelector(prefix, id) {
  return `${prefix}${id}"]`;
}

async function attachProducts(page, selectors, productIds) {
  let count = 0;
  for (const productId of productIds || []) {
    await page.click(selectors.addProductButton);
    await page.fill(selectors.productSearchInput, productId);
    await page.click(selectors.productSearchButton);
    await page.click(itemSelector(selectors.productItemByIdPrefix, productId));
    count += 1;
  }
  return count;
}

async function attachCoupons(page, selectors, couponIds) {
  let count = 0;
  for (const couponId of couponIds || []) {
    await page.click(selectors.addCouponButton);
    await page.fill(selectors.couponSearchInput, couponId);
    await page.click(selectors.couponSearchButton);
    await page.click(itemSelector(selectors.couponItemByIdPrefix, couponId));
    count += 1;
  }
  return count;
}

export async function attachCommerceWithPlaywright(input, runtime) {
  ensureRuntime(runtime);
  const selectors = resolveXetSelectors(runtime.selectors);
  const { baseUrl } = resolveXetUrls(runtime);
  const liveManageUrl = runtime.liveManageUrl || `${baseUrl}/live/${input.live_id}/manage`;

  const { browser, context, page } = await launchLoggedInPage(runtime, selectors);

  try {
    await page.goto(liveManageUrl);

    const productsAttached = await attachProducts(page, selectors, input.product_ids);
    const couponsAttached = await attachCoupons(page, selectors, input.coupon_ids);

    await page.click(selectors.commerceSaveButton);
    await page.waitForSelector(selectors.commerceSaveButton);

    return {
      live_id: input.live_id,
      products_attached: productsAttached,
      coupons_attached: couponsAttached,
      status: "success"
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

export async function attachCommerce(input, runtime = {}) {
  if (runtime.playwright) {
    return attachCommerceWithPlaywright(input, runtime);
  }

  return {
    live_id: input.live_id,
    products_attached: (input.product_ids || []).length,
    coupons_attached: (input.coupon_ids || []).length,
    status: "success"
  };
}
