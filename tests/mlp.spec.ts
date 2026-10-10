import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";

const meta = JSON.parse(readFileSync("public/models/mlp/meta.json", "utf8"));
const log = readFileSync("training/mlp_numpy/log.csv", "utf8").trim().split(/\r?\n/);
const lastRow = Object.fromEntries(log[0].split(",").map((k: string, i: number) => [k, log[log.length - 1].split(",")[i]]));

/** Draw a polyline on the pad, in pad-relative coordinates 0..1. */
async function draw(page: Page, pad: Locator, pts: [number, number][]) {
  await pad.scrollIntoViewIfNeeded();
  const box = (await pad.boundingBox())!;
  const at = ([x, y]: [number, number]) => [box.x + x * box.width, box.y + y * box.height] as const;
  await page.mouse.move(...at(pts[0]));
  await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(...at(p), { steps: 6 });
  await page.mouse.up();
}

const circle = (cx: number, cy: number, rx: number, ry: number, n = 24): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => [cx + rx * Math.sin((2 * Math.PI * i) / n), cy - ry * Math.cos((2 * Math.PI * i) / n)]);

test.describe("MLP model page", () => {
  test("classifies MNIST test digits the way the label says", async ({ page }) => {
    await page.goto("/models/mlp-numpy");
    const button = page.getByRole("button", { name: "Use an MNIST test digit" });
    await expect(button).toBeEnabled();
    // The button steps through the samples 7 at a time; check a full lap of 10.
    let idx = 0;
    for (let k = 0; k < 10; k++) {
      await button.click();
      idx = (idx + 7) % meta.samples.count;
      await expect(page.getByTestId("prediction")).toHaveText(String(meta.samples.labels[idx]));
    }
  });

  test("reads hand-drawn digits", async ({ page }) => {
    await page.goto("/models/mlp-numpy");
    const pad = page.getByTestId("draw-pad");
    await expect(page.getByRole("button", { name: "Use an MNIST test digit" })).toBeEnabled();

    await draw(page, pad, [
      [0.52, 0.15],
      [0.5, 0.5],
      [0.48, 0.85],
    ]);
    await expect(page.getByTestId("prediction")).toHaveText("1");

    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByTestId("predictions")).toContainText("Waiting for a digit");

    await draw(page, pad, circle(0.5, 0.5, 0.22, 0.33));
    await expect(page.getByTestId("prediction")).toHaveText("0");

    await page.getByRole("button", { name: "Clear" }).click();
    await draw(page, pad, [
      [0.25, 0.18],
      [0.75, 0.18],
      [0.55, 0.5],
      [0.42, 0.85],
    ]);
    await expect(page.getByTestId("prediction")).toHaveText("7");
  });

  test("every result on the page matches the training log", async ({ page }) => {
    await page.goto("/models/mlp-numpy");
    const pct = (v: string) => `${(Number(v) * 100).toFixed(2)}%`;
    const table = page.locator("table");
    await expect(table).toContainText(pct(lastRow.test_acc));
    await expect(table).toContainText(Number(lastRow.test_loss).toFixed(4));
    await expect(table).toContainText(pct(lastRow.train_acc));
    await expect(table).toContainText(`epoch ${lastRow.epoch}`);
    expect(meta.results.test_acc).toBe(Number(lastRow.test_acc));
  });
});

test("drawing in the hero runs the network", async ({ page }) => {
  await page.goto("/");
  const chapter = page.locator("[data-chapter=input]");
  await chapter.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const pad = chapter.getByTestId("draw-pad");
  await expect(chapter.getByRole("button", { name: "MNIST sample" })).toBeEnabled();
  await draw(page, pad, [
    [0.52, 0.15],
    [0.5, 0.5],
    [0.48, 0.85],
  ]);
  await expect(chapter.getByTestId("prediction")).toHaveText("1");
});

test("models index links the live model and marks the rest planned", async ({ page }) => {
  await page.goto("/models");
  await page.getByRole("link", { name: /MLP in NumPy/ }).click();
  await expect(page).toHaveURL(/\/models\/mlp-numpy$/);
  await page.goto("/models");
  await expect(page.locator("[aria-disabled]").first()).toContainText("Planned");
});
