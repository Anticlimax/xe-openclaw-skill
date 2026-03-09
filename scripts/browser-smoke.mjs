import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
const title = await page.title();
await page.screenshot({ path: 'output/playwright/smoke.png', fullPage: true });
console.log(`SMOKE_TITLE:${title}`);
console.log('SMOKE_SCREENSHOT:output/playwright/smoke.png');
await browser.close();
