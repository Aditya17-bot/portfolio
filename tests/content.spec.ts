import { expect, test } from "@playwright/test";
import { pullRequests } from "../src/content/openSource";
import { featured, more } from "../src/content/projects";
import { patents } from "../src/content/research";

test("research lists the paper and every published patent with its application number", async ({ page }) => {
  await page.goto("/research");
  await expect(page.getByTestId("paper")).toHaveCount(1);
  await expect(page.getByTestId("paper")).toContainText("SIPCOV-2026");
  await expect(page.getByTestId("patent")).toHaveCount(patents.length);
  for (const p of patents) await expect(page.getByText(`Application No. ${p.number}`)).toBeVisible();
});

test("open source separates merged from in-review and links each PR", async ({ page }) => {
  await page.goto("/open-source");
  const merged = pullRequests.filter((p) => p.state === "merged");
  await expect(page.locator("[data-testid=pr][data-state=merged]")).toHaveCount(merged.length);
  await expect(page.locator("[data-testid=pr][data-state=open]")).toHaveCount(pullRequests.length - merged.length);
  for (const pr of pullRequests) {
    await expect(page.locator(`a[href="https://github.com/${pr.repo}/pull/${pr.number}"]`)).toHaveCount(1);
  }
  // Every merged card explains bug, fix and test.
  for (const card of await page.locator("[data-testid=pr][data-state=merged]").all()) {
    await expect(card.locator("dt")).toHaveText(["Bug", "Fix", "Test"]);
  }
});

test("projects show every project with a code link, and anchors from About resolve", async ({ page }) => {
  await page.goto("/projects");
  await expect(page.getByTestId("project")).toHaveCount(featured.length + more.length);
  for (const p of [...featured, ...more]) {
    if (p.repo) await expect(page.locator(`#${p.slug} a[href="${p.repo}"]`)).toHaveCount(1);
  }
  await page.goto("/about");
  await page.getByRole("link", { name: "Amazon ML Challenge 2026" }).click();
  await expect(page).toHaveURL(/\/projects#amazon-ml-challenge$/);
  await expect(page.locator("#amazon-ml-challenge")).toBeInViewport();
});

test("about has contact links", async ({ page }) => {
  await page.goto("/about");
  const contact = page.getByTestId("contact");
  await expect(contact.locator('a[href^="mailto:"]')).toHaveCount(1);
  await expect(contact.locator('a[href*="github.com"]')).toHaveCount(1);
  await expect(contact.locator('a[href*="linkedin.com"]')).toHaveCount(1);
});

test("learn links each idea to a live model page section", async ({ page }) => {
  await page.goto("/learn");
  const lessons = page.getByTestId("lesson");
  expect(await lessons.count()).toBeGreaterThanOrEqual(5);
  const first = lessons.first().getByRole("link");
  await expect(first).toHaveAttribute("href", "/models/mlp-numpy#how");
  await first.click();
  await expect(page).toHaveURL(/\/models\/mlp-numpy#how$/);
  await expect(page.locator("#how")).toBeInViewport();
});
