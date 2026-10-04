import { expect, test, type Page } from "@playwright/test";

// The job offer is the first player commitment in a round. This is deliberately
// played through the visible phone target: __game is read only to prove that
// the tap was not swallowed while the offer surface rerendered.
const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 60_000;

type Snapshot = {
  scene?: { ready?: boolean; beat?: string };
};

declare global {
  interface Window {
    __game?: {
      getSnapshot?: () => Snapshot;
    };
  }
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect
    .poll(
      () => page.evaluate(() => window.__game?.getSnapshot?.().scene?.beat),
      { timeout: WAIT_MS, intervals: [100, 250, 500, 1000] },
    )
    .toBe(beat);
}

test.describe("AFTERSIGN job offer advances by phone tap", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a visible offered job tap reaches packet choice", async ({ page }) => {
    test.setTimeout(90_000);
    const slot = `job-offer-advance-${Date.now()}`;

    await page.goto(`/aftersign/index.html?slot=${slot}`, { waitUntil: "load" });
    await expect
      .poll(
        () => page.evaluate(() => window.__game?.getSnapshot?.().scene?.ready === true),
        { timeout: WAIT_MS },
      )
      .toBe(true);
    await waitForBeat(page, "packet-offered");

    const offer = page.locator("button[data-offered-job-id]").first();
    await expect(offer).toBeVisible({ timeout: WAIT_MS });
    await expect(offer).toBeEnabled({ timeout: WAIT_MS });

    // The browser-real 44 CSS-pixel rendered-target contract is owned by
    // `aftersign/e2e/packet-button-touch-target.contract.spec.ts`.
    //
    // Player sequence out of `packet-offered`, as proven by the sibling
    // specs `aftersign-mloop-playtest-verification.spec.ts` and
    // `m-loop-save-persistence.spec.ts`:
    //   (1) Tap an offered job — SELECTS the job but does not itself
    //       leave `packet-offered`.
    //   (2) Tap `#packetButton` — advances the beat to `packet-choice`.
    // This playtest keeps the player outcome end-to-end: a visible phone
    // tap on an actual offered job, followed by the packet-button tap,
    // must reach the packet-choice surface.
    await offer.tap();
    // Selection is intentionally distinct from confirmation: the first tap
    // must retain the offer beat so the player can inspect the job before
    // committing with the packet button.
    await waitForBeat(page, "packet-offered");

    const packetButton = page.locator("#packetButton");
    await expect(packetButton).toBeVisible({ timeout: WAIT_MS });
    await expect(packetButton).toBeEnabled({ timeout: WAIT_MS });
    await packetButton.tap();

    await waitForBeat(page, "packet-choice");
    await expect(page.locator("[data-aftersign-route-risk-surface]")).toBeVisible({
      timeout: WAIT_MS,
    });
  });
});
