import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN — M-LOOP durable-save divergence, played through the rendered page.
//
// This spec is #1827's acceptance evidence: it proves that two divergent
// durable save records (fresh vs completed) produce visibly different
// tappable job action ELEMENTS on the served phone surface, and that the
// route-risk copy is stamped element-level (not just implied by ids).
// Every transition is a real tap on a visible control; `window.__game`
// is read ONLY as the scene-ready gate — no `__game.input.*` puppeteering.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
// Per-locator visibility budget. Must cover a SwiftShader cold-boot,
// which is what the served aftersign surface pays on the initial goto
// AND again on the mid-test page.reload() below. Prior runs of this
// spec red-ed at `waitForBeat(page, "packet-offered")` with the old
// 10s value clipping the post-reload cold boot; raising to 45s brings
// this variant in line with the aftersign-cold-boot budget the sibling
// `m-loop-divergence.playtest.spec.ts` uses for the same shape, with
// headroom for the extra reload this variant performs.
const WAIT_MS = 45_000;
// Per-test wall-clock cap: fresh boot + completed loop + reload boot
// all run under one test, so pin well above the Playwright 30s default.
const SPEC_TIMEOUT_MS = 180_000;

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
  await expect(
    page.locator(`[data-beat-id="${beatId}"]`),
    `story line should visibly reach beat "${beatId}"`,
  ).toBeVisible({ timeout: WAIT_MS });
}

async function tap(page: Page, selector: string): Promise<void> {
  const control = page.locator(`${selector}:not([disabled])`).first();
  await expect(
    control,
    `control "${selector}" should be tappable`,
  ).toBeVisible({ timeout: WAIT_MS });
  await control.tap({ timeout: WAIT_MS });
}

type OfferReadout = {
  readonly ids: readonly string[];
  readonly byId: Readonly<
    Record<string, { readonly routeRisk: string | null; readonly text: string }>
  >;
};

async function readOfferedActions(page: Page): Promise<OfferReadout> {
  // #job-offer-<jobId> is the served render surface (aftersign/main.js
  // stamps these buttons at the packet-offered beat and adds
  // [data-aftersign-job-take] + [data-route-risk] element-level). We
  // read attributes straight off the DOM so a served-renderer
  // regression that drops [data-route-risk] reds THIS spec.
  const offers = page.locator('[id^="job-offer-"]');
  await expect(
    offers.first(),
    "at least one #job-offer-* button must render at packet-offered",
  ).toBeVisible({ timeout: WAIT_MS });

  const count = await offers.count();
  const ids: string[] = [];
  const byId: Record<
    string,
    { routeRisk: string | null; text: string }
  > = {};
  for (let index = 0; index < count; index += 1) {
    const offer = offers.nth(index);
    if (!(await offer.isVisible())) continue;
    const id = await offer.getAttribute("id");
    if (!id) continue;
    // The button MUST carry [data-aftersign-job-take] (the tap locator
    // sibling specs pin, e.g. aftersign-job-take-feel.playtest.spec.ts).
    await expect(
      offer,
      `${id} must expose the [data-aftersign-job-take] locator at render`,
    ).toHaveAttribute("data-aftersign-job-take", /.+/);
    const routeRisk = await offer.getAttribute("data-route-risk");
    expect(
      routeRisk,
      `${id} must expose [data-route-risk] from computeOfferedJobs`,
    ).toMatch(/^(?:low|medium|high)$/);
    ids.push(id);
    byId[id] = {
      routeRisk,
      text: (await offer.textContent())?.trim() ?? "",
    };
  }

  return {
    ids: ids.slice().sort(),
    byId,
  };
}

async function completeSafeDelivery(page: Page): Promise<void> {
  await tap(page, "#job-offer-job-safe-delivery");
  await tap(page, "#packetButton");
  await waitForBeat(page, "packet-choice");
  await tap(page, 'button[data-choice-id="acknowledge-kiosk"]');
  await tap(page, 'button[data-choice-id="deliver-packet"]');
  await waitForBeat(page, "io-return-recognition");
  await tap(page, 'button[data-return-reason="blunt"]');
  await waitForBeat(page, "return-tone-choice");
  await tap(page, 'button[data-choice-id="ask-for-next-job"]');
  await waitForBeat(page, "io-next-job");
  await tap(page, 'button[data-choice-id="deliver-packet"]');
}

test.describe("AFTERSIGN two-save tappable divergence (served page)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a fresh and completed durable record render different tappable job actions deterministically", async ({
    page,
  }) => {
    // Pin the per-test timeout FIRST so nothing below can be clipped by
    // the Playwright default (30s). Prior CI runs on this branch red-ed
    // with "Test timeout of 30000ms exceeded" when this line was placed
    // AFTER a test.step() — Playwright applies the override at call
    // time, so a step that boots SwiftShader before the override lands
    // still runs under the default. Keeping it as the first statement
    // in the test body is load-bearing.
    test.setTimeout(SPEC_TIMEOUT_MS);

    const slot = `two-save-divergence-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

    // FRESH DURABLE RECORD — first visit, packet.delivered === false.
    await page.goto(`/aftersign/?slot=${encodeURIComponent(slot)}`, {
      waitUntil: "load",
    });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");

    const freshOffers = await readOfferedActions(page);
    expect(
      freshOffers.ids,
      "fresh durable record must render the safe-default job offer",
    ).toEqual(["job-offer-job-safe-delivery"]);
    // #1827 explicit criterion: route-risk copy divergence asserted
    // from the RENDERED DOM (not from the pure selector). Pin the
    // fresh slot's low-risk stamp here.
    expect(
      freshOffers.byId["job-offer-job-safe-delivery"]?.routeRisk,
      "fresh offer must expose data-route-risk=\"low\"",
    ).toBe("low");

    // COMPLETED DURABLE RECORD — same slot, driven to `priorOutcome
    // === "completed"` by real taps on the served surface.
    await completeSafeDelivery(page);
    await waitForBeat(page, "packet-offered");

    const completedOffers = await readOfferedActions(page);
    expect(
      completedOffers.ids,
      "completed durable record must render the completed-branch offers",
    ).toEqual([
      "job-offer-job-night-transfer",
      "job-offer-job-signed-receipt",
    ]);
    // #1827 explicit criterion: two divergent durable saves produce
    // visibly different tappable elements. Compare the id set AND the
    // route-risk stamps element-level.
    expect(
      completedOffers.ids,
      "memory must change the visible action id set, not only dialogue",
    ).not.toEqual(freshOffers.ids);
    expect(
      completedOffers.byId["job-offer-job-night-transfer"]?.routeRisk,
      "night-transfer must expose data-route-risk=\"medium\"",
    ).toBe("medium");
    expect(
      completedOffers.byId["job-offer-job-signed-receipt"]?.routeRisk,
      "signed-receipt must expose data-route-risk=\"low\"",
    ).toBe("low");
    // Route-risk copy divergence element-level: at least one action
    // between the two records carries a different route-risk stamp.
    // (Fresh: {low}. Completed: {medium, low}. Set inequality.)
    const freshRiskSet = new Set(
      Object.values(freshOffers.byId).map((entry) => entry.routeRisk),
    );
    const completedRiskSet = new Set(
      Object.values(completedOffers.byId).map((entry) => entry.routeRisk),
    );
    expect(
      completedRiskSet,
      "route-risk stamps rendered from the DOM must diverge across records",
    ).not.toEqual(freshRiskSet);

    // DETERMINISM (#1827 criterion 3, per #1818) — reloading the same
    // completed slot re-renders the SAME tappable element set with the
    // SAME route-risk stamps. The durable record was stamped at
    // `io-next-job` (`ask-for-next-job → forceSave`,
    // ioNextJobDurability.test.ts:48), and PR #1249's restore path SNAPS
    // the booted beat to that stamp — so a cold boot from this save
    // lands on the io-return surface and `packet-offered` does NOT
    // re-fire on its own (this spec's prior CI red: waitForBeat
    // timing out post-reload at any WAIT_MS). Assert the stamped
    // restore beat explicitly — that IS the durability contract —
    // then re-enter packet-offered with the same visible tap the
    // live session used (main.js: `deliver-packet` at io-next-job →
    // setBeat("packet-offered")). Still taps-only; the offers the
    // re-entered beat renders must equal the live completed set.
    await page.reload({ waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "io-next-job");
    await tap(page, 'button[data-choice-id="deliver-packet"]');
    await waitForBeat(page, "packet-offered");
    const reloadedOffers = await readOfferedActions(page);
    expect(
      reloadedOffers,
      "reloading the same durable slot must be deterministic on the served DOM",
    ).toEqual(completedOffers);
  });
});
