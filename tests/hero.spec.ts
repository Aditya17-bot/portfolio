import { expect, test } from "@playwright/test";

test.describe("neural network hero", () => {
  test("draws the network and has one chapter per layer", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto("/");
    await expect(page.locator("[data-testid=hero] canvas")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("[data-chapter]")).toHaveCount(6);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Models you can run");
    // The canvas must actually paint something, not stay a blank clear colour.
    await page.waitForTimeout(1500);
    const lit = await page.locator("[data-testid=hero] canvas").screenshot();
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
    await link.click();
    await expect(page).toHaveURL(/\/models$/);
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
