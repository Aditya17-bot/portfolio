import { readFileSync } from "node:fs";
import { expect, test, type Locator } from "@playwright/test";

const meta = JSON.parse(readFileSync("public/models/dcgan-mnist/meta.json", "utf8"));

function ink(canvas: Locator) {
  return canvas.evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let bright = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 128) bright++;
    return { bright, total: d.length / 4, sum: Array.from(d).reduce((a, b) => a + b, 0) };
  });
}

test.describe("DCGAN page", () => {
  test("draws a grid of digits and a new one per seed", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/models/dcgan-mnist");
    const root = page.getByTestId("gan-playground");
    await expect(root).toHaveAttribute("data-ready", "true", { timeout: 50_000 });
    const grid = root.getByTestId("gan-grid");
    // Digits: some ink, mostly background, like MNIST (about 19% of pixels are bright).
    await expect.poll(async () => (await ink(grid)).bright, { timeout: 15_000 }).toBeGreaterThan(2000);
    const a = await ink(grid);
    expect(a.bright / a.total).toBeLessThan(0.4);
    await root.getByTestId("gan-new").click();
    await expect(root).toContainText("seed 2");
    await expect.poll(async () => (await ink(grid)).sum, { timeout: 15_000 }).not.toBe(a.sum);
    await expect.poll(async () => (await ink(root.getByTestId("gan-walk"))).bright, { timeout: 15_000 }).toBeGreaterThan(200);
    expect(errors).toEqual([]);
  });

  test("results come from meta.json and the log", async ({ page }) => {
    await page.goto("/models/dcgan-mnist");
    await expect(page.locator("table")).toContainText(`${meta.results.class_entropy_bits.toFixed(2)} bits`);
    const log = readFileSync("training/dcgan_mnist/log.csv", "utf8").trim().split(/\r?\n/);
    expect(log.length - 1).toBe(meta.config.epochs);
  });
});
