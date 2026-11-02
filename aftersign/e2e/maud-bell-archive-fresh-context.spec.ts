import { expect, test, type Browser, type Page } from "@playwright/test";

// #2651 fail-to-pass: Maud's Bell Archive selection is a durable Act II
// terminal result. After the player taps a visible name button, a fresh
// browser context (no storage, no cookies) on the same `?slot=` must
// render the saved Act II ending card and NO name-choice buttons.
//
// On main the selection lived only in `state.interaction` and was never
// persisted, so the returning context shows no ending card — this spec
// fails there and passes once `story.maudBellArchiveEndingId` is saved
// (runtime/persistence.js) and restored (main.js boot + lineForBeat).
//
// Taps only: every step is a `.tap()` on a visible element. The spec
// never reads or calls `window.__game`.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({
    timeout: WAIT_MS,
  });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page.locator(
    `button[data-choice-id="${choiceId}"]:not([disabled])`,
  );
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.tap();
}

async function tapVisible(page: Page, selector: string): Promise<void> {
  const target = page.locator(selector);
  await expect(target).toBeVisible({ timeout: WAIT_MS });
  await target.tap();
}

async function reachOrraPayback(page: Page): Promise<void> {
  await waitForBeat(page, "packet-offered");
  await tapVisible(page, '#offeredJobs button[data-offered-job-id="job-safe-delivery"]');
  await tapVisible(page, "#packetButton");
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
  await tapVisible(page, 'button[data-return-reason="blunt"]:not([disabled])');
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
  await tapChoice(page, "accept-second-packet");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-offered");
  await tapVisible(page, '#offeredJobs button[data-offered-job-id="job-night-transfer"]');
  await tapVisible(page, "#packetButton");
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
}

async function openFreshContext(browser: Browser, slot: string) {
  const context = await browser.newContext({
    viewport: PHONE_VIEWPORT,
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
  return { context, page };
}

const CASES = [
  { choice: "remembered-name", endingId: "maud-bell-archive-lit", light: "lit" },
  { choice: "archive-decoy", endingId: "maud-bell-archive-dark", light: "out" },
] as const;

test.describe("Maud Bell Archive ending survives a fresh context (#2651)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  for (const { choice, endingId, light } of CASES) {
    test(`tapping ${choice} restores ${endingId} with no name choices`, async ({
      page,
      browser,
    }) => {
      test.setTimeout(240_000);
      const slot = `maud-bell-archive-${choice}-${Date.now()}`;
      await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
      await reachOrraPayback(page);

      await tapVisible(
        page,
        'button[data-orra-payback-action="carry-name-to-bell-archive"]:not([disabled])',
      );

      const nameButton = page.locator(`button[data-maud-name-choice="${choice}"]`);
      await expect(nameButton).toBeVisible({ timeout: WAIT_MS });
      await nameButton.tap();

      const liveCard = page.locator(`[data-ending-id="${endingId}"]`);
      await expect(liveCard).toBeVisible({ timeout: WAIT_MS });
      await expect(liveCard).toHaveAttribute("data-district-light", light);

      // The authoritative write is async after the tap; retry the whole
      // fresh-context boot until the saved slot reflects the selection.
      await expect(async () => {
        const { context, page: returning } = await openFreshContext(browser, slot);
        try {
          const restoredCard = returning.locator(`[data-ending-id="${endingId}"]`);
          await expect(restoredCard).toBeVisible({ timeout: WAIT_MS });
          await expect(restoredCard).toHaveAttribute("data-district-light", light);
          await expect(restoredCard).toContainText("Act II — Bell Archive");
          await expect(returning.locator("[data-maud-name-choice]")).toHaveCount(0);
          await expect(returning.locator('[data-beat="maud-bell-archive"]')).toHaveCount(0);
        } finally {
          await context.close();
        }
      }).toPass({ timeout: 90_000, intervals: [1_000, 2_000, 5_000] });
    });
  }
});
