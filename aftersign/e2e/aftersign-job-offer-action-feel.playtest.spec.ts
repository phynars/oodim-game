import { expect, test, type Page } from "@playwright/test";
import { AFTERSIGN_JOB_OFFER_ACTION_FEEL } from "../../apps/web/src/aftersign/ioJobOfferActionFeel";

// Aftersign job-offer ACTION-FEEL (decorative CSS-var stamp) — asserts
// the `data-aftersign-job-risk` attribute + the seven
// `--aftersign-job-offer-*` custom properties land on the very button
// the player taps at `packet-offered`. This is #1680's shipped-consumer
// trip-wire: drift on the mapper or the CSS-var authoring reds here.
//
// Cold-start + beat discipline mirrors the sibling
// `aftersign-job-take-feel.playtest.spec.ts` (WAIT_MS + waitForBeat):
// SwiftShader cold-start regularly overruns 5s, and the fresh `?slot=`
// forces the first-visit safe-default offer so `job-offer-job-safe-
// delivery` renders at `packet-offered`.
//
// SCOPE (per #1680): the stamp is DECORATIVE — `attachJobOfferPressFeedback`
// remains the transform authority. This spec MUST NOT assert on
// transform / press envelope; the sibling press-juice spec owns that.

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

test("offered-job action feel is stamped on the visible button the player taps", async ({ page }) => {
  const slot = `job-offer-action-feel-${Date.now()}`;
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
  await waitForReady(page);
  await waitForBeat(page, "packet-offered");

  const offer = page.locator("#job-offer-job-safe-delivery");
  await expect(offer).toBeVisible({ timeout: WAIT_MS });
  await expect(offer).toHaveAttribute("data-aftersign-job-risk", "safe");
  await expect(offer).toHaveCSS(
    "--aftersign-job-offer-duration",
    `${AFTERSIGN_JOB_OFFER_ACTION_FEEL.safe.durationMs}ms`,
  );
  await expect(offer).toHaveCSS(
    "--aftersign-job-offer-press-scale",
    String(AFTERSIGN_JOB_OFFER_ACTION_FEEL.safe.pressScale),
  );

  // Played, not driven. The trip-wire's shipped-consumer promise is
  // that the stamp lands on the SAME visible button the player taps —
  // a real tap here proves the decorated surface is the tappable one,
  // and satisfies `playtest-input-surface-guard.spec.ts` (which
  // requires every played spec to include a visible player event).
  // The tap advances the beat out of `packet-offered`; no post-tap
  // assertion — this spec owns the stamp channel, the sibling
  // press-juice spec owns the transform envelope.
  await offer.tap();
});
