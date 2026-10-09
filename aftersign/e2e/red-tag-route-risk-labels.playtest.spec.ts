import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN red-tag route-label binding (#2241 B2, PR #2246 — the main.js
// wire-up of `routeRiskActionLabelForOffer`). Proves the two
// `#routeRiskChoice` buttons that appear at round-two `packet-choice`
// (when `state.delivery.id === "red-tag"`) render the TRUSTED offer
// row from `aftersignJobOfferCopy.js` — "Long way — past the kiosk"
// and "Behind the shuttered pharmacy" — not the firstRun (blue) copy
// and not the generic `routeRiskActionLabel` fallback ("Choose a
// route" / raw action ids).
//
// Walk shape mirrors the sibling, already-passing
// `red-tag-packet-choice-retention.spec.ts` (PR #2192 / #2201): phone
// viewport with `hasTouch: true, isMobile: true`, wait for
// `window.__game.scene.ready`, poll `getSnapshot().scene.beat` to
// gate each tap, and reach round-two packet-choice via the SAME
// two-tap handoff (`data-choice-id="accept-second-packet"` → the
// `#deliverButton` commit). The sibling is the proof the walk works
// against a served build; this spec adds the two label assertions
// that pin the #2241 B2 fix.
//
//   round 1
//   `packet-offered` →
//     tap `#deliverButton` (sealed-default) →
//   `io-return-recognition` →
//     tap `#acknowledgeRouteButton` (kind) →
//   `return-tone-choice` →
//     tap `#deliverButton` ("Ask for next job") →
//   `io-next-job` →
//     tap `[data-choice-id="accept-second-packet"]` →
//     tap `#deliverButton` ("Deliver next packet") →
//   round 2 — `packet-offered` (red-tag armed) →
//     tap `#packetButton` →
//   `packet-choice` →
//     ASSERT `#routeRiskChoice button` nth(0) = trusted safe label
//     ASSERT `#routeRiskChoice button` nth(1) = trusted risky label
//     NEGATIVE on firstRun labels and the generic fallback.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 60_000;

declare global {
  interface Window {
    __game?: {
      version?: number;
      scene?: { ready?: boolean };
      getSnapshot?: () => { scene: { beat: string } };
    };
  }
}

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => window.__game?.version === 1 && window.__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect
    .poll(
      () => page.evaluate(() => window.__game?.getSnapshot?.().scene.beat),
      { timeout: WAIT_MS },
    )
    .toBe(beat);
}

async function tap(page: Page, selector: string): Promise<void> {
  const target = page.locator(selector);
  await expect(target).toBeVisible({ timeout: WAIT_MS });
  await expect(target).toBeEnabled();
  await target.tap();
}

test.describe("AFTERSIGN red-tag route-risk labels (#2241 B2)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("round-two packet-choice route buttons speak the trusted offer row", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto(
      `/aftersign/?slot=red-tag-route-labels-${Date.now()}-${test.info().parallelIndex}`,
      { waitUntil: "load" },
    );
    await waitForReady(page);

    // Round one — sealed-default deliver, kind return, ask for next job.
    // Same opener the sibling red-tag retention spec drives.
    await tap(page, "#deliverButton");
    await waitForBeat(page, "io-return-recognition");
    await tap(page, "#acknowledgeRouteButton");
    await waitForBeat(page, "return-tone-choice");
    await tap(page, "#deliverButton");
    await waitForBeat(page, "io-next-job");

    // Accept the second packet. The choice button is stamped
    // `data-choice-id="accept-second-packet"` by
    // `apps/web/src/aftersign/src/playerVisibleBeatDom.js` — the
    // same attribute the sibling spec uses. Two taps commit the
    // handoff: the choice tap, then `#deliverButton` ("Deliver next
    // packet").
    const acceptSecond = page.locator(
      'button[data-choice-id="accept-second-packet"]',
    );
    await expect(acceptSecond).toBeVisible({ timeout: WAIT_MS });
    await acceptSecond.tap();
    await tap(page, "#deliverButton");
    await waitForBeat(page, "packet-offered");

    // Round two — `choose("deliver-packet")` has armed the red-tag
    // identity (`state.delivery.id = "red-tag"`, PR #2199). Tap the
    // packet to land `packet-choice`, which is where
    // `renderRouteRiskChoice({...})` fires in `main.js` with
    // `labelForAction: routeRiskActionLabelForOffer(...)` for the
    // red-tag branch (this PR's fix).
    await tap(page, "#packetButton");
    await waitForBeat(page, "packet-choice");

    const routeChoices = page.locator("#routeRiskChoice button");
    await expect(routeChoices).toHaveCount(2, { timeout: WAIT_MS });

    // Positive — the two labels MUST match the trusted (red-tag)
    // offer row in `aftersignJobOfferCopy.js`. If main.js falls back
    // to the generic `routeRiskActionLabel` or renders the firstRun
    // (blue-seal) labels, these fail.
    await expect(routeChoices.nth(0)).toHaveText(
      "Long way — past the kiosk",
    );
    await expect(routeChoices.nth(1)).toHaveText(
      "Behind the shuttered pharmacy",
    );

    // Negative — firstRun labels must NOT leak into the red-tag run.
    await expect(routeChoices).not.toContainText("Lit stair");
    await expect(routeChoices).not.toContainText("Cut past the bell rope");

    // And the generic fallback ("Choose a route") must not appear.
    await expect(routeChoices).not.toContainText("Choose a route");
  });
});
