import { expect, test, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

type JobCase = {
  doorChoice: string;
  jobId: string;
};

const CASES: readonly JobCase[] = [
  { doorChoice: "keep-official-record", jobId: "ep2-ledger-run" },
  { doorChoice: "protect-private-lie", jobId: "ep2-quiet-envelope" },
  { doorChoice: "hang-new-sign", jobId: "ep2-new-sign" },
];

function ids(tag: string) {
  const nonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return { player: `e2e-${nonce}`, slot: `door-job-${tag}-${nonce}` };
}

async function tapVisible(page: Page, selector: string): Promise<void> {
  const control = page.locator(selector);
  await expect(control).toBeVisible({ timeout: WAIT_MS });
  await control.tap();
}

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({ timeout: WAIT_MS });
}

async function chooseDoor(page: Page, doorChoice: string): Promise<void> {
  await waitForBeat(page, "packet-offered");
  await tapVisible(page, '#offeredJobs button[data-offered-job-id="job-safe-delivery"]');
  await tapVisible(page, "#packetButton");
  await waitForBeat(page, "packet-choice");
  await tapVisible(page, 'button[data-choice-id="acknowledge-kiosk"]');
  await tapVisible(page, 'button[data-choice-id="deliver-packet"]');
  await waitForBeat(page, "io-return-recognition");
  await tapVisible(page, 'button[data-return-reason="blunt"]:not([disabled])');
  await waitForBeat(page, "return-tone-choice");
  await tapVisible(page, 'button[data-choice-id="ask-for-next-job"]');
  await waitForBeat(page, "io-next-job");
  await tapVisible(page, 'button[data-choice-id="accept-second-packet"]');
  await tapVisible(page, 'button[data-choice-id="deliver-packet"]');
  await waitForBeat(page, "packet-offered");
  await tapVisible(page, '#offeredJobs button[data-offered-job-id="job-night-transfer"]');
  await tapVisible(page, "#packetButton");
  await waitForBeat(page, "packet-choice");
  await tapVisible(page, 'button[data-choice-id="acknowledge-kiosk"]');
  await tapVisible(page, 'button[data-choice-id="deliver-packet"]');
  await waitForBeat(page, "io-return-recognition");
  await tapVisible(page, 'button[data-orra-payback-action="carry-name-to-bell-archive"]');
  await tapVisible(page, 'button[data-maud-name-choice="archive-decoy"]');
  await tapVisible(page, 'button[data-choice-id="open-unlit-door"]');
  await tapVisible(page, `button[data-choice-id="${doorChoice}"]`);
  await tapVisible(page, "#beginEpisodeTwo");
}

test.describe("Door-decided Episode 2 jobs (#2920)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  for (const c of CASES) {
    test(`plays and reloads ${c.jobId} after choosing ${c.doorChoice}`, async ({ page }) => {
      test.setTimeout(240_000);
      const { player, slot } = ids(c.doorChoice);
      await page.goto(`/aftersign/?slot=${slot}&player=${player}`, { waitUntil: "load" });
      await chooseDoor(page, c.doorChoice);

      const job = page.locator(`#episodeTwoJob[data-episode-two-job-id="${c.jobId}"]`);
      await expect(job).toBeVisible({ timeout: WAIT_MS });
      await tapVisible(page, "#acceptEpisodeTwoJob:not([disabled])");
      await expect(job).toHaveAttribute("data-episode-two-delivery-id", /ep2-/);

      await page.reload({ waitUntil: "load" });
      await expect(page.locator(`#episodeTwoJob[data-episode-two-job-id="${c.jobId}"]`)).toBeVisible({ timeout: WAIT_MS });
      await expect(page.locator("#acceptEpisodeTwoJob")).toBeDisabled();
    });
  }
});
