import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN M-LOOP — two durable saves, rendered tappable divergence.
//
// A phone player taps only visible controls. Each transition below is
// the SAME selector the canonical `m-continue-next-packet-loop.spec.ts`
// uses so a served-page playtest reads the shipped vocabulary:
//   • `#packetButton`                                       — packet-offered → packet-choice
//   • `button[data-choice-id="acknowledge-kiosk"]`          — route memory
//   • `button[data-choice-id="deliver-packet"]`             — commit packet
//   • `button[data-return-reason="blunt"]`                  — io-return-recognition → return-tone-choice
//   • `button[data-choice-id="ask-for-next-job"]`           — return-tone-choice → io-next-job
//   • `button[data-choice-id="deliver-packet"]` + `#packetButton` — io-next-job → fresh packet-offered
// `window.__game.scene.ready` is used only for boot readiness; every
// state transition is a real tap on a rendered element.

const WAIT_MS = 10_000;
const COLD_START_MS = 60_000;

const slot = (name: string) => `two-save-divergence-${name}-${Date.now()}`;

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
    `story line should reach beat "${beatId}"`,
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

async function tapReturnReason(page: Page, reason: "blunt" | "kind" | "evasive"): Promise<void> {
  const button = page
    .locator(`button[data-return-reason="${reason}"]:not([disabled])`)
    .first();
  await expect(
    button,
    `return-tone button "${reason}" should be visible`,
  ).toBeVisible({ timeout: WAIT_MS });
  await button.click();
}

async function openSlice(page: Page, saveSlot: string): Promise<void> {
  await page.goto(`/aftersign/?slot=${saveSlot}`, { waitUntil: "load" });
  // Boot gate: `#offeredJobs` boots with `data-visible="false"` in
  // aftersign/index.html:1194 and only flips true once boot readiness
  // + the `packet-offered` beat land. Removing these two waits
  // reds CI with `expect(#offeredJobs).toHaveAttribute("true")` —
  // fixed by keeping the same load-bearing gate every sibling spec
  // uses (see m-continue-next-packet-loop.spec.ts).
  await waitForReady(page);
  await waitForBeat(page, "packet-offered");
  await expect(page.locator("#offeredJobs")).toHaveAttribute(
    "data-visible",
    "true",
    { timeout: WAIT_MS },
  );
}

async function completeRound(page: Page): Promise<void> {
  // Every step below is a visible tap. Selectors chosen per beat:
  // reusing `#acknowledgeRouteButton` or `#deliverButton` at the
  // io-return / return-tone beats binds to the WRONG controls —
  // those ids belong to the route-memory + packet-deliver forks,
  // not the return-tone or ask-for-next-job forks.

  // packet-offered → packet-choice
  await page.locator("#packetButton").click();
  await waitForBeat(page, "packet-choice");

  // packet-choice: route memory then commit packet
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");

  // io-return-recognition: return-tone fork is `[data-return-reason]`,
  // not `#acknowledgeRouteButton` (that button belongs to the route
  // memory beat that already fired).
  await waitForBeat(page, "io-return-recognition");
  await tapReturnReason(page, "blunt");

  // return-tone-choice → io-next-job via `ask-for-next-job`, not
  // `deliver-packet` (that would try to re-commit the just-delivered
  // packet).
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");

  // io-next-job: player taps `deliver-packet` to start the NEXT
  // packet, which lands on a FRESH `packet-offered` render whose
  // offer set is what this spec compares against the fresh slot.
  await waitForBeat(page, "io-next-job");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-offered");
  await expect(page.locator("#offeredJobs")).toHaveAttribute(
    "data-visible",
    "true",
    { timeout: WAIT_MS },
  );
}

test.describe("M-LOOP two-save tappable divergence", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("a completed durable slot exposes a different tappable offer from a fresh slot", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    const freshSlot = slot("fresh");
    await openSlice(page, freshSlot);
    const freshOffers = await page
      .locator("#offeredJobs button[data-offer-fingerprint]")
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("data-offer-fingerprint")));
    await expect(page.locator("#job-offer-job-safe-delivery")).toBeVisible();

    const completedSlot = slot("completed");
    await openSlice(page, completedSlot);
    await completeRound(page);

    // Reload through the served page: the next offer set must come
    // back from the durable save, not remain only in this page's
    // live memory. Post-reload the save restores to `io-next-job`,
    // so we re-tap `deliver-packet` + `#packetButton` to re-enter
    // `packet-offered` and inspect the offer tray a returning
    // player actually sees.
    await page.reload({ waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "io-next-job");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "packet-offered");
    await expect(page.locator("#offeredJobs")).toHaveAttribute(
      "data-visible",
      "true",
      { timeout: WAIT_MS },
    );

    const completedOffers = await page
      .locator("#offeredJobs button[data-offer-fingerprint]")
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("data-offer-fingerprint")));

    expect(completedOffers).not.toEqual(freshOffers);
    await expect(page.locator("#job-offer-job-night-transfer")).toBeVisible();
    await page.locator("#job-offer-job-night-transfer").click();
    await expect(page.locator("#job-offer-job-night-transfer")).toHaveAttribute(
      "data-aftersign-job-take",
      "armed",
    );
  });
});
