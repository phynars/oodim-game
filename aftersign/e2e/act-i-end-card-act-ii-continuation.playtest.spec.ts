import { expect, test, type Page } from "@playwright/test";

const WAIT = 15_000;
// Each test plays ~20 s on the head. Keep the cap tight: the fail-to-pass gate
// runs these against main (where the Act II control does not exist) with
// --retries=1, and a 240 s cap per attempt overran that job's 25-minute limit.
const TEST_TIMEOUT = 90_000;
const CONTINUE_TO_ACT_TWO = '[data-episode-two-next-step="act-two-continuation"]';

test.describe("Act I end-card Act II continuation (#3054)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("shows and taps Continue to Act II from the Act I ending card at 390x844", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    const id = Date.now();
    await page.goto(`/aftersign/?slot=act-two-control-${id}&player=e2e-${id}`, { waitUntil: "load" });
    await playToActOneEnd(page, "take");
    const continueButton = page.getByRole("button", { name: "Continue to Act II" });
    await tapVisible(page, continueButton);

    await expect(page.locator('[data-act-two-opening-id="episode-two-act-two-take-opening"]')).toBeVisible({ timeout: WAIT });
  });

  for (const answer of ["take", "refuse"] as const) {
    test(`opens the ${answer} Act II card from the visible continuation control`, async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);
      const id = Date.now();
      await page.goto(`/aftersign/?slot=act-two-${answer}-${id}&player=e2e-${id}`, { waitUntil: "load" });
      await playToActOneEnd(page, answer);
      await tap(page, CONTINUE_TO_ACT_TWO);
      const opening = page.locator(`[data-act-two-opening-id="episode-two-act-two-${answer}-opening"]`);
      await expect(opening).toBeVisible({ timeout: WAIT });
      await expect(opening).toContainText("Act II");
      await expectVisibleInViewport(page, opening);
      const uncertainAnswer = opening.getByRole("button", { name: "I don't know." });
      const confidentAnswer = opening.getByRole("button", { name: /I know where to begin/ });
      await expect(uncertainAnswer).toBeVisible({ timeout: WAIT });
      await expect(confidentAnswer).toBeVisible({ timeout: WAIT });
      const selectedAnswer = answer === "take" ? confidentAnswer : uncertainAnswer;
      const selectedAnswerCopy = answer === "take"
        ? "I know where to begin."
        : "I don't know.";
      await tapVisible(page, selectedAnswer);
      const childResponse = opening.locator('[data-unaddressed-child-response="true"]');
      await expect(childResponse).toContainText(
        answer === "take"
          ? "Then show me the first door."
          : "Then we begin by listening together.",
      );
      await expect(opening.locator('[data-act-two-continuation="to-be-continued"]')).toHaveText("To be continued — this chapter is complete.");
      const review = opening.getByRole("button", { name: "Review this chapter" });
      await tapVisible(page, review);
      await expect(opening.getByRole("button", { name: `Chapter review: Shortcut answer: ${answer}. Your answer: ${selectedAnswerCopy}` })).toBeVisible({ timeout: WAIT });
      const endCard = opening.locator('[data-act-two-end-card="true"]');
      await expect(endCard).toContainText(`Shortcut answer: ${answer}`);
      await expect(endCard).toContainText("Where do you begin?");
      await expect(endCard).toContainText(selectedAnswerCopy);
      await expectVisibleInViewport(page, childResponse);
      await expectVisibleInViewport(page, endCard);

      // A new browser context has no in-memory game state, so this distinguishes
      // slot restoration from reusing the original page's in-memory state.
      const restoredContext = await page.context().browser()!.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      });
      const restoredPage = await restoredContext.newPage();
      await restoredPage.goto(`/aftersign/?slot=act-two-${answer}-${id}&player=e2e-${id}`, { waitUntil: "load" });
      const restoredEndCard = restoredPage.locator('[data-act-two-end-card="true"]');
      await expect(restoredEndCard).toContainText(`Shortcut answer: ${answer}`, { timeout: WAIT });
      await expect(restoredEndCard).toContainText("Where do you begin?");
      await expect(restoredEndCard).toContainText(selectedAnswerCopy);
      await expectVisibleInViewport(restoredPage, restoredEndCard);
      await restoredContext.close();
    });
  }

  for (const answer of ["take", "refuse"] as const) {
    test(`restores each selected Act II opening after reload (${answer})`, async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);
      const id = Date.now();
      await page.goto(`/aftersign/?slot=act-two-reload-${answer}-${id}&player=e2e-${id}`, { waitUntil: "load" });
      await playToActOneEnd(page, answer);
      await tap(page, CONTINUE_TO_ACT_TWO);
      await expect(page.locator(`[data-act-two-opening-id="episode-two-act-two-${answer}-opening"]`)).toBeVisible({ timeout: WAIT });
      await page.reload({ waitUntil: "load" });
      await expect(page.locator(`[data-act-two-opening-id="episode-two-act-two-${answer}-opening"]`)).toBeVisible({ timeout: WAIT });
    });
  }
});

async function expectVisibleInViewport(page: Page, locator: ReturnType<Page["locator"]>): Promise<void> {
  await expect(locator).toBeVisible({ timeout: WAIT });
  await expect(locator).toBeInViewport({ ratio: 1 });
}

async function tapVisible(page: Page, control: ReturnType<Page["locator"]>): Promise<void> {
  await expectVisibleInViewport(page, control);
  await control.tap({ timeout: WAIT });
}

async function tap(page: Page, selector: string): Promise<void> {
  await tapVisible(page, page.locator(selector));
}

async function beat(page: Page, id: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${id}"]`)).toBeVisible({ timeout: WAIT });
}

async function deliverOffered(page: Page, jobId: string): Promise<void> {
  await beat(page, "packet-offered");
  await tap(page, `#offeredJobs button[data-offered-job-id="${jobId}"]`);
  await tap(page, "#packetButton");
  await beat(page, "packet-choice");
  await tap(page, 'button[data-choice-id="acknowledge-kiosk"]');
  await tap(page, 'button[data-choice-id="deliver-packet"]');
  await beat(page, "io-return-recognition");
}

async function playToActOneEnd(page: Page, answer: "take" | "refuse"): Promise<void> {
  await deliverOffered(page, "job-safe-delivery");
  await tap(page, 'button[data-return-reason="blunt"]:not([disabled])');
  await beat(page, "return-tone-choice");
  await tap(page, 'button[data-choice-id="ask-for-next-job"]');
  await beat(page, "io-next-job");
  await tap(page, 'button[data-choice-id="accept-second-packet"]');
  await tap(page, 'button[data-choice-id="deliver-packet"]');
  await deliverOffered(page, "job-night-transfer");
  await tap(page, 'button[data-orra-payback-action="carry-name-to-bell-archive"]');
  await tap(page, 'button[data-maud-name-choice="archive-decoy"]');
  await tap(page, 'button[data-choice-id="open-unlit-door"]');
  await tap(page, 'button[data-choice-id="keep-official-record"]');
  await tap(page, "#beginEpisodeTwo");
  await tap(page, "#acceptEpisodeTwoJob:not([disabled])");
  await tap(page, answer === "take" ? 'button[data-niko-shortcut-choice="take"]' : 'button[data-niko-shortcut-choice="refuse"]');
  // The Act I ending card must be on screen before any continuation tap.
  await expect(page.locator('[data-ending-id="episode-two-act-one"]')).toBeVisible({ timeout: WAIT });
}
