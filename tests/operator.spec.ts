import { expect, test } from "@playwright/test";

test.describe("Operator cab", () => {
  test("situations raise the backend's alerts, and clear", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/projects/caterpillar");
    const cab = page.getByTestId("operator-cab");
    await expect(cab).toBeVisible({ timeout: 20_000 });
    const status = cab.getByTestId("op-status");
    await expect(status).toHaveText("All clear", { timeout: 10_000 });

    // Seatbelt: nothing for the grace period, then critical (4x speed: 5 s is about 1.25 s).
    await cab.getByRole("button", { name: "Unbuckle" }).click();
    await expect(cab.locator("[data-kind=seatbelt][data-severity=critical]")).toBeVisible({ timeout: 6_000 });
    await expect(status).toHaveText("Critical");
    await cab.getByTestId("op-seatbelt").click();
    await expect(cab.locator("[data-kind=seatbelt]")).toHaveCount(0);

    // Worker within 1 m: warning.
    await cab.getByRole("button", { name: "Worker walks up" }).click();
    await expect(cab.locator("[data-kind=proximity][data-severity=warning]")).toBeVisible({ timeout: 4_000 });

    // Mud downhill: the advised speed drops and the same speed becomes a warning.
    await cab.getByRole("button", { name: "Fast on mud" }).click();
    await expect(cab.locator("[data-kind=overspeed]")).toBeVisible({ timeout: 4_000 });

    // The log keeps what happened.
    await cab.locator("summary").click();
    await expect(cab.getByTestId("op-log").locator("li")).not.toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("a blocked radiator is forecast before the limit", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/projects/caterpillar");
    const cab = page.getByTestId("operator-cab");
    await cab.getByRole("button", { name: "Blocked radiator" }).click();
    // The forecast warning comes while the engine is still below 110 °C.
    await expect(cab.locator("[data-kind=overheat_predicted]")).toBeVisible({ timeout: 60_000 });
    const temp = Number((await cab.getByTestId("op-temp").textContent())!.replace(" °C", ""));
    expect(temp).toBeLessThan(110);
  });
});
