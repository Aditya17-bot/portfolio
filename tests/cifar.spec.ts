import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const cnn = JSON.parse(readFileSync("public/models/cnn-cifar10/meta.json", "utf8"));
const haveResnet = existsSync("public/models/resnet-cifar10/meta.json");

async function heatSum(page: Page, testId: string) {
  return page
    .getByTestId(testId)
    .locator("canvas[width='128']")
    .evaluate((c: HTMLCanvasElement) => {
      const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      let s = 0;
      for (let i = 3; i < d.length; i += 4) s += d[i];
      return s;
    });
}

/** Click the first twelve test images; return how many the model got right. */
async function scoreSamples(page: Page, testId: string) {
  const root = page.getByTestId(testId);
  await expect(root).toHaveAttribute("data-ready", "true", { timeout: 50_000 });
  let correct = 0;
  const thumbs = root.getByTestId("cifar-sample");
  await expect(thumbs).toHaveCount(12);
  for (let k = 0; k < 12; k++) {
    await thumbs.nth(k).click();
    const truth = root.getByTestId("cifar-truth");
    await expect(truth).toContainText(`Label: ${cnn.classes[cnn.samples.labels[k]]}`);
    await expect(truth).toContainText(/correct|wrong/);
    if ((await truth.textContent())!.includes("correct")) correct++;
  }
  return correct;
}

test.describe("CIFAR-10 CNN page", () => {
  test("classifies CIFAR-10 test images in the browser and draws the activation map", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/models/cnn-cifar10");
    // 10 of these 12 are right in onnxruntime on the CPU (checked when the samples were written).
    expect(await scoreSamples(page, "cifar-playground")).toBeGreaterThanOrEqual(9);
    expect(await heatSum(page, "cifar-playground")).toBeGreaterThan(0);
    await expect(page.getByTestId("cifar-meta")).toContainText("ms in your browser");
    expect(errors).toEqual([]);
  });

  test("an uploaded photo is shrunk to 32x32 and classified", async ({ page }) => {
    await page.goto("/models/cnn-cifar10");
    const root = page.getByTestId("cifar-playground");
    await expect(root).toHaveAttribute("data-ready", "true", { timeout: 50_000 });
    await root.getByTestId("cifar-upload").setInputFiles("tests/fixtures/ship.png");
    await expect(root.getByTestId("prediction")).toHaveText("ship");
    await expect(root).toContainText("Your photo, shrunk to 32×32");
  });

  test("results match the training log and the ONNX score", async ({ page }) => {
    await page.goto("/models/cnn-cifar10");
    const table = page.locator("table");
    await expect(table).toContainText(`${(cnn.results.test_acc * 100).toFixed(2)}%`);
    await expect(table).toContainText(`${(cnn.results.onnx_test_acc * 100).toFixed(2)}%`);
    const log = readFileSync("training/cnn_cifar10/log.csv", "utf8").trim().split(/\r?\n/);
    expect(Number(log[log.length - 1].split(",")[4])).toBe(cnn.results.test_acc);
  });
});

test.describe("ResNet page", () => {
  test.skip(!haveResnet, "ResNet runs not trained yet");

  test("ResNet-56 classifies the same test images in the browser", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/models/resnet-cifar10");
    expect(await scoreSamples(page, "resnet-playground")).toBeGreaterThanOrEqual(9);
    expect(await heatSum(page, "resnet-playground")).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test("every run in the table matches its log", async ({ page }) => {
    await page.goto("/models/resnet-cifar10");
    for (const run of ["plain-20", "plain-56", "resnet-20", "resnet-56"]) {
      const r = JSON.parse(readFileSync(`public/models/resnet-cifar10/${run}.json`, "utf8"));
      const log = readFileSync(`training/resnet_cifar10/${run}.csv`, "utf8").trim().split(/\r?\n/);
      expect(Number(log[log.length - 1].split(",")[4])).toBe(r.test_acc);
      await expect(page.locator("table")).toContainText(`${(r.test_acc * 100).toFixed(2)}% test`);
    }
  });
});

test.describe("ViT page", () => {
  test.skip(!existsSync("public/models/vit-cifar10/meta.json"), "ViT not trained yet");

  test("ViT-Tiny classifies the same test images in the browser and draws attention rollout", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/models/vit-cifar10");
    expect(await scoreSamples(page, "vit-playground")).toBeGreaterThanOrEqual(7);
    expect(await heatSum(page, "vit-playground")).toBeGreaterThan(0);
    await expect(page.getByTestId("vit-playground")).toContainText("Attention rollout");
    expect(errors).toEqual([]);
  });
});
