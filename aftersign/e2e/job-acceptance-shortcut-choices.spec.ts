import { expect, test, type Page } from "@playwright/test";

const WAIT = 15_000;

test.describe("Episode 2 accepted job shortcut choices (#3049)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("accepting an Episode 2 job shows Accepted before route selection", async ({ page }) => {
    test.setTimeout(240_000);
    await openNightPost(page, "acknowledged-job");
    const accept = page.locator("#acceptEpisodeTwoJob:not([disabled])");
    await expect(accept).toBeVisible({ timeout: WAIT });
    await accept.tap();
    await expect(page.locator("#acceptEpisodeTwoJob")).toHaveText("Accepted");
    await expect(page.locator("#episodeTwoJob[data-episode-two-accepted-job-id]")).toBeVisible();
    await expect(page.locator("[data-niko-shortcut-choice]")).toHaveCount(2);
  });

  test("accepted job exposes separate visible shortcut controls", async ({ page }) => {
    test.setTimeout(240_000);
    await openNightPost(page, "separate-shortcuts");
    await page.locator("#acceptEpisodeTwoJob:not([disabled])").tap();
    const choices = page.locator("button[data-niko-shortcut-choice]");
    await expect(choices).toHaveCount(2);
    await expect(choices.nth(0)).toBeVisible();
    await expect(choices.nth(1)).toBeVisible();
    await expect(choices.nth(0)).toBeEnabled();
    await expect(choices.nth(1)).toBeEnabled();
  });

  test("tapping Accept brings both shortcut choices into the 390x844 viewport without a swipe", async ({ page }) => {
    // M7 closeout runs 63636847 and 52bb9de5: after Accept The Ledger Run,
    // nothing visibly changed until the player swiped.
    test.setTimeout(240_000);
    await openNightPost(page, "accept-reveals-shortcuts");
    await page.locator("#acceptEpisodeTwoJob:not([disabled])").tap();
    const choices = page.locator("button[data-niko-shortcut-choice]");
    await expect(choices).toHaveCount(2);
    await expect(choices.nth(0)).toBeInViewport({ ratio: 1, timeout: WAIT });
    await expect(choices.nth(1)).toBeInViewport({ ratio: 1, timeout: WAIT });
  });

  test("tapping a shortcut selects only the tapped action", async ({ page }) => {
    test.setTimeout(240_000);
    await openNightPost(page, "single-selection");
    await page.locator("#acceptEpisodeTwoJob:not([disabled])").tap();
    await page.locator('[data-niko-shortcut-choice="take"]').tap();
    const selected = page.locator('[data-ending-id="episode-two-act-one"][data-niko-shortcut-selected="true"]');
    await expect(selected).toHaveCount(1);
    await expect(selected).toHaveAttribute("data-niko-shortcut-answer", "take");
    await expect(selected).toContainText("Carried: The Ledger Run.");
    await expect(page.locator("#acceptEpisodeTwoJob")).toHaveCount(0);
  });

  test("restoring accepted job without shortcut has no selected shortcut", async ({ page }) => {
    test.setTimeout(240_000);
    await openNightPost(page, "restore-no-selection");
    await page.locator("#acceptEpisodeTwoJob:not([disabled])").tap();
    await expect(page.locator("#acceptEpisodeTwoJob")).toHaveText("Accepted");
    await page.reload({ waitUntil: "load" });
    await expect(page.locator("#acceptEpisodeTwoJob")).toHaveText("Accepted", { timeout: WAIT });
    await expect(page.locator("button[data-niko-shortcut-choice]")).toHaveCount(2);
    await expect(page.locator('[data-niko-shortcut-selected="true"]')).toHaveCount(0);
    await expect(page.locator('button[data-niko-shortcut-choice][aria-pressed="true"]')).toHaveCount(0);
  });

  test("Start fresh clears the accepted job so a replayed Night Post is unaccepted", async ({ page }) => {
    test.setTimeout(360_000);
    await openNightPost(page, "start-fresh-clears-accept");
    await page.locator("#acceptEpisodeTwoJob:not([disabled])").tap();
    await expect(page.locator("#acceptEpisodeTwoJob")).toHaveText("Accepted");

    const reset = page.locator(".slice-save-controls #resetButton");
    await expect(reset).toBeVisible({ timeout: WAIT });
    await reset.tap();
    await expect(reset).toHaveText("Confirm start fresh");
    await reset.tap();
    await expect(page.locator('[data-beat-id="packet-offered"]')).toBeVisible({ timeout: WAIT });
    // The live story state the next save persists must have dropped the id.
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as {
              __game?: { getSnapshot(): { story?: { episodeTwoAcceptedJobId?: string | null } } };
            }).__game?.getSnapshot().story?.episodeTwoAcceptedJobId ?? null,
        ),
      )
      .toBeNull();
    // Reload so the replay boots from the post-reset save: a stale in-memory
    // episodeTwoAcceptedJobId would have been re-persisted and restored here.
    await page.reload({ waitUntil: "load" });

    await playToNightPost(page);
    const accept = page.locator("#acceptEpisodeTwoJob");
    await expect(accept).not.toHaveText("Accepted");
    await expect(accept).toBeEnabled();
    await expect(page.locator("#episodeTwoJob[data-episode-two-accepted-job-id]")).toHaveCount(0);
    await expect(page.locator("[data-niko-shortcut-choice]")).toHaveCount(0);
  });
});

async function tap(page: Page, selector: string): Promise<void> {
  const control = page.locator(selector);
  await expect(control).toBeVisible({ timeout: WAIT });
  await control.tap();
}

async function openNightPost(page: Page, scenario: string): Promise<void> {
  const token = `${scenario}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  await page.goto(`/aftersign/?slot=${token}&player=${token}`, { waitUntil: "load" });
  await playToNightPost(page);
}

async function playToNightPost(page: Page): Promise<void> {
  await deliverOffered(page, "job-safe-delivery");
  await tap(page, 'button[data-return-reason="blunt"]:not([disabled])');
  await tap(page, 'button[data-choice-id="ask-for-next-job"]');
  await tap(page, 'button[data-choice-id="accept-second-packet"]');
  await tap(page, 'button[data-choice-id="deliver-packet"]');
  await deliverOffered(page, "job-night-transfer");
  await tap(page, 'button[data-orra-payback-action="carry-name-to-bell-archive"]');
  await tap(page, 'button[data-maud-name-choice="archive-decoy"]');
  await tap(page, 'button[data-choice-id="open-unlit-door"]');
  await tap(page, 'button[data-choice-id="keep-official-record"]');
  await tap(page, "#beginEpisodeTwo");
  await expect(page.locator("#acceptEpisodeTwoJob")).toBeVisible({ timeout: WAIT });
}

async function deliverOffered(page: Page, jobId: string): Promise<void> {
  await tap(page, `#offeredJobs button[data-offered-job-id="${jobId}"]`);
  await tap(page, "#packetButton");
  const routeChoices = page.locator("#routeRiskChoice button[data-aftersign-tap-choice]");
  await expect(routeChoices.first()).toBeVisible({ timeout: WAIT });
  await routeChoices.first().tap();
  await tap(page, 'button[data-choice-id="acknowledge-kiosk"]');
  await tap(page, 'button[data-choice-id="deliver-packet"]');
}
