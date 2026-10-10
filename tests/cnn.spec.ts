import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const meta = JSON.parse(readFileSync("public/models/mlp/meta.json", "utf8"));
const cnn = JSON.parse(readFileSync("public/models/cnn-mnist/meta.json", "utf8"));

test.describe("CNN model page", () => {
  test("runs the ONNX model in the browser on MNIST test digits", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/models/cnn-mnist");
    await expect(page.getByTestId("cnn-playground")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
    const button = page.getByRole("button", { name: "Use an MNIST test digit" });
    let idx = 0;
    for (let k = 0; k < 10; k++) {
      await button.click();
      idx = (idx + 7) % meta.samples.count;
      await expect(page.getByTestId("prediction")).toHaveText(String(meta.samples.labels[idx]));
    }
    await expect(page.getByTestId("cnn-meta")).toContainText("ms in your browser");
    expect(errors).toEqual([]);
  });

  test("feature maps light up after a digit", async ({ page }) => {
    await page.goto("/models/cnn-mnist");
    await expect(page.getByTestId("cnn-playground")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
    await page.getByRole("button", { name: "Use an MNIST test digit" }).click();
    await expect(page.getByTestId("prediction")).toBeVisible();
    const lit = await page.locator("figure canvas").first().evaluate((c: HTMLCanvasElement) => {
      const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      let s = 0;
      for (let i = 1; i < d.length; i += 4) s += d[i];
      return s;
    });
    expect(lit).toBeGreaterThan(0);
  });

  test("results match the training log and the ONNX score", async ({ page }) => {
    await page.goto("/models/cnn-mnist");
    const table = page.locator("table");
    await expect(table).toContainText(`${(cnn.results.test_acc * 100).toFixed(2)}%`);
    await expect(table).toContainText(`${(cnn.results.onnx_test_acc * 100).toFixed(2)}%`);
    const log = readFileSync("training/cnn_mnist/log.csv", "utf8").trim().split(/\r?\n/);
    const last = log[log.length - 1].split(",");
    expect(Number(last[4])).toBe(cnn.results.test_acc);
  });
});
