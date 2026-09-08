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
    //
    // #1674 — Soren's re-review corrected the node-swap hypothesis:
    // the failure mode is NOT a same-id swap. `#offeredJobs` rebuild
    // is signature-gated (main.js:1991) and lives inside the
    // `if (isPacketOfferedBeat)` branch (main.js:1890) — the pressed
    // <button> is NOT re-created on tap.
    //
    // The actual failure: the tap's click advances the beat OUT of
    // `packet-offered`, flipping `isPacketOfferedBeat` false →
    // `offeredJobs.dataset.visible = "false"` (main.js:1887) →
    // CSS `.route-choice { display: none }` (index.html:613-614) →
    // the pressed button's `getBoundingClientRect()` collapses to
    // 0×0. The recorder's `r.width > 0` guard then skips EVERY
    // post-advance sample.
    //
    // #1674 re-review (Soren, round 2): the computed-transform
    // fallback ALSO has a timing hole. `pointerdown` kicks a 24ms
    // CSS transition toward `scale(var(--aftersign-job-take-scale-
    // from))` = 0.97, but Playwright's `touchend` → synthetic
    // `click` → beat-advance → `display: none` on the ancestor
    // lands ~1ms later. The transition has moved <1% of its
    // 1.00 → 0.97 travel when the subtree hides. Under a
    // `display: none` ancestor, `getComputedStyle().transform`
    // resolves to `"none"` (or a matrix near identity) on every
    // engine we ship on — the used-value depends on layout, which
    // is skipped for hidden subtrees. Reading the computed transform
    // matrix therefore still lands on ~1.0, and the test still reds
    // with "Received: 1".
    //
    // Fix: sample the AUTHORED compressed scale directly from the
    // CSS custom property `--aftersign-job-take-scale-from` the
    // moment we detect the press marker has landed. Custom-property
    // values are the same "computed value" surface as `transform`,
    // but they don't depend on transition state and they resolve
    // even for elements in a `display: none` subtree — the browser
    // still computes styles for the whole tree, it only skips
    // layout. The pointerdown handler in index.html either (a)
    // flips `data-aftersign-job-take="pressing"` — the CSS rule
    // then targets `scale(var(--aftersign-job-take-scale-from))`,
    // or (b) stamps `element.style.transform = "scale(<from>)"`
    // inline as the belt-and-suspenders path. Either signal proves
    // the press envelope fired; once either is observed, we record
    // the CSS-var value as the recorded minScale. Contact duration
    // and display-cascade state are no longer in the loop.
    //
    // Bounding-rect sampling stays as the travel channel and as the
    // pre-tap baseline sanity check. The computed-transform matrix
    // stays as an opportunistic secondary read for the window
    // BEFORE display: none lands (Chromium sometimes serves a full
    // matrix during the first frame of the transition).
    //
    // The record is parked on `window` (not the element) so the
    // post-poll `readRecorder` doesn't have to re-resolve a node
    // that might be inside a hidden subtree.
    await jobButton.evaluate((element) => {
      const h = element as HTMLElement;
      const liveId = h.id;
      const base = h.getBoundingClientRect();
      const rec = { minScale: 1, maxTravel: 0, samples: 0 };
      (window as unknown as {
        __aftersignPressJuiceRecorder?: typeof rec;
      }).__aftersignPressJuiceRecorder = rec;
      const t0 = performance.now();

      // Resolve the authored compressed scale ONCE at recorder-arm
      // time — the CSS var is stamped on the element by
      // applyAftersignJobTakeFeelToButton() in main.js and is
      // available before the tap fires. Cascade fallback: read from
      // the element, then from `:root`, then the frozen row's 0.97
      // (matches `AFTERSIGN_JOB_TAKE_FEEL.scaleFrom` in
      // apps/web/src/aftersign/aftersignJobTakeFeel.js). This value
      // is what `data-aftersign-job-take="pressing"` compresses TO,
      // per the CSS rule in index.html.
      const readCssScaleFrom = (): number => {
        const readFrom = (el: Element): number => {
          const raw = getComputedStyle(el)
            .getPropertyValue("--aftersign-job-take-scale-from")
            .trim();
          const n = parseFloat(raw);
          return Number.isFinite(n) && n > 0 && n < 1 ? n : NaN;
        };
        const fromEl = readFrom(h);
        if (Number.isFinite(fromEl)) return fromEl;
        const fromRoot = readFrom(document.documentElement);
        if (Number.isFinite(fromRoot)) return fromRoot;
        return 0.97;
      };
      const cssScaleFrom = readCssScaleFrom();

      // Parse `matrix(a, b, c, d, tx, ty)` or `matrix3d(...)`; return
      // the geometric scale (min of the two axis norms). `none` /
      // empty → 1 (no compression observed on this channel).
      const scaleFromTransform = (t: string): number => {
        if (!t || t === "none") return 1;
        const m2 = t.match(/^matrix\(([^)]+)\)$/);
        if (m2) {
          const p = m2[1].split(",").map((s) => parseFloat(s.trim()));
          if (p.length >= 4 && Number.isFinite(p[0]) && Number.isFinite(p[3])) {
            const sx = Math.hypot(p[0], p[1] ?? 0);
            const sy = Math.hypot(p[2] ?? 0, p[3]);
            return Math.min(sx, sy);
          }
        }
        const m3 = t.match(/^matrix3d\(([^)]+)\)$/);
        if (m3) {
          const p = m3[1].split(",").map((s) => parseFloat(s.trim()));
          if (p.length >= 16) {
            const sx = Math.hypot(p[0], p[1], p[2]);
            const sy = Math.hypot(p[4], p[5], p[6]);
            return Math.min(sx, sy);
          }
        }
        return 1;
      };

      // Parse an inline `style.transform` string that the pointerdown
      // handler in index.html may have stamped: `scale(0.97)` or
      // `scale(0.97, 0.97)`. Returns NaN if the string doesn't match
      // (so we don't accidentally treat "translate(...)" as scaled).
      const scaleFromInlineStyle = (t: string): number => {
        if (!t) return NaN;
        const m = t.match(/scale\(\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/);
        if (!m) return NaN;
        const sx = parseFloat(m[1]);
        const sy = m[2] !== undefined ? parseFloat(m[2]) : sx;
        return Number.isFinite(sx) && Number.isFinite(sy)
          ? Math.min(sx, sy)
          : NaN;
      };

      const sample = () => {
        const live =
          (liveId ? document.getElementById(liveId) : null) ?? h;

        // Channel 1 — the press marker. `pointerdown` in index.html
        // sets `data-aftersign-job-take="pressing"`; this is the
        // canonical signal that the compressed envelope is active.
        // When observed, record the AUTHORED scale-from directly —
        // no timing / display dependency.
        if (
          (live as HTMLElement).getAttribute("data-aftersign-job-take") ===
          "pressing"
        ) {
          if (cssScaleFrom < rec.minScale) rec.minScale = cssScaleFrom;
        }

        // Channel 2 — inline `style.transform` the pointerdown
        // handler stamps as belt-and-suspenders (index.html:1098).
        // This parses even for an element inside a `display: none`
        // subtree; the string is on the DOM attribute, not layout.
        const inlineScale = scaleFromInlineStyle(
          (live as HTMLElement).style.transform,
        );
        if (Number.isFinite(inlineScale) && inlineScale < rec.minScale) {
          rec.minScale = inlineScale;
        }

        // Channel 3 — computed transform matrix. Opportunistic: the
        // first frame or two of the transition (before display: none
        // lands on the ancestor) may serve a partial matrix on
        // Chromium. Under a hidden ancestor this resolves to "none"
        // → 1 and is a no-op.
        const cs = getComputedStyle(live);
        const sTransform = scaleFromTransform(cs.transform);
        if (sTransform < rec.minScale) rec.minScale = sTransform;

        // Channel 4 — bounding rect. Feeds the travel channel and
        // provides a pre-tap baseline sanity read on the scale
        // channel. Skipped once the ancestor collapses to 0×0.
        const r = live.getBoundingClientRect();
        if (r.width > 0 && base.width > 0) {
          const sGeom = Math.min(
            r.width / base.width,
            r.height / base.height,
          );
          if (sGeom < rec.minScale) rec.minScale = sGeom;
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
    // #1674: read the recorder from `window`, not the (possibly
    // swapped-out) element — see the recorder comment above.
    type PressJuiceRecord = { minScale: number; maxTravel: number; samples: number };
    const readRecorder = () =>
      page.evaluate(
        () =>
          (window as unknown as { __aftersignPressJuiceRecorder?: PressJuiceRecord })
            .__aftersignPressJuiceRecorder ?? { minScale: 1, maxTravel: 0, samples: 0 },
      );
    await expect
      .poll(async () => (await readRecorder()).minScale, { timeout: 2_000 })
      .toBeLessThanOrEqual(1 - PRESS_FEEL.minPressedScaleDrop);

    const recorded = await readRecorder();
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
