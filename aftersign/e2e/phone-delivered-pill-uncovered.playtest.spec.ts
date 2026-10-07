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
// WHY THE PRIOR PROBES DID NOT WORK
// ---------------------------------
// Round 1 — `document.elementFromPoint` on the pill's right-edge
// pixel. `.aftersign-scene-transition` is `pointer-events: none`
// (`aftersign/index.html` CSS block). HTML spec: `elementFromPoint`
// SKIPS pointer-events:none elements. The probe could never return the
// transition surface — assertion passed on main AND with the fix. See
// AI008 (unverified runtime premise) and AI003 (tautological test).
//
// Round 2 (prior commit on this branch) — a `getComputedStyle` +
// `getBoundingClientRect` stacking probe, but TIMING-DEPENDENT. The
// transition layer auto-removes `totalDurationMs + SCENE_TRANSITION_CLEANUP_TAIL_MS`
// after mount — 540ms + 80ms = 620ms — see
// `apps/web/src/aftersign/aftersignSceneTransitionFeel.ts`
// (`playAftersignSceneTransition` schedules a `setTimeoutRef`
// that calls `layer.parentNode.removeChild(layer)`). The spec runs
// several awaits after the deliver tap before probing; whether the
// layer is still attached is a timing coin-flip. If gone, `!transition`
// returned `stackingBroken: true` and the spec failed WITH the fix in
// place. If still attached, it passed. The gate was non-deterministic
// — Soren's third-round critique on #2210. See AI015 (timing-race
// gate masquerading as regression gate).
//
// HOW THIS ROUND PINS THE LAYER
// -----------------------------
// `page.addInitScript` installs — BEFORE any aftersign code runs — a
// `removeChild` interceptor on `document.body`. Any attempt to remove
// an `.aftersign-scene-transition` child is silently refused (we
// return the node unchanged, as `removeChild` is spec'd to). The
// `playAftersignSceneTransition` auto-dispose then no-ops; the
// transition surface stays mounted at its real `z-index: 60` with its
// real rect and real `pointer-events: none`. The stacking contest the
// paint pipeline runs on frame-N is the same contest we assert — no
// mock, no stub, no monkey-patched z-index. Only the dispose timer
// loses, and only for the duration of this spec.
//
// WHY THIS IS A REAL REGRESSION GATE
// ----------------------------------
//   * On main, `.hud` has no `z-index` set — `getComputedStyle(.hud).zIndex`
//     resolves to `"auto"`, which is NOT a stacking rank. The pinned
//     transition surface's `z-index: 60` therefore wins the stacking
//     contest wherever the two rects overlap — the probe FAILS on main.
//   * With `.hud { z-index: 61 }` the HUD out-stacks the transition
//     surface — the probe PASSES.
//   * A future regression that removes `.hud { z-index: 61 }`, OR that
//     bumps the transition surface to a higher stacking rank, re-reds
//     this spec.
//
// Stacking-paint invariant, not a hit-test invariant — independent of
// `pointer-events` (AI008 does not apply) and independent of the
// dispose timer (AI015 does not apply).
//
// WHY `hasTouch` + `isMobile` ARE REQUIRED
// ----------------------------------------
// `aftersign/playwright.config.ts`'s chromium project uses plain
// `devices["Desktop Chrome"]` — no touch. `Locator.tap()` throws
// without the touch opt-in. Every sibling phone playtest spec sets
// both flags; the first round of this spec red-CI'd for exactly this
// reason. The acceptance-check from PR #2210 round one is baked in.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

test.beforeEach(async ({ page }) => {
  // Pin the scene-transition layer so the stacking probe is
  // deterministic regardless of when it fires relative to the
  // 620ms auto-dispose. We hook ONLY the specific removal path
  // `playAftersignSceneTransition` uses — `layer.parentNode.removeChild(layer)`
  // where `parentNode` is `document.body`. We intercept at the
  // Element.prototype level so the hook survives any body replacement
  // and refuses detachment for `.aftersign-scene-transition` children
  // only. Every other removal (dialogs, HUD rerenders, Playwright's
  // own cleanup) passes through untouched.
  await page.addInitScript(() => {
    const nativeRemoveChild = Element.prototype.removeChild;
    Element.prototype.removeChild = function patchedRemoveChild<
      T extends Node,
    >(this: Element, child: T): T {
      if (
        child instanceof Element &&
        child.classList.contains("aftersign-scene-transition")
      ) {
        // Spec-shaped no-op: return the node unchanged. The caller
        // thinks the removal succeeded; the DOM keeps the layer.
        return child;
      }
      return nativeRemoveChild.call(this, child) as T;
    };
  });
});

test("390×844 delivered beat: HUD out-stacks the (pinned) scene-transition surface wherever they overlap", async ({
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

  // With the pin installed, `.aftersign-scene-transition` MUST still be
  // attached — the auto-dispose was intercepted. If it's missing, the
  // init-script never ran (test harness regression) and we fail LOUDLY
  // rather than silently flipping the probe branch like round 2 did.
  await expect(
    page.locator(".aftersign-scene-transition"),
    "scene-transition layer must stay pinned by the init-script interceptor",
  ).toBeAttached({ timeout: WAIT_MS });

  type StackingReport = {
    pillLabel: string | null;
    pillRect: { left: number; top: number; right: number; bottom: number };
    transitionRect: { left: number; top: number; right: number; bottom: number };
    transitionZIndex: string;
    hudZIndex: string;
    hudZIndexNumeric: number | null;
    transitionZIndexNumeric: number | null;
    overlapsPill: boolean;
    stackingBroken: boolean;
  };

  type ProbeResult =
    | { kind: "pinned-missing" }
    | { kind: "hud-missing" }
    | { kind: "ok"; entries: StackingReport[] };

  const probe = await page.evaluate<ProbeResult>(() => {
    const transition = document.querySelector<HTMLElement>(".aftersign-scene-transition");
    const hud = document.querySelector<HTMLElement>(".hud");
    if (!transition) return { kind: "pinned-missing" };
    if (!hud) return { kind: "hud-missing" };

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

    // Every HUD pill. The symptom Diego caught lived on the right
    // edge of the return-tone row — scope the probe to the HUD
    // subtree so a stray unrelated button elsewhere does not dilute
    // the signal.
    const pills = Array.from(
      hud.querySelectorAll<HTMLButtonElement>("button"),
    ).filter((pill) => {
      if (pill.disabled) return false;
      const style = getComputedStyle(pill);
      if (style.visibility === "hidden" || style.display === "none") return false;
      const rect = pill.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    const entries: StackingReport[] = pills.map((pill) => {
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

    return { kind: "ok", entries };
  });

  // Pin failure modes surface as explicit assertions, not as silent
  // branches that flip the probe's verdict (round 2's exact failure
  // mode).
  expect(
    probe.kind,
    "scene-transition pin must be live and HUD must be present at the delivered beat",
  ).toBe("ok");
  if (probe.kind !== "ok") return; // narrow for TS

  const report = probe.entries;

  // There must be at least one pill to probe at the delivered beat —
  // otherwise the walk never reached the beat and the test is silently
  // vacuous. (Prior reviewer AI003 flagged exactly this failure mode on
  // a sibling spec.)
  expect(report.length, "visible HUD pills at the delivered beat").toBeGreaterThan(0);

  // At least one pill MUST overlap the transition surface's rect —
  // otherwise the invariant is vacuous (no overlap means no stacking
  // contest, and the probe passes trivially on both main and fix). The
  // transition layer paints at `inset: 0` over the full viewport (see
  // the CSS block in `aftersign/index.html`), so every visible pill
  // should overlap it. Failing this assertion means the CSS or the
  // pin regressed, not the fix.
  const overlapping = report.filter((entry) => entry.overlapsPill);
  expect(
    overlapping.length,
    "at least one HUD pill must overlap the pinned transition rect (otherwise the stacking contest is vacuous)",
  ).toBeGreaterThan(0);

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

// ---------------------------------------------------------------------------
// Second gate — `.route-choice-row { flex-wrap: wrap }` wrap behavior.
//
// Soren's third-round critique closed with "nothing covers the
// `flex-wrap`". The CSS fix in this PR adds `flex-wrap: wrap` to
// `.route-choice-row` so the return-tone pills (Direct / Evasive /
// Kind return) wrap inside the HUD panel at 390px instead of running
// beneath the viewport's dark gutter. A regression that drops the
// `flex-wrap` would re-strand the Evasive pill's right edge off-screen.
//
// The invariant: at 390×844, every visible return-tone pill's right
// edge sits INSIDE the viewport (right <= viewport width). On a
// no-wrap single-row layout at 390px, three gap-separated pills
// overflow — the last pill's right edge lands past 390. Shrink-to-fit
// does not save it; the pills have min-content from their labels and
// the `gap: 8px` between them.
// ---------------------------------------------------------------------------

test("390×844 delivered beat: every return-tone pill's right edge stays inside the viewport (wrap gate)", async ({
  page,
}) => {
  await page.goto("/aftersign/", { waitUntil: "load" });

  const packet = page.locator("#packetButton");
  await expect(packet).toBeVisible({ timeout: WAIT_MS });
  await packet.tap();

  const acknowledge = page.locator('button[data-choice-id="acknowledge-kiosk"]:not([disabled])');
  await expect(acknowledge).toBeVisible({ timeout: WAIT_MS });
  await acknowledge.tap();

  const deliver = page.locator('button[data-choice-id="deliver-packet"]:not([disabled])');
  await expect(deliver).toBeVisible({ timeout: WAIT_MS });
  await deliver.tap();

  await expect(page.locator('[data-beat-id="io-return-recognition"]'))
    .toBeVisible({ timeout: WAIT_MS });

  await expect(
    page.locator("button[data-return-reason]:not([disabled])").first(),
  ).toBeVisible({ timeout: WAIT_MS });

  const overflow = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const pills = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        "button[data-return-reason]:not([disabled])",
      ),
    ).filter((pill) => {
      const style = getComputedStyle(pill);
      if (style.visibility === "hidden" || style.display === "none") return false;
      const rect = pill.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    return {
      viewportWidth,
      pills: pills.map((pill) => {
        const rect = pill.getBoundingClientRect();
        return {
          label:
            pill.getAttribute("aria-label") ||
            (pill.textContent ?? "").trim() ||
            pill.getAttribute("data-return-reason") ||
            null,
          right: rect.right,
          left: rect.left,
          top: rect.top,
          overflowsRight: rect.right > viewportWidth + 0.5, // sub-pixel tolerance
        };
      }),
    };
  });

  expect(
    overflow.pills.length,
    "visible return-tone pills at the delivered beat",
  ).toBeGreaterThan(0);

  const overflowing = overflow.pills.filter((pill) => pill.overflowsRight);
  expect(
    overflowing,
    `return-tone pills escaped the viewport (viewport=${overflow.viewportWidth}px). ` +
      `Overflowing: ${overflowing
        .map((p) => `${p.label}@right=${p.right.toFixed(1)}`)
        .join(" | ") || "<none>"}`,
  ).toEqual([]);
});
