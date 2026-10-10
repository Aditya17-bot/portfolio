// Screenshot every hero chapter at desktop and phone size: node scripts/shoot.mjs <outDir> [url]
import { chromium } from "@playwright/test";
const out = process.argv[2];
const url = process.argv[3] ?? "http://localhost:3000/";
const vps = [["desk", 1440, 900], ["phone", 390, 844]];
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
for (const [name, w, h] of vps) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(url);
  await page.waitForSelector("canvas", { timeout: 30000 });
  await page.waitForTimeout(2500);
  const ids = await page.$$eval("[data-chapter]", (els) => els.map((e) => e.dataset.chapter));
  for (const [i, id] of ids.entries()) {
    await page.$eval(`[data-chapter="${id}"]`, (el) => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(2400);
    await page.screenshot({ path: `${out}/${name}-${i}-${id}.png` });
  }
  console.log(name, "errors:", JSON.stringify(errs));
  await page.close();
}
await browser.close();
