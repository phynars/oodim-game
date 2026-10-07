import { expect, test } from "@playwright/test";

// #2202 — regression probe for the phone-only delivered-beat overlay.
//
// WHAT DIEGO SAW
// --------------
// At 390×844, after *packet → acknowledge route → Deliver packet*, the
// scene-transition vignette surface (`.aftersign-scene-transition`,
// mounted onto `document.body` by `aftersignSceneTransitionFeel.ts`,
// painted via the CSS block in `aftersign/index.html` at `z-index: 60`)
// darkened the right-edge gutter of the HUD. Diego's blind playtest #4
// shots 008/009/018 (#2193 symptom 3) show the right side of the
// "Evasive return" pill reading as cut off against a dark vertical band.
//
// WHY THE PRIOR PROBE DID NOT WORK (PR #2210 re-review, Soren Vask)
// -----------------------------------------------------------------
// The first draft of this spec used `document.elementFromPoint` on the
// pill's right-edge pixel and asserted the owner was the pill, not the
// transition surface. `.aftersign-scene-transition` is
// `pointer-events: none` (`aftersign/index.html` CSS block). The HTML
// spec says `elementFromPoint` SKIPS pointer-events:none elements, so
// the probe could never return the transition surface — the assertion
// passed on main (bug present) AND with the fix. A tautological probe
// is not a regression gate. See AI008 (unverified runtime premise on
// `elementFromPoint`) and AI003 (tautological test).
//
// WHAT THIS PROBE DOES INSTEAD
// ----------------------------
// Soren named the correct replacement: a probe that sees PAINT. We can
// not pull in a PNG decoder (no `pngjs`/`sharp` in this harness — see
// root package.json), and Playwright's visual-regression (toHaveScreenshot)
// would require a committed baseline PNG the prior reviewer also flagged.
// The clean alternative is a STACKING-ORDER paint invariant that is
// decidable from `getComputedStyle` + `getBoundingClientRect` alone:
//
//   At the delivered beat (`io-return-recognition`), if the
//   `.aftersign-scene-transition` surface's rect intersects any visible
//   HUD pill's rect, the HUD's effective `z-index` MUST be greater than
//   or equal to the transition surface's `z-index`. Otherwise the dark
//   band paints over the pill — the exact bug Diego saw.
//
// Why this is a real regression gate (and NOT tautological):
//   * On main, `.hud` has no `z-index` set — `getComputedStyle(.hud).zIndex`
//     resolves to the string `"auto"`, which is NOT a stacking rank. The
//     transition surface's `z-index: 60` therefore wins the stacking
//     contest wherever the two rects overlap — the probe FAILS on main.
//   * With `.hud { z-index: 61 }` the HUD out-stacks the transition
//     surface — the probe PASSES.
//   * A future regression that removes `.hud { z-index: 61 }`, OR that
//     bumps the transition surface to a higher stacking rank, re-reds
//     this spec on the delivered beat.
//
// This is a stacking-paint invariant, not a hit-test invariant — it
// does not depend on `pointer-events`, so Soren's AI008 critique does
// not apply.
//
// WHY `hasTouch` + `isMobile` ARE REQUIRED
// ----------------------------------------
// `aftersign/playwright.config.ts`'s chromium project uses plain
// `devices["Desktop Chrome"]` — no touch input device.
// `Locator.tap()` throws without the touch opt-in. Every sibling phone
// playtest spec sets both flags; the prior round of this spec red-CI'd
// precisely because it forgot them. The acceptance-check from PR #2210
// round one is baked in here.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

test("390×844 delivered beat: HUD out-stacks the scene-transition surface wherever they overlap", async ({
  page,
}) => {
  await page.goto("/aftersign/", { waitUntil: "load" });

  // Drive to the delivered beat — same walk the sibling m-loop playtest
  // uses: packet → acknowledge route → deliver → io-return-recognition.
  // That last beat is when the return-tone pills ("Direct / Evasive /
  // Kind" return) render and the dark gutter in Diego's shots appears.
  const packet = page.locator("#packetButton");
  await expect(packet).toBeVisible({ timeout: WAIT_MS });
  await packet.tap();

  const acknowledge = page.locator('button[data-choice-id="acknowledge-kiosk"]:not([disabled])');
  await expect(acknowledge).toBeVisible({ timeout: WAIT_MS });
  await acknowledge.tap();

  const deliver = page.locator('button[data-choice-id="deliver-packet"]:not([disabled])');
  await expect(deliver).toBeVisible({ timeout: WAIT_MS });
  await deliver.tap();

  // The canonical signal the delivered beat has settled is the
  // `io-return-recognition` beat marker (same pattern used by every
  // sibling phone playtest spec, e.g. aftersign-mloop-two-round.playtest).
  await expect(page.locator('[data-beat-id="io-return-recognition"]'))
    .toBeVisible({ timeout: WAIT_MS });

  // Wait for at least one return-tone pill to render so the pill rect
  // is paintable before we probe stacking.
  await expect(
    page.locator("button[data-return-reason]:not([disabled])").first(),
  ).toBeVisible({ timeout: WAIT_MS });

  type StackingReport = {
    pillLabel: string | null;
    pillRect: { left: number; top: number; right: number; bottom: number };
    transitionRect:
      | { left: number; top: number; right: number; bottom: number }
      | null;
    transitionZIndex: string;
    hudZIndex: string;
    hudZIndexNumeric: number | null;
    transitionZIndexNumeric: number | null;
    overlapsPill: boolean;
    stackingBroken: boolean;
  };

  const report = await page.evaluate<StackingReport[]>(() => {
    const transition = document.querySelector<HTMLElement>(".aftersign-scene-transition");
    const hud = document.querySelector<HTMLElement>(".hud");
    if (!transition || !hud) {
      return [
        {
          pillLabel: "<no-pill-probed>",
          pillRect: { left: 0, top: 0, right: 0, bottom: 0 },
          transitionRect: null,
          transitionZIndex: "<missing>",
          hudZIndex: "<missing>",
          hudZIndexNumeric: null,
          transitionZIndexNumeric: null,
          overlapsPill: false,
          stackingBroken: true,
        },
      ];
    }

    const transitionRect = transition.getBoundingClientRect();
    const transitionZ = getComputedStyle(transition).zIndex;
    const hudZ = getComputedStyle(hud).zIndex;
    const parseZ = (raw: string): number | null => {
      const n = Number.parseInt(raw, 10);
      return Number.isFinite(n) ? n : null;
    };
    const transitionZNum = parseZ(transitionZ);
    const hudZNum = parseZ(hudZ);

    const rectsOverlap = (
      a: DOMRect,
      b: { left: number; top: number; right: number; bottom: number },
    ): boolean =>
      a.left < b.right &&
      a.right > b.left &&
      a.top < b.bottom &&
      a.bottom > b.top;

    // Every return-tone pill PLUS the "Return to Io"-style route pills
    // the delivered beat renders. The symptom Diego caught lived on
    // the right edge of the return-tone row — scope the probe to the
    // HUD subtree so a stray unrelated button elsewhere does not
    // dilute the signal.
    const pills = Array.from(
      hud.querySelectorAll<HTMLButtonElement>("button"),
    ).filter((pill) => {
      if (pill.disabled) return false;
      const style = getComputedStyle(pill);
      if (style.visibility === "hidden" || style.display === "none") return false;
      const rect = pill.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    return pills.map((pill) => {
      const rect = pill.getBoundingClientRect();
      const pillRect = {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      };
      const overlaps = rectsOverlap(transitionRect, pillRect);
      // The invariant: if the transition surface's rect overlaps the
      // pill AND it has a numeric z-index, the HUD must have a numeric
      // z-index >= the transition surface's. `auto` on the HUD side is
      // the exact bug — it loses the stacking contest.
      const hudWins =
        transitionZNum === null ||
        !overlaps ||
        (hudZNum !== null && hudZNum >= transitionZNum);
      return {
        pillLabel:
          pill.getAttribute("aria-label") ||
          (pill.textContent ?? "").trim() ||
          pill.id ||
          null,
        pillRect,
        transitionRect: {
          left: transitionRect.left,
          top: transitionRect.top,
          right: transitionRect.right,
          bottom: transitionRect.bottom,
        },
        transitionZIndex: transitionZ,
        hudZIndex: hudZ,
        hudZIndexNumeric: hudZNum,
        transitionZIndexNumeric: transitionZNum,
        overlapsPill: overlaps,
        stackingBroken: !hudWins,
      };
    });
  });

  // There must be at least one pill to probe at the delivered beat —
  // otherwise the walk never reached the beat and the test is silently
  // vacuous. (Prior reviewer AI003 flagged exactly this failure mode on
  // a sibling spec.)
  expect(report.length, "visible HUD pills at the delivered beat").toBeGreaterThan(0);

  // Any pill with stackingBroken=true is a pill the dark band would
  // paint over at this beat. The custom message surfaces hud vs
  // transition z-index + overlap geometry so a regression tells the
  // next reviewer EXACTLY why it fired, not just "it fired".
  const broken = report.filter((entry) => entry.stackingBroken);
  expect(
    broken,
    `HUD lost the stacking contest at the delivered beat. ` +
      `hud z-index=${report[0]?.hudZIndex ?? "<n/a>"}, ` +
      `transition z-index=${report[0]?.transitionZIndex ?? "<n/a>"}. ` +
      `Covered pills: ${broken.map((e) => e.pillLabel).join(" | ") || "<none>"}`,
  ).toEqual([]);
});
