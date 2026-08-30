import { expect, test, type Page } from "@playwright/test";

// M-LOOP-E1 — TWO-ROUND PHONE PLAYTEST (taps-only, boot → last-beat).
//
// This spec stitches the two milestone beats into ONE journey:
//
//   ROUND 1 — first visit (`packet.delivered === false`)
//     `computeOfferedJobs(undefined)` → `[SAFE_DEFAULT_JOB_ID]`
//     → `#job-offer-job-safe-delivery` is the ONLY visible offer.
//     Player takes it, plays the packet loop, returns to Io.
//
//   ROUND 2 — looped return (`packet.delivered === true`)
//     `computeOfferedJobs({ priorOutcome: "completed" })` →
//     `#job-offer-job-night-transfer` + `#job-offer-job-signed-receipt`
//     — a VISIBLY different offer set than round 1.
//
// Contract with the M-LOOP surface guard
// (`apps/web/src/aftersign/aftersignMemoryDivergencePlaytestSurface.test.ts`):
//   - taps-only: NO `window.__game.input.*` mutations. `window.__game`
//     is read as an assertion surface only (beat readiness).
//   - each visible dialogue/offer change between beats is asserted.
//   - the round-2 offered id set is asserted `not.toEqual` round 1.
//
// The helpers below are lifted verbatim from
// `aftersign/e2e/job-offers-played.spec.ts` — that spec proves the
// served packet flow. Keeping the tap sequence identical means this
// journey inherits the same beat contract; a served-renderer change
// reds BOTH specs together, which is the intended coupling.

const WAIT_MS = 10_000;
const COLD_START_MS = 30_000;

const phone = { width: 390, height: 844 };

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game
        ?.scene?.ready === true,
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
  await choice.click();
}

async function tapReturnReason(page: Page, reason: string): Promise<void> {
  const button = page
    .locator(`button[data-return-reason="${reason}"]:not([disabled])`)
    .first();
  await expect(
    button,
    `return-tone "${reason}" should be visible and tappable`,
  ).toBeVisible({ timeout: WAIT_MS });
  await button.click();
}

async function readOfferIds(page: Page): Promise<string[]> {
  return page
    .locator('[id^="job-offer-"]')
    .evaluateAll((offers) => offers.map((offer) => offer.id).sort());
}

test.describe("M-LOOP E1 — two-round phone playtest", () => {
  test.use({ viewport: phone, isMobile: true, hasTouch: true });

  test("a delivered job changes the visible offer set after returning to Io", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    // Unique slot per run — the default slot's prior state is not
    // deterministic across CI runs, and this journey depends on
    // round 1 starting from `packet.delivered === false`.
    const slot = `m-loop-e1-two-round-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    // ---- ROUND 1 — first visit, safe-default offer is the only one.
    await waitForBeat(page, "packet-offered");
    const round1Ids = await readOfferIds(page);
    expect(
      round1Ids,
      "first-visit round should offer exactly the safe default",
    ).toEqual(["job-offer-job-safe-delivery"]);

    const safeOffer = page.locator("#job-offer-job-safe-delivery");
    await expect(
      safeOffer,
      "safe-default offered job should render on the first visit",
    ).toBeVisible({ timeout: WAIT_MS });
    await safeOffer.click();

    // Play the packet loop through every visible beat — the served
    // renderer stamps `data-choice-id` / `data-return-reason`, so we
    // drive it through those authored tokens (getByRole/name would
    // guess at labels the renderer never exposes).
    await page.locator("#packetButton").click();
    await waitForBeat(page, "packet-choice");
    await expect(
      page.locator('[id^="job-offer-"]'),
      "job-offer buttons must not persist past the packet-offered beat",
    ).toHaveCount(0, { timeout: WAIT_MS });

    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "io-return-recognition");
    await tapReturnReason(page, "blunt");
    await waitForBeat(page, "return-tone-choice");
    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");
    await tapChoice(page, "deliver-packet");

    // ---- ROUND 2 — looped return, memory flipped, offer set diverges.
    await waitForBeat(page, "packet-offered");
    const round2Ids = await readOfferIds(page);

    expect(
      round2Ids,
      "looped return should offer the completed set (night-transfer + signed-receipt), not the safe default",
    ).toEqual([
      "job-offer-job-night-transfer",
      "job-offer-job-signed-receipt",
    ]);

    // Round-2 divergence guard — the offered id set MUST differ from
    // round 1, else the memory didn't flip to `priorOutcome: "completed"`.
    expect(
      round2Ids,
      "round-2 visible offer set must diverge from round-1",
    ).not.toEqual(round1Ids);

    // And each individual round-2 offer must be visibly rendered.
    await expect(
      page.locator("#job-offer-job-night-transfer"),
      "completed-set night-transfer offer should render after a delivery",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(
      page.locator("#job-offer-job-signed-receipt"),
      "completed-set signed-receipt offer should render after a delivery",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(
      page.locator("#job-offer-job-safe-delivery"),
      "safe-default offer must NOT render on the looped return — the divergent set replaces it",
    ).toHaveCount(0);
  });
});
