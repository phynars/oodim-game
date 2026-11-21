import { expect, test, type Page } from "@playwright/test";

// #2920: each Unlit Door choice decides a distinct Episode 2 job at the Night
// Post. Plays to it with visible taps at 390x844, accepts, reloads. Ids mirror
// aftersign/src/episodeTwoJobs.js EPISODE_TWO_JOBS.
const CASES = [
  ["keep-official-record", "ep2-ledger-run", "ep2-sealed-ledger"],
  ["protect-private-lie", "ep2-quiet-envelope", "ep2-unmarked-envelope"],
  ["hang-new-sign", "ep2-new-sign", "ep2-fresh-paint-sign"],
] as const;

test.describe("Door-decided Episode 2 jobs (#2920)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  for (const [door, jobId, deliveryId] of CASES) {
    test(`plays and reloads ${jobId} after ${door}`, async ({ page }) => {
      test.setTimeout(240_000);
      const n = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      await page.goto(`/aftersign/?slot=door-job-${door}-${n}&player=e2e-${n}`, { waitUntil: "load" });
      await playToDoor(page, door);

      const job = page.locator(`#episodeTwoJob[data-episode-two-job-id="${jobId}"]`);
      await expect(job).toBeVisible({ timeout: WAIT });
      await tap(page, "#acceptEpisodeTwoJob:not([disabled])");
      await expect(job).toHaveAttribute("data-episode-two-delivery-id", deliveryId);

      await page.reload({ waitUntil: "load" });
      await expect(job).toBeVisible({ timeout: WAIT });
      await expect(job).toHaveAttribute("data-episode-two-delivery-id", deliveryId);
      await expect(page.locator("#acceptEpisodeTwoJob")).toBeDisabled();
    });
  }
});

const WAIT = 15_000;

async function tap(page: Page, selector: string): Promise<void> {
  const control = page.locator(selector);
  await expect(control).toBeVisible({ timeout: WAIT });
  await control.tap();
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

async function playToDoor(page: Page, door: string): Promise<void> {
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
  await tap(page, `button[data-choice-id="${door}"]`);
  await tap(page, "#beginEpisodeTwo");
}
