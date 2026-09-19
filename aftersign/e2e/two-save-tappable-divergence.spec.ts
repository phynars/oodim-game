import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN — M-LOOP durable-save divergence, played through the rendered page.
// Two independent save slots must expose different tappable job actions once one
// player has completed a round. The test only reads window.__game for readiness;
// all player actions use visible touch controls.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 10_000;
const COLD_START_MS = 180_000;

type OfferSnapshot = {
  ids: string[];
  byId: Record<string, { text: string; routeRisk: string | null }>;
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
  await expect(
    page.locator(`[data-beat-id="${beatId}"]`),
    `story line should visibly reach beat "${beatId}"`,
  ).toBeVisible({ timeout: WAIT_MS });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page
    .locator(`button[data-choice-id="${choiceId}"]:not([disabled])`)
    .first();
  await expect(choice, `choice "${choiceId}" should be tappable`).toBeVisible({
    timeout: WAIT_MS,
  });
  await choice.tap();
}

async function tapReturnReason(page: Page, reason: string): Promise<void> {
  const button = page
    .locator(`button[data-return-reason="${reason}"]:not([disabled])`)
    .first();
  await expect(button, `return tone "${reason}" should be tappable`).toBeVisible({
    timeout: WAIT_MS,
  });
  await button.tap();
}

async function bootSlot(page: Page, slot: string): Promise<void> {
  await page.goto(`/aftersign/?slot=${encodeURIComponent(slot)}`, {
    waitUntil: "load",
  });
  await waitForReady(page);
  await waitForBeat(page, "packet-offered");
}

async function snapshotOffers(page: Page): Promise<OfferSnapshot> {
  const offers = page.locator('[id^="job-offer-"]');
  await expect(
    offers.first(),
    "at least one rendered job offer must be visible",
  ).toBeVisible({ timeout: WAIT_MS });

  const snapshot: OfferSnapshot = { ids: [], byId: {} };
  for (let index = 0; index < (await offers.count()); index += 1) {
    const offer = offers.nth(index);
    const id = await offer.getAttribute("id");
    if (!id) continue;
    snapshot.ids.push(id);
    snapshot.byId[id] = {
      text: (await offer.textContent())?.trim() ?? "",
      routeRisk: await offer.getAttribute("data-route-risk"),
    };
  }
  snapshot.ids.sort();
  return snapshot;
}

async function persistBeforeReload(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const game = (
      window as unknown as {
        __game?: {
          input?: {
            forceSave?: () => Promise<unknown> | unknown;
            waitForStoryIdle?: () => Promise<unknown> | unknown;
          };
        };
      }
    ).__game;
    if (!game?.input?.forceSave) {
      throw new Error("window.__game.input.forceSave is missing");
    }
    await game.input.forceSave();
    await game.input.waitForStoryIdle?.();
  });
}

async function completeOneRound(page: Page): Promise<void> {
  const safeOffer = page.locator("#job-offer-job-safe-delivery");
  await expect(safeOffer, "first visit should render the safe job").toBeVisible({
    timeout: WAIT_MS,
  });
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

  test("two durable saves render different job actions and completed-save reload is deterministic", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const firstRunSlot = `two-save-first-${nonce}`;
    const completedSlot = `two-save-completed-${nonce}`;

    await bootSlot(page, firstRunSlot);
    const firstRunOffers = await snapshotOffers(page);
    expect(firstRunOffers.ids).toEqual(["job-offer-job-safe-delivery"]);
    await expect(page.locator("#job-offer-job-safe-delivery")).toHaveAttribute(
      "data-route-risk",
      "low",
    );

    await bootSlot(page, completedSlot);
    await completeOneRound(page);
    const completedOffers = await snapshotOffers(page);
    expect(completedOffers.ids).toContain("job-offer-job-night-transfer");
    expect(completedOffers.ids).toContain("job-offer-job-signed-receipt");
    expect(completedOffers.ids).not.toEqual(firstRunOffers.ids);
    expect(completedOffers).not.toEqual(firstRunOffers);

    await persistBeforeReload(page);
    await bootSlot(page, completedSlot);
    expect(await snapshotOffers(page)).toEqual(completedOffers);
  });
});
