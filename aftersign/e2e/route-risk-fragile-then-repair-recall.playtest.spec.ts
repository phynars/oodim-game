import { expect, test, type Page } from "@playwright/test";
import { aftersignPacketRecallLine } from "../../apps/web/src/aftersign/aftersignPacketRecallCopy.js";
import {
  PACKET_RECALL_LINE_DATA_ATTR,
  PACKET_RECALL_LINE_ID,
} from "../../apps/web/src/aftersign/aftersignPacketRecallRender.ts";
import { ROUTE_RISK_CHOICE_LOCK_MS } from "../../apps/web/src/aftersign/routeRiskChoiceIntent.ts";

// AFTERSIGN #2401 / #2458 — a fresh player reaches BOTH failed-route
// recalls through normal taps alone, with no seeded save. Supersedes
// `route-risk-failure-reachable.playtest.spec.ts`.
//
// #2401 made the fragile packet record `succeeded: false`: a visible,
// player-caused failure that unlocks `repair-the-loss` on the next run.
// #2458: Io's recall for that run must name the fragile carry
// (`fragile`), not the generic failure line — `aftersignPacketRecallToken`
// keys the fragile carry on `lastAction` before the `succeeded` flag.
// The generic `failed` recall stays reachable by play: tapping the
// unlocked `repair-the-loss` records another failed run whose
// `lastAction` is `repair-the-loss`, and the run after that recalls
// `failed`.
//
// Assertions are player-visible DOM, sourced from the copy module (no
// pinned literals — AI003):
//   (1) round 2 `#packetRecallLine` = `fragile` after the fragile tap;
//   (2) it is the immediate next sibling of `#line`, not an overwrite;
//   (3) after a real reload (gated on the server save carrying the
//       PLAYED fact — read-only GET, no seed) the recall is still
//       `fragile` and the tray offers `repair-the-loss` only;
//   (4) tapping `repair-the-loss` and playing the loop makes round 3
//       `#packetRecallLine` = `failed`.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 10_000;
const COLD_START_MS = 120_000;
const BOOTSTRAP_PLAYER_ID = "local-slice-player";
const SAVE_ENDPOINT_BASE = "/aftersign/save";

type SavedRouteRisk = { succeeded?: boolean; lastAction?: string };

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
  // Sibling spec note (packet-recall-feel): on mobile Chromium a
  // `.tap()` here can remain pending after the beat commits. A
  // pointer click still exercises the visible enabled control and
  // lets the next beat assertion synchronize.
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
  await button.tap();
}

async function waitOutChoiceLock(page: Page): Promise<void> {
  const unlockAfter = await page.evaluate(
    (lockMs) => Date.now() + lockMs,
    ROUTE_RISK_CHOICE_LOCK_MS,
  );
  await page.waitForFunction(
    (deadline) => Date.now() >= deadline,
    unlockAfter,
    { timeout: WAIT_MS },
  );
}

// Deliver, answer Io, ask for the next job, and start the next run.
async function playLoopToNextOffer(page: Page): Promise<void> {
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

async function pollSavedRouteRisk(
  page: Page,
  slot: string,
  expected: SavedRouteRisk,
  message: string,
): Promise<void> {
  const saveUrl = `${SAVE_ENDPOINT_BASE}/${encodeURIComponent(BOOTSTRAP_PLAYER_ID)}/${encodeURIComponent(slot)}`;
  await expect
    .poll(
      async () => {
        const response = await page.request.get(saveUrl, {
          headers: { accept: "application/json" },
        });
        if (!response.ok()) return null;
        const body = (await response.json()) as {
          payload?: { player?: { routeRisk?: SavedRouteRisk } } | null;
        };
        const rr = body.payload?.player?.routeRisk;
        return rr ? { succeeded: rr.succeeded, lastAction: rr.lastAction } : null;
      },
      { timeout: WAIT_MS, message },
    )
    .toEqual(expected);
}

test.describe("AFTERSIGN failed-route recalls reachable without seed (#2401 / #2458)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("fragile carry recalls fragile; repair-the-loss then recalls failed", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `route-risk-fragile-repair-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    // ── ROUND 1 — fresh visit; no recall paragraph exists yet ─────────
    await waitForBeat(page, "packet-offered");
    expect(
      await page.locator(`#${PACKET_RECALL_LINE_ID}`).count(),
      "no recall paragraph on the first visit — nothing to remember yet",
    ).toBe(0);

    await page.locator("#job-offer-job-safe-delivery").tap();
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");

    // Lit stair → unlocks `carry-a-fragile-packet` on the fast tray.
    const tray = page.locator("#routeRiskChoice");
    await expect(tray).toHaveAttribute("data-visible", "true", {
      timeout: WAIT_MS,
    });
    const litStair = tray.locator(
      'button[data-aftersign-tap-choice="take-the-long-way"]:not([disabled])',
    );
    await expect(litStair).toBeVisible({ timeout: WAIT_MS });
    await litStair.tap();
    await waitOutChoiceLock(page);

    const fragile = tray.locator(
      'button[data-aftersign-tap-choice="carry-a-fragile-packet"]:not([disabled])',
    );
    await expect(fragile).toBeVisible({ timeout: WAIT_MS });
    await fragile.tap();
    // The failed fact rebuilds the tray onto the recovery axis, which
    // does not include fragile — the player-facing proof of the commit.
    await expect(fragile).toBeHidden({ timeout: WAIT_MS });

    await playLoopToNextOffer(page);

    // ── ROUND 2 — Io names the fragile carry, not a generic failure ──
    const fragileRecall = aftersignPacketRecallLine("fragile");
    const failedRecall = aftersignPacketRecallLine("failed");
    expect(fragileRecall).not.toBe("");
    expect(failedRecall).not.toBe("");
    const recall = page.locator(`#${PACKET_RECALL_LINE_ID}`);
    await expect(
      recall,
      "recall paragraph must render at round-2 packet-offered after the fragile run",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(recall).toHaveAttribute(PACKET_RECALL_LINE_DATA_ATTR, "fragile");
    await expect(recall).toHaveText(fragileRecall);
    await expect(recall).not.toHaveText(failedRecall);

    const isNextSibling = await page.evaluate(
      ({ lineId, recallId }) => {
        const l = document.getElementById(lineId);
        const r = document.getElementById(recallId);
        return Boolean(l && r && l.nextElementSibling === r);
      },
      { lineId: "line", recallId: PACKET_RECALL_LINE_ID },
    );
    expect(
      isNextSibling,
      "recall paragraph must be the immediate next sibling of #line",
    ).toBe(true);

    // ── RELOAD — gated on the server holding the PLAYED fragile fact ──
    await pollSavedRouteRisk(
      page,
      slot,
      { succeeded: false, lastAction: "carry-a-fragile-packet" },
      "the played fragile run must be durable on the server before reload",
    );

    await page.reload({ waitUntil: "load" });
    await waitForReady(page);

    // Cold boot may restore `io-next-job` (last forceSave) or
    // `packet-offered`; from `io-next-job` the visible `deliver-packet`
    // starts the next run, same as round 1's loop.
    const restoredBeat = page.locator(
      '[data-beat-id="packet-offered"], [data-beat-id="io-next-job"]',
    );
    await expect(
      restoredBeat.first(),
      "reload must restore into the next run (io-next-job or packet-offered)",
    ).toBeVisible({ timeout: WAIT_MS });
    if ((await restoredBeat.first().getAttribute("data-beat-id")) === "io-next-job") {
      await tapChoice(page, "deliver-packet");
    }
    await waitForBeat(page, "packet-offered");

    const recallAfterReload = page.locator(`#${PACKET_RECALL_LINE_ID}`);
    await expect(
      recallAfterReload,
      "fragile recall paragraph must survive a reload",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(recallAfterReload).toHaveAttribute(
      PACKET_RECALL_LINE_DATA_ATTR,
      "fragile",
    );
    await expect(recallAfterReload).toHaveText(fragileRecall);

    // The fragile run failed, so the next tray is the recovery axis.
    const nextRunPacket = page.locator("#packetButton");
    await expect(nextRunPacket).toBeEnabled({ timeout: WAIT_MS });
    await nextRunPacket.click();
    await waitForBeat(page, "packet-choice");

    const nextTray = page.locator("#routeRiskChoice");
    await expect(nextTray).toHaveAttribute("data-visible", "true", {
      timeout: WAIT_MS,
    });
    const repair = nextTray.locator(
      'button[data-aftersign-tap-choice="repair-the-loss"]:not([disabled])',
    );
    await expect(
      repair,
      "after the failed fragile run, the next run must offer repair-the-loss",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(
      nextTray.locator('button[data-aftersign-tap-choice="take-the-shortcut"]'),
      "succeeded-branch offer must not render after a failed run",
    ).toHaveCount(0);
    await expect(
      nextTray.locator('button[data-aftersign-tap-choice="carry-a-fragile-packet"]'),
      "succeeded-branch offer must not render after a failed run",
    ).toHaveCount(0);

    // ── ROUND 3 — repair-the-loss is the played writer of `failed` ───
    await waitOutChoiceLock(page);
    await repair.tap();
    await pollSavedRouteRisk(
      page,
      slot,
      { succeeded: false, lastAction: "repair-the-loss" },
      "the repair-the-loss tap must persist a failed fact",
    );

    await playLoopToNextOffer(page);

    const recallRound3 = page.locator(`#${PACKET_RECALL_LINE_ID}`);
    await expect(
      recallRound3,
      "played repair-the-loss run must render the failed-route recall",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(recallRound3).toHaveAttribute(PACKET_RECALL_LINE_DATA_ATTR, "failed");
    await expect(recallRound3).toHaveText(failedRecall);
  });
});
