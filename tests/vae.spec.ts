import { readFileSync } from "node:fs";
import { expect, test, type Locator } from "@playwright/test";

const meta = JSON.parse(readFileSync("public/models/vae-mnist/meta.json", "utf8"));

function pixels(canvas: Locator) {
  return canvas.evaluate((c: HTMLCanvasElement) => Array.from(c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data));
}

test.describe("VAE page", () => {
  test("dragging across the latent map decodes different digits", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/models/vae-mnist");
    const root = page.getByTestId("vae-explorer");
    await expect(root).toHaveAttribute("data-ready", "true", { timeout: 50_000 });
    const map = root.getByTestId("vae-map");
    const out = root.getByTestId("vae-output");
    await map.scrollIntoViewIfNeeded();
    const box = (await map.boundingBox())!;

    await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.2);
    await expect(root).not.toContainText("z = (0.00, 0.00)");
    await page.waitForTimeout(200);
    const a = await pixels(out);
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.75, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    const b = await pixels(out);
    const diff = a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0);
    expect(diff).toBeGreaterThan(10_000);
    // A decoded digit has ink: some bright pixels, mostly dark background.
    const bright = b.filter((v, i) => i % 4 === 0 && v > 128).length;
    expect(bright).toBeGreaterThan(20);
    expect(bright).toBeLessThan(500);
    expect(errors).toEqual([]);
  });

  test("drawing a digit encodes it onto the map", async ({ page }) => {
    await page.goto("/models/vae-mnist");
    const root = page.getByTestId("vae-explorer");
    await expect(root).toHaveAttribute("data-ready", "true", { timeout: 50_000 });
    const pad = root.getByTestId("draw-pad");
    await pad.scrollIntoViewIfNeeded();
    const box = (await pad.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.15);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.85, { steps: 12 });
    await page.mouse.up();
    await expect(root).not.toContainText("z = (0.00, 0.00)");
  });

  test("decoded grid view renders", async ({ page }) => {
    await page.goto("/models/vae-mnist");
    const root = page.getByTestId("vae-explorer");
    await expect(root).toHaveAttribute("data-ready", "true", { timeout: 50_000 });
    await root.getByRole("button", { name: "Decoded grid" }).click();
    const grid = root.locator("canvas[width='336']");
    await expect(grid).toBeVisible();
    await expect
      .poll(async () => (await pixels(grid)).filter((v, i) => i % 4 === 0 && v > 128).length, { timeout: 15_000 })
      .toBeGreaterThan(2000);
  });

  test("results match the training log", async ({ page }) => {
    await page.goto("/models/vae-mnist");
    const log = readFileSync("training/vae_mnist/log.csv", "utf8").trim().split(/\r?\n/);
    const cols = log[0].split(",");
    const last = log[log.length - 1].split(",");
    expect(Number(last[cols.indexOf("test_elbo")])).toBe(meta.results.test_elbo);
    await expect(page.locator("table")).toContainText(meta.results.test_elbo.toFixed(2));
  });
});
