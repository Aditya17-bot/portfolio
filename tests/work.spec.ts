import { expect, test } from "@playwright/test";

test("models grid filters by kind and every card opens its page", async ({ page }) => {
  await page.goto("/models");
  const cards = page.getByTestId("work-card");
  await expect(cards).toHaveCount(9);
  await page.getByTestId("work-filter").filter({ hasText: "Generative" }).click();
  await expect(cards).toHaveCount(2);
  await page.getByTestId("work-filter").filter({ hasText: "All" }).click();
  await page.locator("#lstm-load").click();
  await expect(page).toHaveURL(/\/models\/lstm-load$/);
});

test("project cards open their demos while the code link still goes to GitHub", async ({ page }) => {
  await page.goto("/projects");
  const card = page.locator("#caterpillar");
  await expect(card.locator('a[href="https://github.com/Aditya17-bot/caterpillar"]')).toHaveCount(1);
  await card.locator("h3").click();
  await expect(page).toHaveURL(/\/projects\/caterpillar$/);
});
