import { expect, test, type Page } from "@playwright/test";

const routes = ["/", "/models", "/models/mlp-numpy", "/models/cnn-mnist", "/models/cnn-cifar10", "/models/vae-mnist", "/models/resnet-cifar10", "/models/mini-gpt", "/models/vit-cifar10", "/models/dcgan-mnist", "/models/lstm-load", "/projects", "/projects/fraud", "/research", "/research/solar-forecasting", "/open-source", "/learn", "/about"];

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

for (const route of routes) {
  test(`${route} renders without errors`, async ({ page }) => {
    const errors = collectErrors(page);
    const res = await page.goto(route);
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    // No horizontal scroll at any viewport.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}

test("unknown route returns 404 page", async ({ page }) => {
  const res = await page.goto("/does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.locator("h1")).toContainText("No neuron fires here");
});

test("nav marks the current section and navigates", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Research" }).click();
  await expect(page).toHaveURL(/\/research$/);
  await expect(page.locator('a[aria-current="page"]')).toHaveText("Research");
  if (isMobile) await expect(page.locator("#main-nav")).toBeHidden();
});

test("theme toggle switches and persists across reload without flash", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.getByTestId("theme-toggle").click();
  await expect(html).toHaveAttribute("data-theme", "light");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(247, 248, 251)");

  // The inline script must apply the saved theme before first paint.
  await page.reload({ waitUntil: "commit" });
  await page.waitForSelector("body");
  await expect(html).toHaveAttribute("data-theme", "light");
});

test("home lists every section in the index", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator("section[aria-labelledby=layers-title] ol li a");
  await expect(cards).toHaveCount(6);
  await expect(page.getByTestId("hero")).toBeVisible();
});

test("skip link moves focus to main content", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard only");
  await page.goto("/about");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
});
