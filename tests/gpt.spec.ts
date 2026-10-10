import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const meta = JSON.parse(readFileSync("public/models/mini-gpt/meta.json", "utf8"));

test.describe("Mini-GPT page", () => {
  test("generates text from the vocabulary and shows attention for a character", async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/models/mini-gpt");
    const root = page.getByTestId("gpt-playground");
    await expect(root).toHaveAttribute("data-ready", "true", { timeout: 50_000 });
    await root.getByTestId("gpt-generate").click();
    await expect(root.getByTestId("gpt-meta")).toContainText("ms per character", { timeout: 90_000 });
    const text = (await root.getByTestId("gpt-output").textContent())!;
    expect(text.startsWith(meta.sample.prompt)).toBe(true);
    expect(text.length).toBe(meta.sample.prompt.length + 300);
    for (const c of text) expect(meta.vocab).toContain(c);

    await root.getByTestId("gpt-output").locator("span").nth(meta.sample.prompt.length + 20).click();
    const attn = root.getByTestId("gpt-attention");
    await expect(attn).toBeVisible();
    // Some earlier characters get highlighted.
    await expect(root.getByTestId("gpt-output").locator("span[style*='background']").first()).toBeVisible();
    await attn.getByRole("button", { name: "1", exact: true }).first().click();
    expect(errors).toEqual([]);
  });

  test("results match the training log", async ({ page }) => {
    await page.goto("/models/mini-gpt");
    await expect(page.locator("table")).toContainText(`${meta.results.val_loss.toFixed(3)} nats`);
    await expect(page.locator("table")).toContainText(`${meta.results.bigram_val_loss.toFixed(3)} nats`);
    const log = readFileSync("training/mini_gpt/log.csv", "utf8").trim().split(/\r?\n/);
    expect(Number(log[log.length - 1].split(",")[0])).toBe(meta.config.steps);
  });
});
