import { expect, test } from "@playwright/test";
import { splitSentences } from "../src/lib/voice";

test("the sentence splitter matches the app's rules", () => {
  expect(splitSentences("Hello there. How are")).toEqual([["Hello there."], "How are"]);
  // A sentence at the very end may still grow, so it stays in the remainder.
  expect(splitSentences("It costs 3.5 dollars.")).toEqual([[], "It costs 3.5 dollars."]);
  // Abbreviations are not sentence ends.
  expect(splitSentences("Ask Dr. Smith today. Then")).toEqual([["Ask Dr. Smith today."], "Then"]);
});

test("voice page asks before downloading the models", async ({ page }) => {
  await page.goto("/projects/voice-assistant");
  const demo = page.getByTestId("voice-demo");
  await expect(demo).toHaveAttribute("data-state", "idle");
  await expect(demo.getByTestId("voice-load")).toContainText("MB");
});

// Downloads ~180 MB of models: run with FULL_VOICE=1.
test("typed question gets a streamed, timed answer", async ({ page }) => {
  test.skip(!process.env.FULL_VOICE, "set FULL_VOICE=1 to download the models");
  test.setTimeout(900_000);
  await page.goto("/projects/voice-assistant");
  const demo = page.getByTestId("voice-demo");
  await demo.getByTestId("voice-load").click();
  await expect(demo).toHaveAttribute("data-state", "ready", { timeout: 840_000 });
  await demo.getByTestId("voice-input").fill("What is the capital of France?");
  await demo.getByTestId("voice-input").press("Enter");
  const answer = demo.getByTestId("voice-chat").locator("li[data-role=assistant]").last();
  await expect(answer).not.toHaveText("…", { timeout: 60_000 });
  await expect(demo.getByTestId("voice-waterfall")).toBeVisible();
  await expect(answer).toContainText(/\w{3,}/, { timeout: 60_000 });
});
