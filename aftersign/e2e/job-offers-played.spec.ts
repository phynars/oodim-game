import { expect, test, type Locator, type Page } from "@playwright/test";

// AFTERSIGN — `computeOfferedJobs` served-page divergence, real-tap.
//
// This plays the served packet loop rather than mutating game state:
//
//   FIRST VISIT (packet.delivered === false)
//     `computeOfferedJobs(undefined)` → `[SAFE_DEFAULT_JOB_ID]`
//     → `#job-offer-job-safe-delivery` is visible.
//
//   RETURNING PLAYER (packet.delivered === true after the first loop)
//     `computeOfferedJobs({ priorOutcome: "completed" })` →
//     → `#job-offer-job-night-transfer` + `#job-offer-job-signed-receipt`
//
// Metadata guard: each served offer button must preserve its authored
// player-facing label and expose its authored route-risk tier through the
// canonical `data-route-risk` attribute.

const WAIT_MS = 10_000;
const COLD_START_MS = 30_000;

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

async function expectOfferMetadata(
  offer: Locator,
  expected: { text: string; routeRisk: "safe" | "risky" | "repair" },
): Promise<void> {
  await expect(offer, "offer label must come from the authored job row").toHaveText(
    expected.text,
  );
  await expect(
    offer,
    "offer must expose the authored route-risk token for runtime consumers",
  ).toHaveAttribute("data-route-risk", expected.routeRisk);
}

test.describe("AFTERSIGN computeOfferedJobs — real-tap played divergence", () => {
  test("first visit offers the safe default; the looped return offers the completed set", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `job-offers-played-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    // FIRST VISIT — the safe-default button must render with its authored
    // label and route-risk metadata; completed-set buttons must be absent.
    await waitForBeat(page, "packet-offered");
    const safeOffer = page.locator("#job-offer-job-safe-delivery");
    await expect(
      safeOffer,
      "safe-default offered job should render on the first visit",
    ).toBeVisible({ timeout: WAIT_MS });
    await expectOfferMetadata(safeOffer, {
      text: "Safe delivery",
      routeRisk: "safe",
    });
    await safeOffer.click();
    await expect(
      page.locator("#job-offer-job-night-transfer"),
      "completed-set offer should NOT render before any delivery",
    ).toHaveCount(0);
    await expect(
      page.locator("#job-offer-job-signed-receipt"),
      "completed-set offer should NOT render before any delivery",
    ).toHaveCount(0);

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

    // LOOPED RETURN — the completed set replaces the safe default.
    await waitForBeat(page, "packet-offered");
    const nightTransferOffer = page.locator("#job-offer-job-night-transfer");
    await expect(
      nightTransferOffer,
      "completed-set night-transfer offer should render after a delivery",
    ).toBeVisible({ timeout: WAIT_MS });
    await expectOfferMetadata(nightTransferOffer, {
      text: "Night transfer",
      routeRisk: "risky",
    });

    const signedReceiptOffer = page.locator("#job-offer-job-signed-receipt");
    await expect(
      signedReceiptOffer,
      "completed-set signed-receipt offer should render after a delivery",
    ).toBeVisible({ timeout: WAIT_MS });
    await expectOfferMetadata(signedReceiptOffer, {
      text: "Signed receipt",
      routeRisk: "repair",
    });

    await expect(
      page.locator("#job-offer-job-safe-delivery"),
      "safe-default offer must NOT render at the looped packet-offered — the divergent completed set replaces it",
    ).toHaveCount(0);
  });
});
