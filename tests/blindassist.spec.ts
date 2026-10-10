import { expect, test } from "@playwright/test";

test.describe("BlindAssist demo", () => {
  // 24 MB of detectors plus the runtime on first load; slow links need the room.
  test.setTimeout(180_000);

  test("detects on the example photo, speaks a sentence and steps through the pipeline", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/projects/blindassist");
    const root = page.getByTestId("blindassist-demo");
    await expect(root).toHaveAttribute("data-ready", "true", { timeout: 150_000 });
    // The wardrobe photo: walk mode must produce a warning sentence, not silence.
    const say = root.getByTestId("ba-say");
    await expect(say).not.toHaveText("…");
    await expect(say).not.toContainText("Path looks clear");
    await expect(root.getByTestId("ba-objects").locator("li")).not.toHaveCount(0);

    // Each step redraws the canvas.
    const canvas = root.getByTestId("ba-canvas");
    const shot = async () => (await canvas.screenshot()).toString("base64");
    await root.getByTestId("ba-step-frame").click();
    const plain = await shot();
    await root.getByTestId("ba-step-where").click();
    await expect(root.getByTestId("ba-explain")).toContainText("clock bearing");
    expect(await shot()).not.toBe(plain);

    // Describe mode summarises instead of warning.
    await root.getByTestId("ba-mode-describe").click();
    await expect(say).not.toContainText("very close");
    expect(errors).toEqual([]);
  });

  test("another example photo gives another analysis", async ({ page }) => {
    await page.goto("/projects/blindassist");
    const root = page.getByTestId("blindassist-demo");
    await expect(root).toHaveAttribute("data-ready", "true", { timeout: 150_000 });
    const first = await root.getByTestId("ba-say").textContent();
    await root.getByTestId("ba-example").nth(2).click();
    await expect.poll(() => root.getByTestId("ba-say").textContent(), { timeout: 30_000 }).not.toBe(first);
  });
});
