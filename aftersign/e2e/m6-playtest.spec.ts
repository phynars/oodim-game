import { expect, test } from "@playwright/test";
import { MOBILE, WAIT, assertEnding, assertFreshContext, playToDoor, tapAdvance } from "./m6-playtest.helpers";

// M6 playtest gate (#2929): visible taps only, boot -> Episode 2 Act I end card.
const CASES = [
  ["safe", "keep-official-record", "ep2-ledger-run", "The Ledger Run", "take"],
  ["risky", "protect-private-lie", "ep2-quiet-envelope", "The Quiet Envelope", "refuse"],
  ["safe", "hang-new-sign", "ep2-new-sign", "The New Sign", "take"],
] as const;

test.describe("M6 phone playtest (#2929)", () => {
  test.use(MOBILE);

  for (const [route, door, jobId, jobName, answer] of CASES) {
    test(`${jobId} reaches the Act I card after Niko ${answer}s`, async ({ page, browser }) => {
      test.setTimeout(240_000);
      const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      await page.goto(`/aftersign/?slot=m6-${route}-${token}&player=m6-${token}`, { waitUntil: "load" });

      await playToDoor(page, door, route);
      await expect(page.locator(`#episodeTwoJob[data-episode-two-job-id="${jobId}"]`)).toBeVisible({ timeout: WAIT });
      await tapAdvance(page, "#acceptEpisodeTwoJob:not([disabled])");

      await expect(page.locator("#nikoThread")).toBeVisible({ timeout: WAIT });
      await tapAdvance(page, `[data-niko-shortcut-choice="${answer}"]`);

      await assertEnding(page, jobName, answer);
      await assertFreshContext(browser, page.url(), jobName, answer);
    });
  }
});
