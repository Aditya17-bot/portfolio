import { expect, test } from "@playwright/test";
import { splitSentences } from "../src/lib/voice";

test("the sentence splitter matches the app's rules", () => {
  expect(splitSentences("Hello there. How are")).toEqual([["Hello there."], "How are"]);
  // A sentence at the very end may still grow, so it stays in the remainder.
  expect(splitSentences("It costs 3.5 dollars.")).toEqual([[], "It costs 3.5 dollars."]);
  // Abbreviations are not sentence ends.
  expect(splitSentences("Ask Dr. Smith today. Then")).toEqual([["Ask Dr. Smith today."], "Then"]);
});

test("voice explainer: streaming speaks sooner, a slow model gets a filler, barge-in stops it", async ({ page }) => {
  await page.goto("/projects/voice-assistant");
  const v = page.getByTestId("voice-explainer");
  const first = async () => Number(/First word ([\d.]+) s/.exec((await v.getByTestId("vx-first").textContent())!)![1]);
  const streamed = await first();
  await v.getByTestId("vx-streaming").uncheck();
  expect(await first()).toBeGreaterThan(streamed + 0.5);
  await v.getByTestId("vx-streaming").check();
  await v.getByTestId("vx-slow").check();
  await expect(v.getByTestId("vx-first")).toContainText("filler");
  await v.getByTestId("vx-slow").uncheck();

  await v.getByTestId("vx-play").click();
  await expect(v.getByTestId("vx-interrupt")).toBeEnabled({ timeout: 8_000 });
  await v.getByTestId("vx-interrupt").click();
  await expect(v.getByTestId("vx-reply")).toContainText("interrupted");
});

test("splitter playground holds back the unfinished sentence", async ({ page }) => {
  await page.goto("/projects/voice-assistant");
  const s = page.getByTestId("vx-splitter");
  await expect(s.getByTestId("vx-sentence")).toHaveCount(2);
  await s.getByTestId("vx-split-input").fill("One. Two. Three");
  await expect(s.getByTestId("vx-sentence")).toHaveCount(2);
  await expect(s).toContainText("held back");
});
