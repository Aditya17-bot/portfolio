import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const data = JSON.parse(readFileSync("public/projects/solar/explorer.json", "utf8"));
const lstm = JSON.parse(readFileSync("public/models/lstm-load/meta.json", "utf8"));

test.describe("Solar-aware forecasting", () => {
  test("research links to it", async ({ page }) => {
    await page.goto("/research");
    await page.getByRole("link", { name: "Rerun on public data: try it" }).click();
    await expect(page).toHaveURL(/\/research\/solar-forecasting$/);
  });

  test("explorer draws the chosen forecasts and changes with the day", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/research/solar-forecasting");
    const root = page.getByTestId("solar-explorer");
    await expect(root).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
    const line = root.getByTestId("solar-line-lgbm_solar");
    await expect(line).toBeVisible();
    await expect(root.getByTestId("solar-line-lstm")).toHaveCount(0);
    await root.getByTestId("solar-toggle-lstm").check();
    await expect(root.getByTestId("solar-line-lstm")).toHaveCount(1);
    // The day's error shown matches one computed from the data file.
    const day = Number(await root.getByTestId("solar-day").inputValue());
    const actual: number[] = data.days.actual[day];
    const pred: number[] = data.days.pred.lgbm_solar[day];
    const expected = (100 * pred.reduce((s, v, i) => s + Math.abs(v - actual[i]) / actual[i], 0)) / actual.length;
    await expect(root.getByTestId("solar-score-lgbm_solar")).toHaveText(`${expected.toFixed(2)}%`);
    const before = await line.getAttribute("d");
    await root.getByTestId("solar-day").selectOption("0");
    await expect.poll(() => line.getAttribute("d")).not.toBe(before);
    expect(errors).toEqual([]);
  });

  test("results agree with the LSTM page and beat the baselines", async ({ page }) => {
    // The LSTM row is recomputed from its ONNX file on the same windows; it must match the LSTM page.
    expect(Math.abs(data.table.lstm.mape - lstm.results.test_mape)).toBeLessThan(0.01);
    expect(data.counts.test_origins).toBe(lstm.results.test_origins);
    for (const k of ["lgbm_solar", "lgbm_base", "ridge_solar", "ridge_base", "lstm"]) {
      expect(data.table[k].mape).toBeLessThan(data.table.persistence.mape);
    }
    await page.goto("/research/solar-forecasting");
    await expect(page.locator("table")).toContainText(`${data.table.lgbm_solar.mape.toFixed(2)}%`);
    await expect(page.getByTestId("hour-chart")).toBeVisible();
  });
});
