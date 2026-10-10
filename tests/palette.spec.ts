import { expect, test } from "@playwright/test";
import { searchIndex } from "../src/content/search";

test.describe("Command palette", () => {
  test("keyboard: open, filter, move, open a model page", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard shortcuts are a desktop feature; the button is tested on mobile");
    await page.goto("/");
    const palette = page.getByTestId("palette");
    // Retry the shortcut until the page has hydrated and the listener is attached.
    await expect(async () => {
      await page.keyboard.press("Control+k");
      await expect(palette).toBeVisible({ timeout: 1000 });
    }).toPass();
    const input = page.getByTestId("palette-input");
    await expect(input).toBeFocused();
    await input.fill("resnet");
    const first = page.getByTestId("palette-option").first();
    await expect(first).toContainText("ResNet");
    await expect(first).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/models\/resnet-cifar10$/);
    await expect(palette).toBeHidden();
  });

  test("escape closes, slash reopens, arrows move the selection", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard shortcuts are a desktop feature");
    await page.goto("/about");
    const palette = page.getByTestId("palette");
    await expect(async () => {
      await page.keyboard.press("/");
      await expect(palette).toBeVisible({ timeout: 1000 });
    }).toPass();
    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();
    await page.keyboard.press("/");
    await expect(palette).toBeVisible();
    // The query starts empty again and the second option is selected after one ArrowDown.
    await expect(page.getByTestId("palette-input")).toHaveValue("");
    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId("palette-option").nth(1)).toHaveAttribute("aria-selected", "true");
  });

  test("button opens it, a project search jumps to the project card", async ({ page }) => {
    await page.goto("/");
    const palette = page.getByTestId("palette");
    await expect(async () => {
      await page.getByTestId("palette-open").click();
      await expect(palette).toBeVisible({ timeout: 1000 });
    }).toPass();
    await page.getByTestId("palette-input").fill("blind assist");
    await page.getByTestId("palette-option").filter({ hasText: "BlindAssist" }).first().click();
    await expect(page).toHaveURL(/\/projects#blindassist$/);
  });

  test("an unmatched query says so; actions switch the theme", async ({ page }) => {
    await page.goto("/");
    const palette = page.getByTestId("palette");
    await expect(async () => {
      await page.getByTestId("palette-open").click();
      await expect(palette).toBeVisible({ timeout: 1000 });
    }).toPass();
    const input = page.getByTestId("palette-input");
    await input.fill("zzzz qqqq");
    await expect(palette).toContainText("Nothing matches");
    await input.fill("theme");
    const before = await page.locator("html").getAttribute("data-theme");
    await page.getByTestId("palette-option").first().click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", before!);
  });

  test("every internal target exists, anchors included", async ({ request }) => {
    const internal = searchIndex().filter((i) => i.href?.startsWith("/"));
    expect(internal.length).toBeGreaterThan(20);
    const pages = new Map<string, string>();
    for (const item of internal) {
      const [path, hash] = item.href!.split("#");
      if (!pages.has(path)) {
        const res = await request.get(path);
        expect(res.ok(), path).toBe(true);
        pages.set(path, path.endsWith(".pdf") ? "" : await res.text());
      }
      if (hash) expect(pages.get(path), item.href).toContain(`id="${hash}"`);
    }
  });
});
