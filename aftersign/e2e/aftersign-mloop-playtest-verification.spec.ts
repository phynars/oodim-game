import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN M-LOOP served-surface played verification: proves the
// shipped `/aftersign/` surface, at `packet-offered`, renders a tray
// (`#offeredJobs`) with a tappable `button[data-offered-job-id]`, and
// that the full player-driven advance path OUT of `packet-offered`
// works end-to-end on the served surface.
//
// What the offered-job tap actually does (confirmed from the sibling
// spec `aftersign/e2e/m-loop-save-persistence.spec.ts`, lines 55-58):
// tapping `button[data-offered-job-id]` SELECTS a job but does not
// itself leave `packet-offered`. The subsequent tap on `#packetButton`
// is what advances the beat to `packet-choice`. This spec drives both
// taps — the offered-job selection is the real player event this
// filename promises, and the follow-on `#packetButton` tap gives us a
// concrete observable (the beat reaches `packet-choice`) to assert.
//
// This spec is named `*playtest*.spec.ts` so it is picked up by
// `playtest-input-surface-guard.spec.ts`, which requires a visible
// player event (.tap / .click / .press). Both taps below satisfy that.
//
// Phone tap lane (`hasTouch: true`) mirrors the sibling played specs
// so taps land as real touches on the DOM nodes shipped main.js wires.

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game
        ?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beat}"]`)).toBeVisible({
    timeout: WAIT_MS,
  });
}

async function tap(page: Page, selector: string): Promise<void> {
  const control = page.locator(selector).first();
  await expect(control).toBeVisible({ timeout: WAIT_MS });
  await expect(control).toBeEnabled({ timeout: WAIT_MS });
  await control.tap();
}

test.describe("AFTERSIGN M-LOOP served-surface playtest verification", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("tapping an offered-job then #packetButton advances the beat to packet-choice", async ({
    page,
  }) => {
    await page.goto(`/aftersign/?slot=mloop-verification-${Date.now()}`, {
      waitUntil: "load",
    });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");

    const tray = page.locator("#offeredJobs");
    await expect(tray).toBeVisible({ timeout: WAIT_MS });

    const offer = tray.locator("button[data-offered-job-id]").first();
    await expect(offer).toBeVisible({ timeout: WAIT_MS });
    await expect(offer).toBeEnabled({ timeout: WAIT_MS });

    // (1) Real player tap on the shipped offered-job button. This is
    //     the SELECTION step — it does not itself leave `packet-offered`
    //     (see header). Satisfies `playtest-input-surface-guard` and
    //     proves the tray's rendered button is tappable + enabled.
    await offer.tap();

    // (2) Real player tap on `#packetButton`. This is the step the
    //     sibling save-persistence spec uses to leave `packet-offered`;
    //     it advances the beat to `packet-choice`.
    await tap(page, "#packetButton");

    // Visible, handler-defined outcome: the beat MUST reach
    // `packet-choice`. This is the actual transition the shipped
    // handler produces for the offered-job + packet-button sequence.
    await waitForBeat(page, "packet-choice");
  });
});
