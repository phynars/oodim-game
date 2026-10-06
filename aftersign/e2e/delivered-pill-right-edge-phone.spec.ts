import { expect, test } from "@playwright/test";

// Bug #2202 — on phone (390×844) during the delivery → Io-return
// scene transition, the vignette layer `.aftersign-scene-transition`
// painted ABOVE the HUD and its dark right-edge band clipped the
// `#routeChoice` pills (`#acknowledgeRouteButton` / `#skipRouteButton`).
//
// WHY A STACK-ORDER CHECK AND NOT ELEMENTFROMPOINT-AS-WRITTEN:
// The transition layer is `pointer-events: none`, so a vanilla
// `document.elementFromPoint` always skips it and would return the
// pill regardless of z-order — a tautological pass. To probe real
// stacking we temporarily flip `pointer-events: auto` on the layer
// in-test, hit-test the pill's right edge, then restore. If the
// layer stacks ABOVE the HUD, elementFromPoint returns the layer;
// if below, it returns the pill. This is the exact mechanic the
// bug reports as "the dark strip is drawn over the pills."
//
// WHY A TIME-GATED SAMPLE AND NOT `toHaveCount(0)`:
// The layer is removed by `playAftersignSceneTransition` at
// `totalDurationMs + SCENE_TRANSITION_CLEANUP_TAIL_MS` (~620ms).
// We must hit-test WHILE it is still mounted. We assert count=1,
// grab the handle, then hit-test immediately — no polling past the
// cleanup window.

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});

test("delivered-phone: scene-transition vignette stacks beneath route pills", async ({
  page,
}) => {
  await page.goto(`/aftersign/?slot=delivered-pill-edge-${Date.now()}`);
  await expect
    .poll(() => page.evaluate(() => (window as any).__game?.scene?.beat))
    .toBe("packet-offered");

  const deliver = page.getByRole("button", { name: "Deliver packet", exact: true });
  await expect(deliver).toBeVisible();
  await deliver.tap();

  // Grab the transition layer AS SOON AS it mounts (deliver schedules
  // the setBeat → io-return-recognition flip, which fires
  // resolveAndPlayAftersignSceneTransition). It's live for ~620ms;
  // the hit-test runs inside that window.
  const layer = page.locator(".aftersign-scene-transition");
  await expect(layer).toHaveCount(1);

  const pillStackingReport = await page.evaluate(() => {
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>("#routeChoice button"),
    );
    const layerEl = document.querySelector<HTMLElement>(
      ".aftersign-scene-transition",
    );
    if (!layerEl) {
      return { ok: false as const, reason: "layer-missing" };
    }

    // Flip pointer-events so elementFromPoint reports true stacking.
    // The runtime value stays `none` for the player — we restore it
    // immediately after sampling. Any throw inside the probe would
    // leak the override, so we guard it in try/finally.
    const previousPointerEvents = layerEl.style.pointerEvents;
    layerEl.style.pointerEvents = "auto";
    try {
      const samples = buttons.map((button) => {
        const box = button.getBoundingClientRect();
        // Right-edge sample: 1px inside the pill's right edge, at its
        // vertical midpoint — this is the exact column the bug
        // reported as being clipped by the vignette.
        const x = box.right - 1;
        const y = box.top + box.height / 2;
        const hit = document.elementFromPoint(x, y);
        const hitsPill = hit === button || hit?.closest("button") === button;
        return {
          id: button.id,
          hitsPill,
          hitTag: hit ? hit.tagName.toLowerCase() : null,
          hitClass: hit instanceof Element ? hit.className : null,
        };
      });
      return { ok: true as const, samples };
    } finally {
      layerEl.style.pointerEvents = previousPointerEvents;
    }
  });

  expect(pillStackingReport.ok, "scene-transition layer must be mounted at sample time").toBe(true);
  if (!pillStackingReport.ok) return;

  expect(pillStackingReport.samples.length).toBeGreaterThan(0);
  for (const sample of pillStackingReport.samples) {
    expect(
      sample.hitsPill,
      `${sample.id} right-edge pixel must be the pill itself, not the overlay (got <${sample.hitTag}.${sample.hitClass}>) — the scene-transition vignette is stacking above the HUD`,
    ).toBe(true);
  }
});
