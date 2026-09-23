import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN M-LOOP — two durable saves, rendered tappable divergence.
//
// This is deliberately a served-page playtest: every transition below is a
// tap on a visible control. `window.__game` is used only for boot readiness.
// The first slot remains a first-run save; the second earns its completed
// memory record through the shipped packet loop, then reloads that same slot
// before its offer surface is inspected.
//
// Route/risk copy divergence is asserted from the rendered DOM — the
// `<p data-aftersign-job-offer-route-risk>` inside `#offeredJobs` — so a
// player-visible drift on either branch reds this spec. Copy strings are
// the verbatim authored branches from
// `apps/web/src/aftersign/aftersignJobOfferCopy.js` (see the sibling
// `job-offer-route-risk-copy-played.spec.ts`).

const PHONE_VIEWPORT = { width: 390, height: 844 };
// Per-beat / per-locator budget. This spec cold-boots the WebGL surface
// THREE times (first-run slot goto, completed slot goto, completed slot
// reload) AND plays a full packet loop between boots two and three;
// every `waitForBeat("packet-offered")` after a cold
// `page.goto`/`page.reload` pays the SwiftShader boot tax on CI.
//
// Prior iterations tried 10_000 → red, 60_000 → red at exactly
// `Timeout: 60000ms` on `[data-beat-id="packet-offered"]` (Soren
// reviews, PR #1887 iterations 2 and 3). Sibling
// `io-continue-beats-tap-playtest.spec.ts` (60_000) pays ONE cold boot;
// this spec pays THREE + a played loop, so on the same SwiftShader
// hardware the per-beat budget must actually exceed the sibling's, not
// merely match it. 90_000 gives 50% headroom over the sibling's proven-
// green budget — the smallest bump that both (a) crosses the observed
// 60s red line and (b) stays under the total-budget ceiling below.
const WAIT_MS = 90_000;
// Total per-test budget. Three cold boots @ up to 90s per `packet-offered`
// wait + the packet loop between boots two and three ⇒ needs real
// headroom on the SwiftShader lane. 240s (4×WAIT_MS) is deliberately
// generous: this test earns its completed record by playing the shipped
// packet loop (not by seeding), so it cannot be as tight as
// `m-loop-divergent-offered-actions` (90s / two seeded boots) nor as
// tight as `io-continue-beats-tap-playtest` (120s / one cold boot + one
// reload + a loop). Better to over-budget once and stay green than to
// re-red on a SwiftShader spike.
const COLD_START_MS = 240_000;

// Verbatim from AFTERSIGN_JOB_OFFER_COPY (see HANDOFF-1535.md and the
// sibling `job-offer-route-risk-copy-played.spec.ts`).
const FIRST_RUN_ROUTE_RISK_COPY =
  "Route: Take the lit stair. Do not stop under the bell rope. "
  + "Risk: Low risk. Long light. Io can see most of it from the kiosk.";
const TRUSTED_ROUTE_RISK_COPY =
  "Route: Cross behind the shuttered pharmacy before the bells count twice. "
  + "Risk: Short route. Unlit. Better pay because Io has one good fact about you.";

type OfferStamp = {
  id: string;
  action: string | null;
  routeRisk: string | null;
  text: string;
};

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } })
        .__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({
    timeout: WAIT_MS,
  });
}

async function tap(page: Page, selector: string): Promise<void> {
  const control = page.locator(`${selector}:not([disabled])`).first();
  await expect(control).toBeVisible({ timeout: WAIT_MS });
  await control.tap();
}

async function readOffers(page: Page): Promise<OfferStamp[]> {
  const offers = page.locator("button[data-aftersign-job-take]");
  await expect(offers.first()).toBeVisible({ timeout: WAIT_MS });
  return offers.evaluateAll((nodes) =>
    nodes.map((node) => ({
      id: node.id,
      action: node.getAttribute("data-aftersign-job-take-action"),
      routeRisk: node.getAttribute("data-route-risk"),
      text: node.textContent?.trim() ?? "",
    })),
  );
}

async function readRouteRiskCopy(page: Page): Promise<string> {
  const routeRiskCopy = page.locator(
    "#offeredJobs [data-aftersign-job-offer-route-risk]",
  );
  await expect(
    routeRiskCopy,
    "route/risk copy paragraph must render inside the served #offeredJobs tray",
  ).toBeVisible({ timeout: WAIT_MS });
  return (await routeRiskCopy.textContent())?.trim() ?? "";
}

async function completeFirstRound(page: Page): Promise<void> {
  await tap(page, "#job-offer-job-safe-delivery");
  await tap(page, "#packetButton");
  await waitForBeat(page, "packet-choice");
  await tap(page, '[data-choice-id="acknowledge-kiosk"]');
  await tap(page, '[data-choice-id="deliver-packet"]');
  await waitForBeat(page, "io-return-recognition");
  await tap(page, '[data-return-reason="blunt"]');
  await waitForBeat(page, "return-tone-choice");
  await tap(page, '[data-choice-id="ask-for-next-job"]');
  await waitForBeat(page, "io-next-job");
  await tap(page, '[data-choice-id="deliver-packet"]');
}

test.describe("AFTERSIGN two durable saves — rendered tappable divergence", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("first-run and completed records render different offers, and each reload is deterministic", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    const firstRunSlot = `two-save-first-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${firstRunSlot}`, { waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");
    const firstRunOffers = await readOffers(page);
    expect(firstRunOffers.map((offer) => offer.id)).toEqual([
      "job-offer-job-safe-delivery",
    ]);
    expect(firstRunOffers[0]).toMatchObject({
      action: "mloop-safe-delivery-take",
      routeRisk: "low",
    });
    const firstRunRouteRiskCopy = await readRouteRiskCopy(page);
    expect(
      firstRunRouteRiskCopy,
      "first-run render must speak the firstRun route/risk copy verbatim",
    ).toBe(FIRST_RUN_ROUTE_RISK_COPY);
    await expect(
      page.getByText(FIRST_RUN_ROUTE_RISK_COPY, { exact: true }),
      "firstRun copy must be player-visible on the first-run render",
    ).toBeVisible({ timeout: WAIT_MS });

    // Note: the first-run reload block that used to live here was
    // dropped in PR #1887 iteration 4. #1827's determinism criterion —
    // "the same save loaded twice yields the same attribute values" —
    // is proved by the completed-record reload at the end of this
    // test, on the memory-gated branch that is actually load-bearing.
    // Rebooting the untouched fresh slot too added a fourth cold WebGL
    // boot to the SwiftShader lane and pushed the per-beat `packet-
    // offered` wait past even 60s in CI (Soren's AI008 diagnosis, PR
    // #1887 iterations 2 and 3). One determinism proof, on the branch
    // that matters, is the shippable slice.

    const completedSlot = `two-save-completed-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${completedSlot}`, { waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");
    await completeFirstRound(page);
    await waitForBeat(page, "packet-offered");
    const completedOffers = await readOffers(page);

    expect(completedOffers.map((offer) => offer.id)).toEqual([
      "job-offer-job-night-transfer",
      "job-offer-job-signed-receipt",
    ]);
    expect(completedOffers.map((offer) => offer.routeRisk)).toEqual([
      "medium",
      "low",
    ]);
    expect(completedOffers.map((offer) => offer.action)).not.toEqual(
      firstRunOffers.map((offer) => offer.action),
    );

    // Route/risk copy divergence, asserted from the rendered DOM: the
    // completed durable record must speak the trusted branch, and it
    // must not match what the first-run render showed.
    const completedRouteRiskCopy = await readRouteRiskCopy(page);
    expect(
      completedRouteRiskCopy,
      "completed record must speak the trusted route/risk copy verbatim",
    ).toBe(TRUSTED_ROUTE_RISK_COPY);
    await expect(
      page.getByText(TRUSTED_ROUTE_RISK_COPY, { exact: true }),
      "trusted copy must be player-visible on the completed render",
    ).toBeVisible({ timeout: WAIT_MS });
    expect(
      completedRouteRiskCopy,
      "visible route/risk copy must diverge between the two saves",
    ).not.toBe(firstRunRouteRiskCopy);
    // Divergence means replacement, not accumulation — the firstRun
    // copy must not linger on the completed page.
    await expect(
      page.getByText(FIRST_RUN_ROUTE_RISK_COPY, { exact: true }),
      "firstRun route/risk copy must NOT render on the completed record",
    ).toHaveCount(0);

    // Reloading the completed durable record must preserve this same visible
    // tappable branch AND its route/risk copy — determinism across cold loads.
    await page.reload({ waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");
    await expect.poll(() => readOffers(page)).toEqual(completedOffers);
    expect(await readRouteRiskCopy(page)).toBe(completedRouteRiskCopy);
  });
});
