import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { jaroWinkler, normalise, partialRatio, ratio, tokenSetRatio, tokenSortRatio } from "../src/lib/matcher";

// Reference values computed with the rapidfuzz library the app uses.
const ref: [string, string, number, number, number, number, number][] = JSON.parse(readFileSync("tests/fixtures/rapidfuzz.json", "utf8"));

test("scorers match rapidfuzz", () => {
  for (const [a, b, r, sort, set, partial, jw] of ref) {
    expect(ratio(a, b), `ratio ${a} | ${b}`).toBeCloseTo(r, 6);
    expect(tokenSortRatio(a, b), `sort ${a} | ${b}`).toBeCloseTo(sort, 6);
    expect(tokenSetRatio(a, b), `set ${a} | ${b}`).toBeCloseTo(set, 6);
    expect(partialRatio(a, b), `partial ${a} | ${b}`).toBeCloseTo(partial, 6);
    expect(jaroWinkler(a, b), `jw ${a} | ${b}`).toBeCloseTo(jw, 6);
  }
});

test("normalisation follows prep.py", () => {
  const native = JSON.parse(readFileSync("public/projects/amazon/native_map.json", "utf8"));
  const n = normalise({ name: "M/s Sharma Bros. Pvt. Ltd.", address: "12, M.G. Rd, Pune, MH 411001" }, "India", native);
  expect(n.norm.name).toBe("sharma brothers private limited");
  expect(n.norm.address).toBe("12 m g road pune maharashtra 411001");
  const h = normalise({ name: "ग्लोबल इंफ्रास्ट्रक्चर प्राइवेट लिमिटेड", address: "महाराष्ट्र" }, "India", native);
  expect(h.norm.name).toBe("global infrastructure private limited");
  const f = normalise({ name: "Boulangerie Martin S.A.R.L.", address: "14 r. du Jura, Lyon" }, "France", native);
  expect(f.norm.name).toBe("boulangerie martin sarl");
  expect(f.norm.address).toBe("14 rue jura lyon");
});

test("walk-through: guess, normalise, features, decoy signs", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/projects/amazon-ml-challenge");
  const m = page.getByTestId("amazon-matcher");
  await expect(m).toHaveAttribute("data-ready", "true");
  await expect(m.getByTestId("am-norm-q")).toContainText("sharma brothers private limited");
  await m.getByTestId("am-guess-same").click();
  await expect(m.getByTestId("am-answer")).toContainText("Right.");
  await expect(m.getByTestId("am-reading")).toHaveAttribute("data-reading", "same");
  // The decoy example lights up two signs and reads as a decoy.
  await m.getByTestId("am-pair").nth(2).click();
  await expect(m.getByTestId("am-decoys").locator("li[data-on]")).toHaveCount(2);
  await expect(m.getByTestId("am-reading")).toHaveAttribute("data-reading", "decoy");
  // Native script is mapped back to English.
  await m.getByTestId("am-pair").nth(1).click();
  await expect(m.getByTestId("am-norm-q")).toContainText("global infrastructure private limited");
  expect(errors).toEqual([]);
});
