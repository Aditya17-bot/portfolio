import { expect, test } from "@playwright/test";
import { adaptedThreshold, motionMagnitude, MOTION, schedule, T_COOLDOWN, T_GAP, EPSILON, N_PERSIST } from "../src/lib/wearable";

test("published equations: threshold falls with motion, never below the floor", () => {
  const still = adaptedThreshold(motionMagnitude(MOTION.standing.acc, MOTION.standing.gyro));
  const walking = adaptedThreshold(motionMagnitude(MOTION.walking.acc, MOTION.walking.gyro));
  expect(still).toBeCloseTo(0.6, 1);
  expect(walking).toBeLessThan(still);
  expect(adaptedThreshold(100)).toBe(0.35);
});

test("scheduler: persistence, cooldown, escalation never skips the global gap", () => {
  const p = { nPersist: N_PERSIST, cooldown: T_COOLDOWN, gap: T_GAP, epsilon: EPSILON };
  const f = (t: number, T: number) => ({ t, T, state: "chair|center|close" });
  const out = schedule([f(0, 0.5), f(0.5, 0.5), f(1, 0.5), f(1.2, 0.8), f(2.1, 0.8)], p).map((x) => x.outcome);
  // first sighting waits; second fires; same news is held; a big rise escalates but must wait out the 1.5 s gap
  expect(out).toEqual(["persist", "fire", "cooldown", "gap", "escalated"]);
});

test("wearable lab: walking lowers the threshold and reveals the door", async ({ page }) => {
  await page.goto("/research/patents/wearable-navigation");
  const lab = page.getByTestId("wearable-rank");
  await expect(lab.getByTestId("wl-row-door")).toContainText("not detected");
  await lab.getByTestId("wl-motion-walking").click();
  await expect(lab.getByTestId("wl-row-door")).not.toContainText("not detected");
  await expect(lab.getByTestId("wl-row-bottle")).toContainText("findable");
  await expect(page.getByTestId("wearable-schedule").getByTestId("wl-tick")).toContainText("warnings in 12 s");
});

test("research links the patent explainer", async ({ page }) => {
  await page.goto("/research");
  await page.getByRole("link", { name: "See how it works" }).first().click();
  await expect(page).toHaveURL(/\/research\/patents\//);
});

test("sensor fusion: the published worked example gives CHI 2.34", async () => {
  const { chi, deviations, arbitrate, fixedAlarm, WORKED_STATS } = await import("../src/lib/hazard");
  const r = { gas: 170, temp: 33.0, flame: 0.4, hum: 52, light: 305 };
  const d = deviations(r, WORKED_STATS);
  const c = chi(d);
  expect(c.indSum).toBeCloseTo(1.122, 2);
  expect(c.pairSum).toBeCloseTo(1.215, 2);
  expect(c.total).toBeCloseTo(2.34, 2);
  // Every channel is below its own alarm; only the fused index warns.
  expect(fixedAlarm(r)).toBe(false);
  const a = arbitrate(c.total, d, r);
  expect(a.paths.channel).toBe("safe");
  expect(a.band).toBe("warning");
});

test("sensor fusion lab: fixed alarm silent while the index warns; protection keeps the leak visible", async ({ page }) => {
  const { leak } = await import("../src/lib/hazard");
  const on = leak(true);
  const off = leak(false);
  expect(on[on.length - 1].n).toBeGreaterThan(2);
  expect(off[off.length - 1].n).toBeLessThan(on[on.length - 1].n / 2);

  await page.goto("/research/patents/sensor-fusion");
  const lab = page.getByTestId("hazard-panel");
  await lab.getByTestId("hz-preset").nth(1).click();
  await expect(lab.getByTestId("hz-fixed")).toContainText("Silent");
  await expect(lab.getByTestId("hz-band")).toContainText("Warning");
  await expect(lab.getByTestId("hz-chi")).toHaveText("2.34");
  // Without the pairwise terms the same readings barely register.
  await lab.getByTestId("hz-pairs").uncheck();
  await expect(lab.getByTestId("hz-chi")).toHaveText("1.12");
  await page.getByTestId("hz-protect-off").click();
  await expect(page.getByTestId("hz-protect-result")).toContainText("Without protection");
});
