import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN M-LOOP served-surface played verification: proves the
// shipped `/aftersign/` surface, at `packet-offered`, renders a tray
// (`#offeredJobs`) with a tappable `button[data-offered-job-id]`, and
// that a real player tap advances the beat OUT of `packet-offered`.
//
// This spec is named `*playtest*.spec.ts` so it is picked up by
// `playtest-input-surface-guard.spec.ts`, which requires a visible
// player event (.tap / .click / .press). We satisfy that by tapping
// the first offered-job button and asserting the beat changes.
//
// Phone tap lane (`hasTouch: true`) mirrors the sibling played specs
// so the tap lands as a real touch on the same DOM node shipped
// main.js wires up.

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
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const raw = (
            window as unknown as { __game?: { scene?: { beat?: unknown } } }
          ).__game?.scene?.beat;
          return typeof raw === "string" ? raw : null;
        }),
      { timeout: WAIT_MS },
    )
    .toBe(beat);
}

test.describe("AFTERSIGN M-LOOP served-surface playtest verification", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("tapping an offered-job button advances the beat out of packet-offered", async ({
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

    // Played, not driven. Real tap on the shipped offered-job button.
    // Satisfies `playtest-input-surface-guard.spec.ts` (which requires
    // every `*playtest*.spec.ts` to include a visible player event),
    // and proves the tray's rendered button is actually tappable.
    await offer.tap();

    // Visible change after the tap: beat MUST leave `packet-offered`.
    // Any downstream beat is acceptable — this spec owns the
    // served-surface tappability promise, not the specific transition.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const raw = (
              window as unknown as { __game?: { scene?: { beat?: unknown } } }
            ).__game?.scene?.beat;
            return typeof raw === "string" ? raw : null;
          }),
        { timeout: WAIT_MS },
      )
      .not.toBe("packet-offered");
  });
});
