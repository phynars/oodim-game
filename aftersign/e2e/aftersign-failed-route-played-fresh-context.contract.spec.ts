import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  PACKET_RECALL_LINE_DATA_ATTR,
  PACKET_RECALL_LINE_ID,
} from "../../apps/web/src/aftersign/aftersignPacketRecallRender.ts";
import { ROUTE_RISK_CHOICE_LOCK_MS } from "../../apps/web/src/aftersign/routeRiskChoiceIntent.ts";

// AFTERSIGN played failed-route — fresh-context durable-save contract.
//
// This drives the failure path from an empty slot with real taps, then
// proves the resulting fact is recovered from the server in a browser
// context that was never given any copied storage. It deliberately
// seeds nothing.
//
// Flow premises (read off shipped code at session commit — the final
// arbiter is a green CI run):
//
//   • The fragile tap persists at `packet-choice`. In `aftersign/main.js`
//     the `renderRouteRiskChoice` onChoose (≈2285-2317) writes
//     `state.player.routeRisk = { ...recordRouteRun(...), lastAction }`
//     and calls `persistAuthoritative({ dirty: true })` — the beat
//     stays `packet-choice` (`setBeat` is NOT called in that handler).
//     So closing the browser right after the fragile tap would restore
//     a fresh context to `packet-choice`, where the recall paragraph is
//     NOT yet rendered: `renderText()` stamps `#packetRecallLine` only
//     when `state.scene.beat === "packet-offered"` (main.js ≈2344).
//
//   • To reach a state whose fresh-context restore lands on a beat the
//     recall paragraph CAN render, the first session plays on through
//     `acknowledge-kiosk` → `deliver-packet` → the return-tone beat
//     (`blunt`) → `ask-for-next-job`. The last tap calls
//     `setBeat("io-next-job")` followed by `await forceSave()`
//     (main.js ≈3754-3755) and writes the `save.ioNextJob` stamp read
//     back by `aftersign/main.js` restore at ≈4116-4127.
//
//   • A fresh `browser.newContext()` (no storage copied, no cookies)
//     navigating to the same `?slot=` reaches that same cold-boot
//     hydration path. `restoreFlagshipBeat`
//     (`aftersign/flagship-beat-migration.js`) only remaps the
//     `packet-delivered` + `!packet.delivered` pair; `io-next-job`
//     passes through, and the `ioNextJobStamp` block then parks the
//     player at `io-next-job`. Tapping `deliver-packet` from there
//     loops back to `packet-offered` — the beat whose `renderText()`
//     stamps the recall paragraph from `state.player.routeRisk`,
//     the exact fact persisted in the first session.
//
//   • Nothing in the tap flow writes `succeeded: false` by accident.
//     On a fresh slot `computeOfferedActions(null)` returns
//     `["repair-the-loss", "take-the-long-way"]` (routeRiskMemory.ts),
//     i.e. fragile is NOT on the tray. The ritual that unlocks fragile
//     is the one used by `aftersign-route-risk-outcome-line-served.spec.ts`:
//     tap `take-the-long-way` first (records safe/succeeded:true), wait
//     out `ROUTE_RISK_CHOICE_LOCK_MS`, then tap fragile — which
//     overwrites the memory to lastAction carry-a-fragile-packet,
//     fast/succeeded:false (a failed run). The save poll gates on that
//     lastAction so the earlier stair save cannot satisfy it; the
//     recall paragraph is then named by lastAction ("fragile"). That
//     is the fact this contract pins across a fresh browser context.
//
// Timeout budget mirrors the sibling specs that drive a full M-loop +
// a cross-boot restore (e.g. `m-loop-two-rounds-phone-playtest.spec.ts`
// at 120s, `aftersign-production-durable-authority.playtest.spec.ts`,
// `memory-prior-session.spec.ts` and `m-loop-divergent-offered-actions`
// at 90s): 90s is the budget range for one M-loop with a cross-context
// cold boot on SwiftShader. The 45s used in the first iteration of this
// spec is sized for single-beat specs and was the budget Mara flagged.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 10_000;
const COLD_START_MS = 90_000;
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

test.describe("AFTERSIGN fragile-packet durable-save contract", () => {
  test("a fresh player's fragile-packet recall survives a storage-free browser session", async ({
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

      // Fragile is not on the fresh-slot tray. Tap the lit stair first,
      // then wait out the choice lock before choosing the visible fragile
      // packet route; it overwrites memory with fast/succeeded:true.
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

      // Server-authoritative pin: the failed fragile-route fact
      // landed on the save the fresh context will read.
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
        .toBe(true);

      // Play on past packet-choice so the next cold boot lands on a
      // beat the recall paragraph can render. `ask-for-next-job` is
      // the beat whose handler forceSaves the `io-next-job` park
      // stamp — the one the fresh-context restore reads below.
      await tapChoice(firstPage, "acknowledge-kiosk");
      await tapChoice(firstPage, "deliver-packet");

      await waitForBeat(firstPage, "io-return-recognition");
      await tapReturnReason(firstPage, "blunt");

      await waitForBeat(firstPage, "return-tone-choice");
      await tapChoice(firstPage, "ask-for-next-job");
      await waitForBeat(firstPage, "io-next-job");
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

      // Cold-boot restore in a storage-free context parks the player
      // at `io-next-job` (via the save.ioNextJob stamp forceSaved by
      // ask-for-next-job in the first session). Tap `deliver-packet`
      // from there to re-enter `packet-offered`, where renderText()
      // stamps the recall paragraph from the restored routeRisk.
      await waitForBeat(returningPage, "io-next-job");
      await tapChoice(returningPage, "deliver-packet");
      await waitForBeat(returningPage, "packet-offered");

      const recall = returningPage.locator(`#${PACKET_RECALL_LINE_ID}`);
      await expect(recall).toBeVisible({ timeout: WAIT_MS });
      await expect(recall).toHaveAttribute(PACKET_RECALL_LINE_DATA_ATTR, "fragile");
      await expect(recall).toContainText("carefully you carried the fragile packet");
      await expect(recall).toHaveText(/\S/);
    } finally {
      await returningSession.close();
    }
  });
});
