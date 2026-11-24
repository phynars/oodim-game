import { expect, test, type Browser, type Page } from "@playwright/test";

const WAIT = 15_000;

// Served phone playtest: uses only visible taps through both Niko outcomes.
test.describe("Niko Thread shortcut continuation (#2953)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  for (const [route, routeText, answer, answerText, door, jobName] of [
    // #2988: Niko names the authored first-run route label, not a class.
    ["safe", "You kept to Lit stair — under Io's window.", "take", "Take the shortcut", "keep-official-record", "The Ledger Run"],
    ["risky", "You took Cut past the bell rope.", "refuse", "Refuse the shortcut", "protect-private-lie", "The Quiet Envelope"],
    ["safe", "You kept to Lit stair — under Io's window.", "take", "Take the shortcut", "hang-new-sign", "The New Sign"],
  ] as const) {
    test(`names the ${route} route and ends ${jobName} after Niko ${answer}s`, async ({ page, browser }) => {
      test.setTimeout(240_000);
      const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      await page.goto(`/aftersign/?slot=niko-${route}-${token}&player=niko-${token}`, { waitUntil: "load" });
      await playToDoor(page, door);
      await tap(page, "#acceptEpisodeTwoJob:not([disabled])");
      const niko = page.locator("#nikoThread");
      await expect(niko).toBeVisible({ timeout: WAIT });
      await expect(niko).toHaveAttribute("data-npc", "niko-thread");
      await expect(niko.locator("[data-niko-route]")).toHaveAttribute("data-niko-route", route);
      await expect(niko).toContainText(routeText);
      const choice = page.locator(`[data-niko-shortcut-choice="${answer}"]`);
      await expect(choice).toHaveText(answerText);
      await choice.tap();
      const ending = page.locator('[data-ending-id="episode-two-act-one"]');
      await expect(ending).toBeVisible({ timeout: WAIT });
      await expect(ending).toContainText("Episode 2 — Act I");
      await expect(ending).toContainText(jobName);
      await expect(ending).toHaveAttribute("data-niko-shortcut-answer", answer);
      await expect(ending.locator('[data-npc="niko-thread"]')).toContainText(
        answer === "take" ? "registry clerk" : "long way",
      );
      const nextStep = ending.locator('[data-episode-two-next-step="current-content-ending"]');
      await expect(nextStep).toBeVisible();
      // The visible control must warn before the player taps into the end-of-content notice.
      await expect(nextStep).toHaveText("Episode 2 — Act I ends current content");
      await expect(nextStep).toBeEnabled();
      await nextStep.tap();
      const currentContent = page.locator('[data-episode-two-current-content="true"]');
      await expect(currentContent).toBeVisible();
      await expect(currentContent).toContainText("end of current content");
      // PR #3015 F1: lineForBeat() runs every frame; the message must survive
      // many frames, not just the first one after the tap.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            let frames = 30;
            const step = () => (--frames <= 0 ? resolve() : requestAnimationFrame(step));
            requestAnimationFrame(step);
          }),
      );
      await expect(currentContent).toBeVisible();
      await expect(page.locator('#episodeOneEnding [data-ending-id="episode-two-act-one"]')).toHaveCount(0);
      await expect(page.locator("#episodeOneEnding")).toHaveAttribute(
        "data-continuation",
        "episode-two-current-content",
      );
      const box = await currentContent.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y + box!.height).toBeLessThanOrEqual(844);
      const freshContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      });
      const freshPage = await freshContext.newPage();
      await freshPage.goto(page.url(), { waitUntil: "load" });
      const restoredEnding = freshPage.locator('[data-ending-id="episode-two-act-one"]');
      await expect(restoredEnding).toBeVisible({ timeout: WAIT });
      await expect(restoredEnding).toContainText(jobName);
      await expect(restoredEnding).toHaveAttribute("data-niko-shortcut-answer", answer);
      await freshContext.close();
      await expect(page.locator('#episodeOneEnding[data-continuation="night-post"]')).toHaveCount(0);
      await expect(page.locator("[data-niko-shortcut-choice]")).toHaveCount(0);
      const reset = page.locator("#resetButton");
      await expect(reset).toBeVisible();
      await expect(reset).toBeEnabled();
    });
  }
});

async function tap(page: Page, selector: string): Promise<void> {
  const control = page.locator(selector);
  await expect(control).toBeVisible({ timeout: WAIT });
  await control.tap();
}

async function beat(page: Page, id: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${id}"]`)).toBeVisible({ timeout: WAIT });
}

async function deliverOffered(page: Page, jobId: string, route?: "safe" | "risky"): Promise<void> {
  await beat(page, "packet-offered");
  await tap(page, `#offeredJobs button[data-offered-job-id="${jobId}"]`);
  await tap(page, "#packetButton");
  await beat(page, "packet-choice");
  if (route === "safe") {
    await tap(page, 'button[data-aftersign-tap-choice="take-the-long-way"]');
  } else if (route === "risky") {
    await tap(page, 'button[data-aftersign-tap-choice="take-the-long-way"]');
    const shortcut = page.locator('button[data-aftersign-tap-choice="take-the-shortcut"]');
    await expect(shortcut).toBeVisible({ timeout: WAIT });
    await expect(shortcut).toBeEnabled({ timeout: WAIT });
    await shortcut.tap();
  }
  await tap(page, 'button[data-choice-id="acknowledge-kiosk"]');
  await tap(page, 'button[data-choice-id="deliver-packet"]');
  await beat(page, "io-return-recognition");
}

async function playToDoor(page: Page, door: string): Promise<void> {
  const route = page.url().includes("niko-safe-") ? "safe" : "risky";
  await deliverOffered(page, "job-safe-delivery", route);
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
  await tap(page, `button[data-choice-id="${door}"]`);
  await tap(page, "#beginEpisodeTwo");
}
