import { expect, test } from "@playwright/test";

// Live calls to UniProt and AlphaFold DB: allow for slow public APIs.
test.describe("Protein impact explorer", () => {
  test.setTimeout(90_000);

  test("loads SOD1, scores A4V, and compares a hotspot pair in sequence and 3D", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/projects/gene-anomaly");
    const root = page.getByTestId("gene-explorer");
    await expect(root).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
    await expect(root.getByTestId("gene-protein")).toContainText("SOD1");
    await expect(root.getByTestId("gene-protein")).toContainText("P00441");

    // Legacy numbering is caught and corrected; UniProt numbering scores.
    await root.getByTestId("gene-variant").fill("A4V");
    await root.getByTestId("gene-variant").press("Enter");
    await expect(root.getByTestId("gene-variant-result")).toContainText("try A5V");
    await root.getByTestId("gene-variant").fill("A5V");
    await root.getByTestId("gene-variant").press("Enter");
    await expect(root.getByTestId("gene-variant-result")).toContainText(/A5V: 0\.\d{3}, likely pathogenic/);

    // A hotspot: far apart in sequence, under 8 Å in 3D.
    await root.getByTestId("gene-hotspots").locator("button").first().click();
    const d = Number((await root.getByTestId("gene-dist").first().textContent())!.replace(" Å", ""));
    expect(d).toBeLessThanOrEqual(8);
    expect(errors).toEqual([]);
  });

  test("an unknown gene explains itself", async ({ page }) => {
    await page.goto("/projects/gene-anomaly");
    const root = page.getByTestId("gene-explorer");
    await expect(root).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
    await root.getByTestId("gene-input").fill("NOTAGENE123");
    await root.getByTestId("gene-go").click();
    await expect(root.getByTestId("gene-error")).toContainText("No reviewed human protein");
  });
});
