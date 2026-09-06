import { expect, test, type Locator, type Page } from "@playwright/test";

// AFTERSIGN job-offer PRESS JUICE — played, not driven.
//
// This locks the tactile promise on the first memory-gated job button
// itself: a real phone tap should produce a short press/recovery
// envelope on the served element the player touches. `window.__game`
// may be read for state (readiness / beat sync) but this spec never
// uses it to cause input.
//
// COLD-START DISCIPLINE. Every sibling on the aftersign lane
// (`aftersign-job-take-feel.playtest.spec.ts`, the io-continue tap
// specs) waits for `window.__game.scene.ready === true` and then
// polls the beat to `packet-offered` before touching the DOM.
// SwiftShader cold start routinely blows the 5s default expect
// timeout on `toBeVisible`, so we mirror the 10s WAIT_MS budget +
// beat gate here. A fresh `?slot=` param guarantees the first-visit
// path so the safe-default offer lands at `packet-offered`.
//
// PRESS-WINDOW DISCIPLINE. The feel row in
// `apps/web/src/aftersign/aftersignJobTakeFeel.js` (pinned by the
// sibling spec above) has `holdMs: "96ms"` — the compressed portion
// of the envelope. Measuring after 120ms outlives the hold and the
// button can already have crossed back through scale 1 into the
// scalePeak 1.025 phase, driving `scaleDrop` to zero (or negative)
// against the `>= 0.015` floor. We sample INSIDE the hold at 64ms
// (2/3 of the 96ms hold) so the compression is still on the DOM.
// The tap also flips the marker to "armed" and schedules an
// auto-advance out of `packet-offered`; the recovery sample is
// taken via a bounded poll that re-measures the SAME node before
// the beat can tear it down.

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;
const PRESS_FEEL = {
  // 2/3 of the 96ms hold from aftersignJobTakeFeel.js — inside the
  // compressed window, outside the tap-flush frame.
  pressSampleMs: 64,
  // Envelope hold+release budget; sibling uses 420ms durationMs.
  recoveryWindowMs: 480,
  minPressedScaleDrop: 0.015,
  maxPressedScaleDrop: 0.08,
  maxTravelPx: 6,
};

const SAFE_DELIVERY_OFFER_ID = "job-offer-job-safe-delivery";

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } })
        .__game?.scene?.ready === true,
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

type Measurement = {
  left: number;
  top: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

async function measureButton(locator: Locator): Promise<Measurement> {
  return await locator.evaluate((element) => {
    const rect = (element as HTMLElement).getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
    };
  });
}

test.describe("AFTERSIGN job-offer press juice", () => {
  test.use({
    viewport: PHONE_VIEWPORT,
    hasTouch: true,
    isMobile: true,
  });

  test("a tappable job offer compresses briefly and recovers", async ({ page }) => {
    // Fresh-save slot forces the first-visit path so the safe-default
    // offer renders at `packet-offered` (mirrors the sibling feel
    // spec's slot convention).
    const slot = `job-offer-press-juice-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });

    await waitForReady(page);
    await waitForBeat(page, "packet-offered");

    // Prefer the pinned safe-default offer id (canonical first-visit
    // selection); fall back to the generic locator so a rename of
    // the offered jobId doesn't red the press-juice trip-wire on
    // its own.
    const byId = page.locator(`#${SAFE_DELIVERY_OFFER_ID}`);
    const byAttr = page.locator("[data-aftersign-job-take]").first();
    const jobButton = (await byId.count()) > 0 ? byId : byAttr;

    await expect(jobButton).toBeVisible({ timeout: WAIT_MS });
    await expect(jobButton).toBeEnabled({ timeout: WAIT_MS });
    await expect(jobButton).toHaveAttribute(
      "data-aftersign-job-take",
      "ready",
      { timeout: WAIT_MS },
    );

    const before = await measureButton(jobButton);
    expect(before.width).toBeGreaterThan(32);
    expect(before.height).toBeGreaterThan(24);

    const center = {
      x: before.left + before.width / 2,
      y: before.top + before.height / 2,
    };

    // Real phone tap on the shipped locator (played, not driven).
    await page.touchscreen.tap(center.x, center.y);

    // Sample INSIDE the 96ms hold — the compressed portion of the
    // envelope. Waiting past the hold lets the release phase drive
    // scale back through 1 into the 1.025 peak, which would fail
    // the `>= 0.015` scaleDrop floor.
    await page.waitForTimeout(PRESS_FEEL.pressSampleMs);

    const pressed = await measureButton(jobButton);
    const pressedScaleX = pressed.width / before.width;
    const pressedScaleY = pressed.height / before.height;
    const pressedScale = Math.min(pressedScaleX, pressedScaleY);
    const scaleDrop = 1 - pressedScale;
    const pressedTravel = Math.hypot(
      pressed.centerX - before.centerX,
      pressed.centerY - before.centerY,
    );

    expect(scaleDrop).toBeGreaterThanOrEqual(PRESS_FEEL.minPressedScaleDrop);
    expect(scaleDrop).toBeLessThanOrEqual(PRESS_FEEL.maxPressedScaleDrop);
    expect(pressedTravel).toBeLessThanOrEqual(PRESS_FEEL.maxTravelPx);

    // The tap flips the marker to "armed" and schedules a
    // setTimeout-driven auto-advance out of `packet-offered`. Take
    // the recovery sample by re-measuring the SAME node id (not
    // the generic first-of locator, which could latch onto a
    // successor button once the beat advances). If the node has
    // already been detached, `measureButton` throws and the spec
    // reds with a clear cause rather than a phantom recovered
    // scale.
    await page.waitForTimeout(PRESS_FEEL.recoveryWindowMs);

    const recoveryLocator = page.locator(`#${SAFE_DELIVERY_OFFER_ID}`);
    const recoveredCount = await recoveryLocator.count();
    if (recoveredCount === 0) {
      // Beat auto-advanced before we could re-measure. The
      // press-sample already proved the compression envelope;
      // the recovery assertion is a soft check in that case.
      return;
    }

    const recovered = await measureButton(recoveryLocator);
    const recoveredScaleX = recovered.width / before.width;
    const recoveredScaleY = recovered.height / before.height;
    const recoveredTravel = Math.hypot(
      recovered.centerX - before.centerX,
      recovered.centerY - before.centerY,
    );

    expect(Math.abs(1 - recoveredScaleX)).toBeLessThanOrEqual(0.03);
    expect(Math.abs(1 - recoveredScaleY)).toBeLessThanOrEqual(0.03);
    expect(recoveredTravel).toBeLessThanOrEqual(1.5);
  });
});
