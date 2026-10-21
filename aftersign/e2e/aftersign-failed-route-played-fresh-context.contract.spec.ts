import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  PACKET_RECALL_LINE_DATA_ATTR,
  PACKET_RECALL_LINE_ID,
} from "../../apps/web/src/aftersign/aftersignPacketRecallRender.ts";
import { ROUTE_RISK_CHOICE_LOCK_MS } from "../../apps/web/src/aftersign/routeRiskChoiceIntent.ts";

// This contract drives the player-visible failure path from an empty slot,
// then proves the resulting fact is recovered from the server in a browser
// context with no copied storage. It deliberately does not seed a save.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 10_000;
const COLD_START_MS = 45_000;
const PLAYER_ID = "local-slice-player";
const SAVE_ENDPOINT_BASE = "/aftersign/save";

type RouteRiskSave = {
  payload?: {
    player?: { routeRisk?: { lastRoute?: string; succeeded?: boolean } };
  } | null;
};

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
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({
    timeout: WAIT_MS,
  });
}

test.describe("AFTERSIGN played failed-route durable-save contract", () => {
  test("a fresh player's fragile packet failure survives a storage-free browser session", async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    test.setTimeout(COLD_START_MS);
    const slot = `played-failed-route-${Date.now()}`;
    const firstSession = await browser.newContext({
      viewport: PHONE_VIEWPORT,
      hasTouch: true,
      isMobile: true,
    });

    try {
      const firstPage = await firstSession.newPage();
      await firstPage.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
      await waitForReady(firstPage);
      await waitForBeat(firstPage, "packet-offered");

      await firstPage.locator("#job-offer-job-safe-delivery").tap();
      await firstPage.locator("#packetButton").tap();
      await waitForBeat(firstPage, "packet-choice");

      // On a fresh slot `computeOfferedActions(null)` returns only
      // ["repair-the-loss", "take-the-long-way"] — fragile isn't on the
      // tray yet. Tap the lit stair first (records safe/succeeded:true),
      // wait out the 180ms route-risk tap lock, then tap fragile — which
      // overwrites the memory to fast/succeeded:false, the condition this
      // contract pins across a fresh browser context. See the sibling
      // `aftersign-route-risk-outcome-line-served.spec.ts` #2179+#2401 case
      // (safeRouteButton → wait → fragile) for the same ritual.
      const tray = firstPage.locator("#routeRiskChoice");
      const litStair = tray.locator(
        'button[data-aftersign-tap-choice="take-the-long-way"]:not([disabled])',
      );
      await expect(litStair).toBeVisible({ timeout: WAIT_MS });
      await litStair.tap();

      const unlockAfter = await firstPage.evaluate(
        (lockMs) => Date.now() + lockMs,
        ROUTE_RISK_CHOICE_LOCK_MS,
      );
      await firstPage.waitForFunction(
        (deadline) => Date.now() >= deadline,
        unlockAfter,
        { timeout: WAIT_MS },
      );

      const fragile = tray.locator(
        'button[data-aftersign-tap-choice="carry-a-fragile-packet"]:not([disabled])',
      );
      await expect(fragile).toBeVisible({ timeout: WAIT_MS });
      await fragile.tap();

      const saveUrl = `${SAVE_ENDPOINT_BASE}/${encodeURIComponent(PLAYER_ID)}/${encodeURIComponent(slot)}`;
      await expect
        .poll(
          async () => {
            const response = await firstPage.request.get(saveUrl);
            const saved = (await response.json()) as RouteRiskSave;
            return saved.payload?.player?.routeRisk?.succeeded;
          },
          { timeout: WAIT_MS },
        )
        .toBe(false);
    } finally {
      await firstSession.close();
    }

    const returningSession = await browser.newContext({
      viewport: PHONE_VIEWPORT,
      hasTouch: true,
      isMobile: true,
    });

    try {
      const returningPage = await returningSession.newPage();
      await returningPage.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
      await waitForReady(returningPage);
      await waitForBeat(returningPage, "packet-offered");

      const recall = returningPage.locator(`#${PACKET_RECALL_LINE_ID}`);
      await expect(recall).toBeVisible({ timeout: WAIT_MS });
      await expect(recall).toHaveAttribute(PACKET_RECALL_LINE_DATA_ATTR, "failed");
    } finally {
      await returningSession.close();
    }
  });
});
