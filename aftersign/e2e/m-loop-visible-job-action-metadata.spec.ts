import { expect, test, type Locator, type Page } from "@playwright/test";

// AFTERSIGN — M-LOOP played job action metadata (phone viewport).
//
// This is the phone-viewport sibling of `job-offers-played.spec.ts`.
// It pins the SHIPPED served-page contract that a first-visit player
// on a phone sees the safe-default offered job with:
//   • its authored player-facing label ("Safe delivery")
//   • its authored route-risk token exposed via `data-route-risk="low"`
//     (aftersign/main.js:1795 — `IoJobOffer.routeRisk` → attribute)
//
// Beyond the metadata pin, the spec drives the loop with the same
// deterministic primitives as `job-offers-played.spec.ts`:
// `waitForBeat` on the visible `[data-beat-id]` node + `tapChoice`
// on `button[data-choice-id]`, and asserts loop completion by the
// visible presence of the `io-return-recognition` beat node — NOT
// via `window.__game.getSnapshot()`. No harness hooks, no timing
// races, no dead-id branches.

const PHONE = { width: 390, height: 844 };
const WAIT_MS = 10_000;
const COLD_START_MS = 30_000;

test.use({
  hasTouch: true,
  viewport: PHONE,
});

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

async function tapSelector(page: Page, selector: string): Promise<void> {
  const button = page.locator(selector);
  await expect(button, `${selector} should be visible`).toBeVisible({
    timeout: WAIT_MS,
  });
  await expect(button, `${selector} should be enabled`).toBeEnabled({
    timeout: WAIT_MS,
  });
  await button.tap();
}

async function expectOfferMetadata(
  offer: Locator,
  expected: { label: string; routeRisk: "low" | "medium" | "high" },
): Promise<void> {
  // The served renderer stamps textContent as
  // `${offer.label} · ${offer.routeRisk} risk` (aftersign/main.js:1796)
  // and stamps `data-route-risk` from the authored token. Assert both
  // so drift on either axis reds the spec.
  await expect(
    offer,
    "offer text must combine the authored label with the authored route-risk token",
  ).toHaveText(`${expected.label} · ${expected.routeRisk} risk`);
  await expect(
    offer,
    "offer must expose the authored route-risk token via data-route-risk",
  ).toHaveAttribute("data-route-risk", expected.routeRisk);
}

test.describe("M-LOOP played job actions (phone)", () => {
  test("a phone player sees a tappable safe-default job offer with authored label + route-risk metadata, and can play through to io-return-recognition", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `m-loop-visible-job-action-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

    await page.goto(`/aftersign/?slot=${encodeURIComponent(slot)}`, {
      waitUntil: "load",
    });
    await waitForReady(page);

    // First visit: safe-default offered job renders with authored
    // label + route-risk metadata on a phone viewport.
    await waitForBeat(page, "packet-offered");
    const safeOffer = page.locator("#job-offer-job-safe-delivery");
    await expect(
      safeOffer,
      "safe-default offered job should render on the first visit",
    ).toBeVisible({ timeout: WAIT_MS });
    await expectOfferMetadata(safeOffer, {
      label: "Safe delivery",
      routeRisk: "low",
    });
    await safeOffer.tap();

    // Deterministic drive of the served packet loop via visible
    // affordances — same primitives as job-offers-played.spec.ts.
    await tapSelector(page, "#packetButton");
    await waitForBeat(page, "packet-choice");
    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");

    // Loop completion is asserted through the DOM: the beat node for
    // `io-return-recognition` becomes visible. No harness snapshot read.
    await waitForBeat(page, "io-return-recognition");
  });
});
