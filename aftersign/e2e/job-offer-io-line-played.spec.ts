import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN #2544 — the trusted (sealed-packet) offer's Io line must be
// VISIBLE on the served page, inside `#offeredJobs`, as the
// `<p data-aftersign-job-offer-io-line>` row rendered by
// aftersign/main.js renderText() (packet-offered beat).
//
// Proven by real taps on one slot — no localStorage seeding, no
// `window.__game` state mutation (the only `window.__game` read is the
// scene-ready gate). Tap script mirrors
// `job-offer-route-risk-copy-played.spec.ts`, which already proves that
// this loop resolves the TRUSTED offer branch with the packet kept sealed.
//
// Copy strings are verbatim from
// `apps/web/src/aftersign/aftersignJobOfferCopy.js` (FIRST_RUN.ioLine /
// TRUSTED.ioLine) so a player-visible drift or an empty line reds this spec.

const WAIT_MS = 10_000;
const COLD_START_MS = 45_000;
const PHONE_VIEWPORT = { width: 375, height: 812 } as const;

const FIRST_RUN_IO_LINE =
  "Bring it back the way I gave it to you. Closed seal, open account.";
const TRUSTED_IO_LINE =
  "You brought my first seal home closed. I remember. Take the red tag to Saint Orra; I can risk your hands on a door that lies.";

const IO_LINE_SELECTOR = "#offeredJobs [data-aftersign-job-offer-io-line]";

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } })
        .__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(
    page.locator(`[data-beat-id="${beatId}"]`),
    `story line should visibly reach beat "${beatId}"`,
  ).toBeVisible({ timeout: WAIT_MS });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page
    .locator(`button[data-choice-id="${choiceId}"]:not([disabled])`)
    .first();
  await expect(
    choice,
    `choice "${choiceId}" should be visible and tappable`,
  ).toBeVisible({ timeout: WAIT_MS });
  await choice.click();
}

async function tapReturnReason(page: Page, reason: string): Promise<void> {
  const button = page
    .locator(`button[data-return-reason="${reason}"]:not([disabled])`)
    .first();
  await expect(
    button,
    `return-tone "${reason}" should be visible and tappable`,
  ).toBeVisible({ timeout: WAIT_MS });
  await button.click();
}

test.describe("AFTERSIGN job-offer Io line — played, sealed packet (#2544)", () => {
  test("the looped return after a sealed delivery shows Io's trusted offer line in the tray", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);
    await page.setViewportSize(PHONE_VIEWPORT);

    const slot = `job-offer-io-line-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    // FIRST VISIT — no delivery-outcome fact → firstRun ioLine visible.
    await waitForBeat(page, "packet-offered");
    const ioLine = page.locator(IO_LINE_SELECTOR);
    await expect(
      ioLine,
      "Io offer line must render inside the served #offeredJobs tray",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(ioLine).toHaveText(FIRST_RUN_IO_LINE, { timeout: WAIT_MS });

    // Play one full loop with the packet kept SEALED.
    await page.locator("#job-offer-job-safe-delivery").click();
    await page.locator("#packetButton").click();
    await waitForBeat(page, "packet-choice");
    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "io-return-recognition");
    await tapReturnReason(page, "blunt");
    await waitForBeat(page, "return-tone-choice");
    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");
    await tapChoice(page, "deliver-packet");

    // LOOPED RETURN — sealed fact in Io's memory → trusted branch.
    // The visible tray row must carry the trusted ioLine verbatim.
    await waitForBeat(page, "packet-offered");
    await expect(
      ioLine,
      "Io offer line must still render at the looped packet-offered",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(
      ioLine,
      "sealed-packet return must show Io's trusted offer line",
    ).toHaveText(TRUSTED_IO_LINE, { timeout: WAIT_MS });
    await expect(ioLine, "exactly one Io offer line in the tray").toHaveCount(1);

    // Phone-fit (#2545 F1): the long trusted line must wrap inside the
    // phone viewport, and must not widen the tray's other rows.
    for (const selector of [
      IO_LINE_SELECTOR,
      "#offeredJobs [data-aftersign-job-offer-route-risk]",
    ]) {
      const rect = await page.locator(selector).first().evaluate((element) => {
        const { left, right, width } = element.getBoundingClientRect();
        return { left, right, width };
      });
      expect(rect.width, `${selector} must have width`).toBeGreaterThan(0);
      expect(rect.left, `${selector} left edge on-screen`).toBeGreaterThanOrEqual(0);
      expect(rect.right, `${selector} right edge inside phone`).toBeLessThanOrEqual(
        PHONE_VIEWPORT.width,
      );
    }

    // Replacement, not accumulation: the firstRun line is gone.
    await expect(
      page.locator(IO_LINE_SELECTOR, { hasText: FIRST_RUN_IO_LINE }),
      "firstRun Io line must NOT render on the sealed return",
    ).toHaveCount(0);
  });
});
