import { launchLoggedInPage, resolveXetSelectors, resolveXetUrls, ensureRuntime } from "./session.js";

function extractLiveId(liveUrl) {
  if (!liveUrl || typeof liveUrl !== "string") {
    return "";
  }
  const parts = liveUrl.split("/").filter(Boolean);
  return parts.at(-1) || "";
}

async function fillIfPresent(page, selector, value) {
  if (typeof value === "string" && value.trim().length > 0) {
    await page.fill(selector, value);
  }
}

export async function createLiveWithPlaywright(input, runtime) {
  ensureRuntime(runtime);
  const selectors = resolveXetSelectors(runtime.selectors);
  const { baseUrl } = resolveXetUrls(runtime);
  const createLiveUrl = runtime.createLiveUrl || `${baseUrl}/live/create`;

  const { browser, context, page } = await launchLoggedInPage(runtime, selectors);

  try {
    await page.goto(createLiveUrl);
    await fillIfPresent(page, selectors.liveTitle, input.title);
    await fillIfPresent(page, selectors.liveStartTime, input.start_time);
    await fillIfPresent(page, selectors.liveDescription, input.description);

    if (input.cover_image) {
      await page.setInputFiles(selectors.liveCoverUpload, input.cover_image);
    }

    await page.click(selectors.livePublish);
    await page.waitForSelector(selectors.liveLink);
    const liveUrl = await page.getAttribute(selectors.liveLink, "href");

    return {
      live_id: extractLiveId(liveUrl),
      live_url: liveUrl || ""
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

export async function createLive(input, runtime = {}) {
  if (runtime.playwright) {
    return createLiveWithPlaywright(input, runtime);
  }

  return {
    live_id: input.live_id || "xet_live_mock_001",
    live_url: input.live_url || "https://example.xet.com/live/xet_live_mock_001"
  };
}
