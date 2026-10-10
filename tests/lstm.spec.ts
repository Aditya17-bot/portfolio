import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const meta = JSON.parse(readFileSync("public/models/lstm-load/meta.json", "utf8"));

test.describe("LSTM forecaster page", () => {
  test("forecasts a test day in the browser, and another when the day changes", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/models/lstm-load");
    const root = page.getByTestId("forecast-playground");
    await expect(root).toHaveAttribute("data-ready", "true", { timeout: 50_000 });
    await expect(root.getByTestId("forecast-meta")).toContainText("ms in your browser", { timeout: 20_000 });
    const line = root.getByTestId("forecast-line");
    const first = await line.getAttribute("d");
    // The day's error is shown and is plausible for an hour-ahead forecast.
    const text = (await root.textContent())!;
    const dayMape = Number(/LSTM, an hour ahead · ([\d.]+)% MAPE/.exec(text)![1]);
    expect(dayMape).toBeGreaterThan(0);
    expect(dayMape).toBeLessThan(10);
    await root.getByTestId("forecast-day").selectOption("0");
    await expect.poll(() => line.getAttribute("d")).not.toBe(first);
    expect(errors).toEqual([]);
  });

  test("results match the log and beat both baselines", async ({ page }) => {
    await page.goto("/models/lstm-load");
    const log = readFileSync("training/lstm_load/log.csv", "utf8").trim().split(/\r?\n/);
    const cols = log[0].split(",");
    expect(Number(log[log.length - 1].split(",")[cols.indexOf("test_mape")])).toBe(meta.results.test_mape);
    await expect(page.locator("table")).toContainText(`${meta.results.test_mape.toFixed(2)}%`);
    expect(meta.results.test_mape).toBeLessThan(meta.results.persistence_mape);
    expect(meta.results.test_mape).toBeLessThan(meta.results.yesterday_mape);
  });
});
