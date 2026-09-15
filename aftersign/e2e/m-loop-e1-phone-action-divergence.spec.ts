import { expect, test, type Page } from "@playwright/test";

// M2-E1 continuous cold-boot playtest. Player input is exclusively through
// visible controls; __game is read only for state assertions.
const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 20_000;
const SERVED_BUTTON_IDS = ["#deliverButton", "#acknowledgeRouteButton", "#skipRouteButton"] as const;

type FlagshipSnapshot = {
  scene?: { beat?: string };
  packet?: { delivered?: boolean; sealed?: boolean };
  delivery?: { outcome?: string };
  player?: { returnReason?: string | null };
};

type ActionState = {
  id: (typeof SERVED_BUTTON_IDS)[number];
  present: boolean;
  enabled: boolean;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  interface Window {
    __game?: {
      version?: number;
      scene?: { ready?: boolean; beat?: string };
      getSnapshot?: () => FlagshipSnapshot;
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

async function snapshot(page: Page): Promise<FlagshipSnapshot> {
  await waitForReady(page);
  return page.evaluate(() => window.__game!.getSnapshot!());
}

async function waitForBeat(page: Page, beat: string): Promise<FlagshipSnapshot> {
  await expect
    .poll(async () => (await snapshot(page)).scene?.beat, { timeout: WAIT_MS })
    .toBe(beat);
  return snapshot(page);
}

async function tap(page: Page, selector: (typeof SERVED_BUTTON_IDS)[number]): Promise<void> {
  const button = page.locator(selector);
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await button.tap();
}

async function offeredActionStates(page: Page): Promise<ActionState[]> {
  return Promise.all(
    SERVED_BUTTON_IDS.map(async (id) => {
      const button = page.locator(id);
      const present = await button.count().then(Boolean);
      const visible = present ? await button.isVisible().catch(() => false) : false;
      const enabled = visible ? await button.isEnabled().catch(() => false) : false;
      return { id, present: visible, enabled };
    }),
  );
}

function enabledActionIds(actions: ActionState[]): string[] {
  return actions.filter((action) => action.present && action.enabled).map((action) => action.id);
}

function expectDeliveredOutcome(state: FlagshipSnapshot): void {
  // The delivery fact and its outcome must travel together: neither a
  // successful-looking delivery without an outcome nor an orphaned outcome is valid.
  expect(state.packet?.delivered).toBe(true);
  expect(state.delivery?.outcome).toBeTruthy();
}

async function completeReturn(
  page: Page,
  tone: "#acknowledgeRouteButton" | "#skipRouteButton",
): Promise<FlagshipSnapshot> {
  await waitForBeat(page, "io-return-recognition");
  await expect(page.locator("#acknowledgeRouteButton")).toContainText(/kind return/i);
  await expect(page.locator("#skipRouteButton")).toContainText(/evasive return/i);
  await expect(page.locator("#deliverButton")).toContainText(/blunt return/i);
  await tap(page, tone);

  await waitForBeat(page, "return-tone-choice");
  await expect(page.locator("#deliverButton")).toContainText(/ask for next job/i);
  await tap(page, "#deliverButton");
  return waitForBeat(page, "io-next-job");
}

test.describe("M2-E1: continuous two-round phone playtest", () => {
  test("cold boots once, completes two delivery-return rounds, and preserves the risk outcome", async ({ browser }) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({
      viewport: PHONE_VIEWPORT,
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    const slot = `m2-e1-continuous-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      // A unique slot gives this player a cold session; this test never reseeds or reloads it.
      await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
      await waitForReady(page);
      await waitForBeat(page, "packet-offered");
      await expect(page.locator("#acknowledgeRouteButton")).toBeDisabled();
      await expect(page.locator("#skipRouteButton")).toBeDisabled();

      const roundOneActions = enabledActionIds(await offeredActionStates(page));
      expect(roundOneActions).toEqual(["#deliverButton"]);
      await tap(page, "#deliverButton");
      // tap() only awaits the pointer event; delivery advances the beat
      // asynchronously (packet-delivered → io-return-recognition ~1180ms
      // later). Gate the snapshot on the post-delivery beat so
      // packet.delivered / delivery.outcome are actually populated.
      const roundOneDelivery = await waitForBeat(page, "io-return-recognition");
      expectDeliveredOutcome(roundOneDelivery);

      const afterRoundOne = await completeReturn(page, "#acknowledgeRouteButton");
      expect(afterRoundOne.player?.returnReason).toBeTruthy();
      expectDeliveredOutcome(afterRoundOne);

      // io-next-job is the directly reached second offer: no new context, seed, or reload.
      const roundTwoActions = enabledActionIds(await offeredActionStates(page));
      expect(roundTwoActions).not.toEqual(roundOneActions);
      expect(roundTwoActions).toContain("#deliverButton");
      await tap(page, "#deliverButton");
      // Same asynchronous transition as round one: wait for the delivery
      // beat before reading packet.delivered.
      const roundTwoDelivery = await waitForBeat(page, "io-return-recognition");
      expectDeliveredOutcome(roundTwoDelivery);
      expect(roundTwoDelivery.delivery?.outcome).toBe(roundOneDelivery.delivery?.outcome);

      const afterRoundTwo = await completeReturn(page, "#skipRouteButton");
      expect(afterRoundTwo.player?.returnReason).toBeTruthy();
      expectDeliveredOutcome(afterRoundTwo);
      expect(afterRoundTwo.delivery?.outcome).toBe(roundOneDelivery.delivery?.outcome);
    } finally {
      await context.close();
    }
  });
});
