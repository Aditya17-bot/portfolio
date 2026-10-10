// Full-page screenshots of one route at desktop and phone size: node scripts/page-shot.mjs <outDir> <url> [name]
import { chromium } from "@playwright/test";
const [out, url, name = "page"] = process.argv.slice(2);
const browser = await chromium.launch();
for (const [vp, w, h] of [["desk", 1440, 900], ["phone", 390, 844]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(url);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${name}-${vp}.png`, fullPage: true });
  await page.close();
}
await browser.close();
