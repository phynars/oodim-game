import { expect, test } from "@playwright/test";

// #2202 — regression probe for the phone-only delivered-beat overlay.
//
// SURFACE UNDER TEST
// ------------------
// At 390×844 after *Deliver packet* → *Return to Io*, Diego's blind
// playtest #4 shots 008/009/018 caught a dark vertical band from
// ~x≥332px covering the right edge of the HUD, clipping "remembe(r)"
// and the right side of the *Evasive return* pill (symptom 3 of #2193).
//
// DIAGNOSIS
// ---------
// The scene-transition vignette (`.aftersign-scene-transition`,
// `position: fixed; inset: 0; z-index: 60` — see
// `apps/web/src/aftersign/aftersignSceneTransitionFeel.ts` and the
// matching style block in `aftersign/index.html`) is a scene layer, not
// tray chrome. On main the HUD has no stacking context of its own, so
// at the delivered beat the transition surface's residual tail paints
// above the HUD's rightmost gutter on narrow phones and `elementFromPoint`
// at the pill's right-edge pixel resolves to the transition surface
// instead of the pill. The fix is `.hud { z-index: 61 }` (plus
// `flex-wrap: wrap` on the return-tone row so Evasive return stays
// inside the panel after Io's reply).
//
// WHY `test.use({ hasTouch, isMobile })` IS REQUIRED
// --------------------------------------------------
// `aftersign/playwright.config.ts`'s chromium project uses plain
// `devices["Desktop Chrome"]`, which does not expose a touch input
// device. `Locator.tap()` throws
// "The page does not support tap. Use hasTouch context option to enable
// touch support." without the touch opt-in — every sibling phone
// playtest spec sets both flags for exactly this reason.
//
// WHY THIS SPEC MUST FAIL ON MAIN (reviewer gate from #2196/#2202)
// ----------------------------------------------------------------
// The assertion names the covering element directly: at the delivered
// beat, every visible pill's right-edge pixel must resolve to that pill
// (or a descendant), NOT to `.aftersign-scene-transition`. On main
// (before `.hud { z-index: 61 }`) the transition surface wins the
// stacking contest at the HUD gutter and owns the pixel → the covering
// element is `.aftersign-scene-transition` → spec FAILS. With the fix
// the HUD outranks the transition surface at the delivered beat → pill
// owns the pixel → spec PASSES.
const PHONE_VIEWPORT = { width: 390, height: 844 } as const;

test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

test("390×844: delivered pills' right edges are not covered by the scene-transition surface", async ({ page }) => {
  await page.goto("/aftersign/", { waitUntil: "load" });

  const packet = page.locator("#packetButton");
  await expect(packet).toBeVisible({ timeout: 15_000 });
  await packet.tap();

  const deliver = page.locator("#deliverButton");
  await expect(deliver).toBeVisible({ timeout: 15_000 });
  await deliver.tap();

  // Wait for the delivered beat to settle — the state readout is the
  // canonical signal that the beat flipped (same pattern sibling specs
  // use for `packet-delivered`).
  await expect(page.locator("#stateReadout")).toContainText("packet-delivered", {
    timeout: 15_000,
  });

  // The return-tone row (Direct / Evasive / etc) is what Diego's shots
  // caught clipped at its right edge. Wait for at least one pill in it
  // to render before probing stacking.
  await expect(
    page.locator('button[data-return-reason]:not([disabled])').first(),
  ).toBeVisible({ timeout: 15_000 });

  type CoveredPill = {
    label: string | null;
    coveringTag: string;
    coveringClass: string;
    coveringZIndex: string;
  };

  const coveredPills = await page
    .locator("button:visible")
    .evaluateAll<CoveredPill[]>((buttons) =>
      buttons.flatMap((button) => {
        const box = button.getBoundingClientRect();
        if (box.width <= 0 || box.height <= 0) return [];
        // Probe one pixel inside the right edge, vertically centered.
        const x = box.right - 1;
        const y = box.top + box.height / 2;
        const owner = document.elementFromPoint(x, y);
        if (!owner || owner === button || button.contains(owner)) return [];
        return [
          {
            label:
              button.getAttribute("aria-label") ||
              (button.textContent ?? "").trim() ||
              button.id ||
              null,
            coveringTag: owner.tagName.toLowerCase(),
            coveringClass: owner.className?.toString?.() ?? "",
            coveringZIndex: getComputedStyle(owner).zIndex,
          },
        ];
      }),
    );

  // Fails loudly with the covering element named so a future regression
  // doesn't resurrect the same stacking bug under a different pretext.
  expect(coveredPills, "pills covered at their right edge").toEqual([]);
});
