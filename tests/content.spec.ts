import { expect, test } from "@playwright/test";
import { pullRequests } from "../src/content/openSource";
import { featured, more } from "../src/content/projects";
import { patents } from "../src/content/research";

test("research lists both papers, published patents with numbers and filed ones without", async ({ page }) => {
  await page.goto("/research");
  await expect(page.getByTestId("paper")).toHaveCount(2);
  await expect(page.locator("[data-testid=paper][data-status=Presented]")).toContainText("SIPCOV-2026");
  await expect(page.locator("[data-testid=paper][data-status='Under revision']")).toContainText("ICMLDE");
  const published = patents.filter((p) => p.status === "Published");
  await expect(page.locator("[data-testid=patent][data-status=Published]")).toHaveCount(published.length);
  for (const p of published) await expect(page.getByText(`Application No. ${p.number}`)).toBeVisible();
  // Filed applications carry no number until publication.
  const filed = page.locator("[data-testid=patent][data-status=Filed]");
  await expect(filed).toHaveCount(patents.length - published.length);
  await expect(filed.getByText("Application No.")).toHaveCount(0);
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
  const resume = await page.request.get((await contact.getByTestId("resume").getAttribute("href"))!);
  expect(resume.ok()).toBe(true);
  expect(resume.headers()["content-type"]).toContain("pdf");
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

test("share image, sitemap and robots are served", async ({ page, request }) => {
  await page.goto("/");
  const og = await page.locator('meta[property="og:image"]').getAttribute("content");
  const img = await request.get(new URL(og!).pathname);
  expect(img.headers()["content-type"]).toBe("image/png");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const path of ["/projects/fraud", "/models/lstm-load", "/about"]) expect(sitemap).toContain(path);
  expect(await (await request.get("/robots.txt")).text()).toContain("sitemap.xml");
});
