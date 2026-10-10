import { expect, test } from "@playwright/test";
import { explainers } from "../src/content/learn";

test("learn index lists every explainer and opens one", async ({ page }) => {
  await page.goto("/learn");
  await expect(page.getByTestId("lesson")).toHaveCount(explainers.length);
  await page.locator("#backprop").click();
  await expect(page).toHaveURL(/\/learn\/backprop$/);
});

for (const e of explainers) {
  test(`${e.slug}: video, idea, lab and links render`, async ({ page, request }) => {
    const errors: string[] = [];
    page.on("pageerror", (x) => errors.push(x.message));
    await page.goto(`/learn/${e.slug}`);
    const video = page.getByTestId("learn-video");
    const src = await video.getAttribute("src");
    expect((await request.get(src!)).headers()["content-type"]).toContain("video/mp4");
    await expect(page.locator(`a[href="/models/${e.model.slug}"]`)).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

test("backprop lab: training steps lower the loss", async ({ page }) => {
  await page.goto("/learn/backprop");
  const lab = page.getByTestId("lab-backprop");
  const loss = async () => Number((await lab.getByTestId("bp-loss").textContent())!.replace(/[^\d.]/g, ""));
  const before = await loss();
  await expect(async () => {
    await lab.getByTestId("bp-step20").click();
    expect(await loss()).toBeLessThan(before);
  }).toPass();
});

test("convolution lab: the edge filter responds where the drawing has an edge", async ({ page }) => {
  await page.goto("/learn/convolution");
  const lab = page.getByTestId("lab-conv");
  const vals = await lab.getByTestId("conv-out").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-v"))));
  expect(Math.max(...vals.map(Math.abs))).toBeGreaterThan(1);
  await lab.getByTestId("conv-filter").filter({ hasText: "Blur" }).click();
  const blurred = await lab.getByTestId("conv-out").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-v"))));
  expect(Math.min(...blurred)).toBeGreaterThanOrEqual(0);
});

test("overfitting lab: high degree overfits a dozen points", async ({ page }) => {
  await page.goto("/learn/overfitting");
  const lab = page.getByTestId("lab-overfit");
  const testErr = async () => Number(await lab.getByTestId("of-test").textContent());
  await lab.getByTestId("of-slider").fill("3");
  const good = await testErr();
  await lab.getByTestId("of-slider").fill("11");
  expect(await testErr()).toBeGreaterThan(good);
});

test("residual lab: switching shortcuts on shows the real ResNet-56 run", async ({ page }) => {
  await page.goto("/learn/residual");
  const lab = page.getByTestId("lab-residual");
  await expect(lab.getByTestId("res-result")).toContainText("plain-56");
  await lab.getByTestId("res-toggle").click();
  await expect(lab.getByTestId("res-result")).toContainText("resnet-56");
  await expect(lab.getByTestId("res-result")).toContainText("91.70%");
});
