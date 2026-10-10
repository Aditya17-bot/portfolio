import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const data = JSON.parse(readFileSync("public/projects/fraud/curves.json", "utf8"));

test.describe("Fraud detection demo", () => {
  test("the projects list links to it", async ({ page }) => {
    await page.goto("/projects");
    await page.locator("#fraud").getByRole("link", { name: "Try the alert budget" }).click();
    await expect(page).toHaveURL(/\/projects\/fraud$/);
    await expect(page.getByTestId("fraud-explorer")).toBeVisible();
  });

  test("a bigger budget catches more fraud, and the numbers match the data", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/projects/fraud");
    const root = page.getByTestId("fraud-explorer");
    const slider = root.getByTestId("fraud-budget");
    const recall = root.getByTestId("fraud-recall").first();
    const n = data.models.random_forest.curve.length;

    const [, caught0] = data.models.random_forest.curve[0];
    await expect(root).toHaveAttribute("data-ready", "true");
    await slider.fill("0");
    await expect(recall).toContainText(`${caught0.toLocaleString("en-US")} of ${data.data.test_fraud.toLocaleString("en-US")}`);

    await slider.fill(String(n - 1));
    await expect(recall).toContainText(`${data.data.test_fraud.toLocaleString("en-US")} of`);
    await expect(root.getByTestId("fraud-budget-label")).toContainText("100.0%");

    // The cheapest-budget button moves the slider.
    await root.getByTestId("fraud-review").fill("50");
    await root.getByRole("button", { name: "Go there" }).click();
    await expect.poll(async () => Number(await slider.inputValue())).toBeLessThan(n - 1);
    expect(errors).toEqual([]);
  });

  test("curves are monotonic and the supervised model is better ranked", () => {
    for (const m of Object.values(data.models) as { curve: number[][]; pr_auc: number }[]) {
      for (let i = 1; i < m.curve.length; i++) {
        expect(m.curve[i][0]).toBeGreaterThanOrEqual(m.curve[i - 1][0]);
        expect(m.curve[i][1]).toBeGreaterThanOrEqual(m.curve[i - 1][1]);
      }
      expect(m.curve[m.curve.length - 1][0]).toBe(data.data.test_rows);
    }
    expect(data.models.random_forest.pr_auc).toBeGreaterThan(data.models.isolation_forest.pr_auc);
  });
});
