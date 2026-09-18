import { expect, test, type Locator, type Page } from "@playwright/test";

// AFTERSIGN — two-slot tappable divergence on the served page.
//
// Contract (matches sibling specs, not fabricated):
//   • Boot with `?slot=<unique>` so each save lives in its own
//     server-authoritative bucket (aftersign/vite.config.ts middleware
//     keys by playerId+slot; localStorage mirrors under
//     `aftersign:kiosk-slice:${slot}`).  See
//     `save-load-durable-contract.spec.ts` for the same URL contract.
//   • Wait for `window.__game.scene.ready === true` then for the
//     visible `[data-beat-id="packet-offered"]` node before asserting
//     on offers — the page does not stamp offer buttons until the
//     beat is reached.  See `job-offers-played.spec.ts` and
//     `m-loop-visible-job-action-metadata.spec.ts`.
//   • Offers are keyed by `#job-offer-<jobId>`; the shipped
//     player-facing metadata is text `"${label} · ${routeRisk} risk"`
//     and the canonical attribute `data-route-risk` in
//     {"low","medium","high"} (aftersign/main.js:1796).  There is no
//     `data-route-copy` / `data-risk-copy` — do not invent surface.
//
// Divergence:
//   • Slot A — cold first visit.  computeOfferedJobs(undefined) →
//     `#job-offer-job-safe-delivery` with route-risk "low".
//   • Slot B — played through one full loop (deliver-packet) so the
//     save records a completed delivery; on the looped
//     `packet-offered`, computeOfferedJobs sees the prior outcome and
//     yields `#job-offer-job-night-transfer` ("medium") +
//     `#job-offer-job-signed-receipt` ("low").
//   • The two rendered offer sets, driven only by which real save
//     the served page rehydrates, must diverge.
//
// The reload leg reboots Slot B from its persisted save (same `?slot=`)
// and asserts the same divergent offer set re-materializes — proof the
// divergence came from durable save, not in-memory flow.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 10_000;
const COLD_START_MS = 60_000;

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

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page
    .locator(`button[data-choice-id="${choiceId}"]:not([disabled])`)
    .first();
  await expect(
    choice,
    `choice "${choiceId}" should be visible and tappable`,
  ).toBeVisible({ timeout: WAIT_MS });
  await choice.tap();
}

async function tapReturnReason(page: Page, reason: string): Promise<void> {
  const button = page
    .locator(`button[data-return-reason="${reason}"]:not([disabled])`)
    .first();
  await expect(
    button,
    `return-tone "${reason}" should be visible and tappable`,
  ).toBeVisible({ timeout: WAIT_MS });
  await button.tap();
}

type OfferSnapshot = {
  ids: string[];
  byId: Record<string, { text: string; routeRisk: string | null }>;
};

async function snapshotOffers(page: Page): Promise<OfferSnapshot> {
  const offers = page.locator('[id^="job-offer-"]');
  await expect(
    offers.first(),
    "at least one job-offer must be rendered at packet-offered",
  ).toBeVisible({ timeout: WAIT_MS });
  const count = await offers.count();
  const snapshot: OfferSnapshot = { ids: [], byId: {} };
  for (let i = 0; i < count; i += 1) {
    const offer = offers.nth(i);
    const id = await offer.getAttribute("id");
    if (!id) continue;
    const text = (await offer.textContent())?.trim() ?? "";
    const routeRisk = await offer.getAttribute("data-route-risk");
    snapshot.ids.push(id);
    snapshot.byId[id] = { text, routeRisk };
  }
  snapshot.ids.sort();
  return snapshot;
}

async function bootSlot(page: Page, slot: string): Promise<void> {
  await page.goto(`/aftersign/?slot=${encodeURIComponent(slot)}`, {
    waitUntil: "load",
  });
  await waitForReady(page);
  await waitForBeat(page, "packet-offered");
}

async function playOneDeliveryLoop(page: Page): Promise<void> {
  // Complete one full loop so the save records a prior delivery,
  // which is what flips computeOfferedJobs to the completed set.
  const safeOffer = page.locator("#job-offer-job-safe-delivery");
  await expect(
    safeOffer,
    "first-visit safe-default offer should be tappable",
  ).toBeVisible({ timeout: WAIT_MS });
  await safeOffer.tap();

  await page.locator("#packetButton").tap();
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
  await tapReturnReason(page, "blunt");
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-offered");
}

test.describe("AFTERSIGN two-save tappable divergence (served page)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("two real saves render divergent offered-job metadata, and reload of the completed save preserves it", async ({
    browser,
  }) => {
    test.setTimeout(COLD_START_MS);

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const slotFirstRun = `two-save-first-${stamp}`;
    const slotCompleted = `two-save-completed-${stamp}`;

    // Slot A — cold first visit in its own browser context so the
    // two saves cannot share in-memory state; the divergence must come
    // from what each `?slot=` rehydrates from the server-authoritative
    // store.
    const ctxA = await browser.newContext({
      viewport: PHONE_VIEWPORT,
      hasTouch: true,
      isMobile: true,
    });
    const pageA = await ctxA.newPage();
    await bootSlot(pageA, slotFirstRun);
    const firstRunOffers = await snapshotOffers(pageA);
    await ctxA.close();

    // Slot B — play one full delivery loop, so its durable save
    // records a completed outcome.  Then close the context; the next
    // step reboots the same slot to prove the divergence survives
    // reload from the real save.
    const ctxBSetup = await browser.newContext({
      viewport: PHONE_VIEWPORT,
      hasTouch: true,
      isMobile: true,
    });
    const pageBSetup = await ctxBSetup.newPage();
    await bootSlot(pageBSetup, slotCompleted);
    await playOneDeliveryLoop(pageBSetup);
    const completedOffersInSession = await snapshotOffers(pageBSetup);
    await ctxBSetup.close();

    // Slot B reload — fresh browser context, same `?slot=`; the
    // server-authoritative save is the only carrier of the completed
    // outcome across contexts.
    const ctxBReload = await browser.newContext({
      viewport: PHONE_VIEWPORT,
      hasTouch: true,
      isMobile: true,
    });
    const pageBReload = await ctxBReload.newPage();
    await bootSlot(pageBReload, slotCompleted);
    const completedOffersReloaded = await snapshotOffers(pageBReload);
    await ctxBReload.close();

    // Divergence: the two saves offer different tappable jobs.  Assert
    // on the concrete surface the served page ships — offer ids +
    // `data-route-risk` attribute — not on invented attributes.
    expect(
      firstRunOffers.ids,
      "first-visit save should offer exactly the safe-default job",
    ).toEqual(["job-offer-job-safe-delivery"]);
    expect(firstRunOffers.byId["job-offer-job-safe-delivery"].routeRisk).toBe(
      "low",
    );
    expect(
      firstRunOffers.byId["job-offer-job-safe-delivery"].text,
    ).toContain("Safe delivery");

    expect(
      completedOffersInSession.ids,
      "completed save should offer the divergent night-transfer + signed-receipt set",
    ).toEqual([
      "job-offer-job-night-transfer",
      "job-offer-job-signed-receipt",
    ]);
    expect(
      completedOffersInSession.byId["job-offer-job-night-transfer"].routeRisk,
    ).toBe("medium");
    expect(
      completedOffersInSession.byId["job-offer-job-signed-receipt"].routeRisk,
    ).toBe("low");

    // Divergence between saves.
    expect(
      completedOffersInSession.ids,
      "the two real saves must render different offer sets",
    ).not.toEqual(firstRunOffers.ids);
    const firstRunRisks = firstRunOffers.ids.map(
      (id) => firstRunOffers.byId[id].routeRisk,
    );
    const completedRisks = completedOffersInSession.ids.map(
      (id) => completedOffersInSession.byId[id].routeRisk,
    );
    expect(
      completedRisks,
      "route-risk divergence across the two saves must be visible in data-route-risk",
    ).not.toEqual(firstRunRisks);

    // Reload of the completed save reproduces the same offer set from
    // the persisted durable save.
    expect(
      completedOffersReloaded,
      "reloading the completed save must re-materialize its divergent offers",
    ).toEqual(completedOffersInSession);
  });
});
