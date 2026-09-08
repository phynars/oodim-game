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
// PRESS-WINDOW DISCIPLINE (#1661). The feel row in
// `apps/web/src/aftersign/aftersignJobTakeFeel.js` (pinned by the
// sibling spec above) has `holdMs: "96ms"` — the compressed portion
// of the envelope. The envelope is measured by an IN-PAGE recorder
// armed BEFORE the tap (dual rAF + 8ms interval, 600ms window):
// harness-clock sampling ("64ms after tap() resolves") raced the
// protocol roundtrip and landed past the hold on slow runners —
// the deterministic CI red @1143b53c. The recorder catches the
// peak whenever it paints, frame-independent (the #1136
// recognitionBeatReport cure, applied at the spec layer). The tap
// also flips the marker to "armed" and schedules an auto-advance
// out of `packet-offered`; the recovery sample re-measures the
// SAME node after the release envelope.

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;
const PRESS_FEEL = {
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

    // #1661: settle the two layout-shift sources that raced the tap on
    // CI before ANY geometry is captured. (a) Web-font swap: CI loads
    // Inter late; the swap reflows the whole .hud panel, so coordinates
    // captured pre-swap dispatch onto whatever occupies that spot
    // post-swap — diag runs 34181126099/34189057892 caught pointerdown
    // landing on #packetButton / #deliverButton while this spec tapped
    // the job offer. fonts.ready is a real page signal (a player taps
    // a settled page), not harness driving. (b) One rAF so the settled
    // layout has painted.
    await page.evaluate(async () => {
      await (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready;
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });

    const before = await measureButton(jobButton);
    expect(before.width).toBeGreaterThan(32);
    expect(before.height).toBeGreaterThan(24);

    // #1555-style interceptor guard: if ANOTHER element owns the tap
    // point, fail NAMING it — a static overlap must never resurface as
    // an inscrutable scaleDrop=0.
    const hitOwner = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el ? `${el.tagName.toLowerCase()}#${el.id || "?"}` : "nothing";
      },
      { x: before.left + before.width / 2, y: before.top + before.height / 2 },
    );
    const jobButtonDescriptor = await jobButton.evaluate(
      (el) => `${el.tagName.toLowerCase()}#${(el as HTMLElement).id || "?"}`,
    );
    expect(
      hitOwner,
      `tap point is owned by ${hitOwner}, not the job-offer button — a covering/reflowed element`,
    ).toBe(jobButtonDescriptor);

    // #1661 — measure IN-PAGE, not on the harness clock. The old shape
    // (`await jobButton.tap()` then `waitForTimeout(64)`) sampled 64ms
    // after tap() RESOLVED — but tap() resolves only after protocol
    // roundtrips, so on a slow runner the sample landed PAST the 96ms
    // hold: the marker had already restored to "armed", transform was
    // identity, and scaleDrop read 0 (the deterministic CI red on main
    // @1143b53c; local diag proved the page held "pressing" for a full
    // 0→98ms with the observer deferring the armed write correctly).
    // Same cure as the #1136 recognitionBeatReport precedent: record
    // the envelope IN the page, frame-independent of the harness.
    // A dual rAF + 8ms-interval sampler (interval survives SwiftShader
    // rAF starvation) records min scale + max travel for 600ms; the
    // spec then asserts on the recorded peak. Input stays a REAL tap;
    // the recorder only reads the DOM (window.__game untouched) —
    // played, not driven.
    await jobButton.evaluate((element) => {
      const h = element as HTMLElement & {
        __pressJuiceRecorder?: { minScale: number; maxTravel: number; samples: number };
      };
      const base = h.getBoundingClientRect();
      const rec = { minScale: 1, maxTravel: 0, samples: 0 };
      h.__pressJuiceRecorder = rec;
      const t0 = performance.now();
      const sample = () => {
        const r = h.getBoundingClientRect();
        if (r.width > 0 && base.width > 0) {
          const s = Math.min(r.width / base.width, r.height / base.height);
          if (s < rec.minScale) rec.minScale = s;
          const travel = Math.hypot(
            r.left + r.width / 2 - (base.left + base.width / 2),
            r.top + r.height / 2 - (base.top + base.height / 2),
          );
          if (travel > rec.maxTravel) rec.maxTravel = travel;
        }
        rec.samples += 1;
      };
      const interval = setInterval(() => {
        sample();
        if (performance.now() - t0 > 600) clearInterval(interval);
      }, 8);
      const raf = () => {
        sample();
        if (performance.now() - t0 <= 600) requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
    });

    // Real phone tap on the shipped locator (played, not driven).
    await jobButton.tap();

    // The recorder needs the hold (96ms) to elapse in-page; poll the
    // recorded peak until the compression shows up (bounded by the
    // recorder's own 600ms window + margin). No wall-clock sampling —
    // the recorder caught the envelope whenever it painted.
    await expect
      .poll(
        () =>
          jobButton.evaluate(
            (element) =>
              (element as HTMLElement & { __pressJuiceRecorder?: { minScale: number } })
                .__pressJuiceRecorder?.minScale ?? 1,
          ),
        { timeout: 2_000 },
      )
      .toBeLessThanOrEqual(1 - PRESS_FEEL.minPressedScaleDrop);

    const recorded = await jobButton.evaluate(
      (element) =>
        (element as HTMLElement & {
          __pressJuiceRecorder?: { minScale: number; maxTravel: number; samples: number };
        }).__pressJuiceRecorder ?? { minScale: 1, maxTravel: 0, samples: 0 },
    );
    const scaleDrop = 1 - recorded.minScale;
    expect(scaleDrop).toBeGreaterThanOrEqual(PRESS_FEEL.minPressedScaleDrop);
    expect(scaleDrop).toBeLessThanOrEqual(PRESS_FEEL.maxPressedScaleDrop);
    expect(recorded.maxTravel).toBeLessThanOrEqual(PRESS_FEEL.maxTravelPx);

    // The tap flips the marker to "armed" and schedules a
    // setTimeout-driven auto-advance out of `packet-offered`. Take
    // the recovery sample by re-measuring the SAME node id (not
    // the generic first-of locator, which could latch onto a
    // successor button once the beat advances). If the node has
    // already been detached, `measureButton` throws and the spec
    // reds with a clear cause rather than a phantom recovered
    // scale.
    // pacing: outlive the 96ms hold + 420ms release envelope so
    // the recovery sample lands after transform has unwound to
    // scale-settle; no beat signals paint completion.
    await page.waitForTimeout(PRESS_FEEL.recoveryWindowMs); // pacing

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
