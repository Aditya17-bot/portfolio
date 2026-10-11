import { expect, test } from "@playwright/test";

test.describe("neural network hero", () => {
  test("draws the network and has one chapter per layer", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto("/");
    await expect(page.locator("[data-testid=hero] canvas[data-engine]")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("[data-chapter]")).toHaveCount(6);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Models you can run");
    // The canvas must actually paint something, not stay a blank clear colour.
    await page.waitForTimeout(1500);
    const lit = await page.locator("[data-testid=hero] canvas[data-engine]").screenshot();
    expect(lit.byteLength).toBeGreaterThan(20_000);
    expect(errors).toEqual([]);
  });

  test("scrolling activates each chapter in turn", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-chapter=start]")).toHaveAttribute("data-active", "");
    for (const id of ["input", "models", "work", "open-source", "contact"]) {
      await page.locator(`[data-chapter="${id}"]`).evaluate((el) => el.scrollIntoView({ block: "center" }));
      await expect(page.locator(`[data-chapter="${id}"]`)).toHaveAttribute("data-active", "");
      await expect(page.locator("[data-chapter][data-active]")).toHaveCount(1);
    }
  });

  test("chapter links lead to their sections", async ({ page }) => {
    await page.goto("/");
    const link = page.locator("[data-chapter=models]").getByRole("link", { name: /Open the zoo/ });
    await link.scrollIntoViewIfNeeded();
    // Wait until the chapter is the active one, so its card has finished sliding into place.
    await expect(page.locator("[data-chapter=models][data-active]")).toHaveCount(1);
    await link.click();
    await expect(page).toHaveURL(/\/models$/);
  });

  test("layer readouts follow the pass and name the neuron under the pointer", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    for (const [layer, tiles] of [
      [1, 128],
      [2, 64],
      [3, 10],
    ] as const) {
      const readout = page.getByTestId(`readout-${layer}`);
      await readout.scrollIntoViewIfNeeded();
      const grid = readout.locator("canvas").first();
      await expect(grid).toHaveAttribute("aria-label", new RegExp(`^${tiles} tiles`));
      // The canvas is sized and painted once the model has loaded.
      await expect.poll(() => grid.evaluate((c: HTMLCanvasElement) => c.height)).toBeGreaterThan(20);
      await grid.focus();
      // The first arrow press picks the first tile, the next one steps right.
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      await expect(readout.locator("figcaption")).toContainText(layer === 3 ? /Digit 1: \d+\.\d%/ : /Neuron 2 of/);
    }
    // The output readout's bars add up to one prediction.
    await expect(page.getByTestId("readout-3").locator("li[data-top]")).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test("reduced motion shows every chapter fully", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/");
    const card = page.locator("[data-chapter=contact] > div");
    await expect(card).toHaveCSS("opacity", "1");
    await ctx.close();
  });
});
