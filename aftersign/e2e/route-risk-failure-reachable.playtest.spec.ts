import { expect, test, type Page } from "@playwright/test";
import { aftersignPacketRecallLine } from "../../apps/web/src/aftersign/aftersignPacketRecallCopy.js";
import {
  PACKET_RECALL_LINE_DATA_ATTR,
  PACKET_RECALL_LINE_ID,
} from "../../apps/web/src/aftersign/aftersignPacketRecallRender.ts";
import { ROUTE_RISK_CHOICE_LOCK_MS } from "../../apps/web/src/aftersign/routeRiskChoiceIntent.ts";

// AFTERSIGN #2401 — a fresh player can reach the failed-route state
// through normal taps alone.
//
// Prior to #2401 the ONLY writer of `routeRisk.succeeded = false` was
// `repair-the-loss`, which is itself gated on a prior failed run (see
// `aftersign/src/keptSealRouteRisk.js`: `hideActions:
// ["repair-the-loss"]` when `routeRisk == null`). So on a fresh slot
// the failed branch — and every line of recall copy keyed on `failed`
// — was unreachable. #2401 made the fragile packet record
// `succeeded: false`: a visible, player-caused failure (reviewer F2
// — the failure must be player-visible, not just a snapshot flip).
//
// This spec is the drive-not-seed companion to the seeded
// `aftersign-packet-recall-failed-feel.playtest.spec.ts`. It proves
// a fresh player can make Io remember a failed run, by running the
// same loop that spec seeds — then asserting the player-visible
// `#packetRecallLine` renders with the `failed` branch of
// `aftersignPacketRecallCopy.js`.
//
// Shape mirrors `aftersign-packet-recall-feel.playtest.spec.ts` (the
// green sibling for the SAFE round-trip), swapping the SAFE route tap
// for a LIT-STAIR → FRAGILE pair that fails on main.
//
// Review F2 was AI003 against the earlier draft of this spec, which
// polled only `window.__game.getSnapshot()`. The current assertions
// are player-visible DOM, not harness snapshots:
//   (1) the served `#packetRecallLine` paragraph renders at round-2
//       `packet-offered` with `data-aftersign-packet-recall="failed"`
//       (the only token `aftersignPacketRecallToken` emits for
//       `succeeded === false` — a route-class refactor that silently
//       drops the failed branch reds here);
//   (2) the paragraph's text matches `aftersignPacketRecallLine("failed")`
//       — source of truth is the copy module, not a pinned literal
//       (AI003 guard — a literal would pass after any copy reword);
//   (3) `#packetRecallLine` lives on a sibling of `#line`, not an
//       overwrite — same seam discipline the SAFE round-trip pins.
// The sibling seeded spec `aftersign-packet-recall-failed-feel`
// already pins the `repair-the-loss` offer on the `!succeeded`
// branch; this spec's job is to prove the READ path reaches that
// seeded fixture from a fresh slot, not to re-pin the write.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 10_000;
const COLD_START_MS = 45_000;

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

test.describe("AFTERSIGN failed-route reachable without seed (#2401)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a fresh player tapping fragile records a failed run, and the next offer visibly recalls it", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `route-risk-failure-${Date.now()}`;
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
    // Same sequence as the sibling #2179 outcome spec.
    const tray = page.locator("#routeRiskChoice");
    await expect(tray).toHaveAttribute("data-visible", "true", {
      timeout: WAIT_MS,
    });
    const litStair = tray.locator(
      'button[data-aftersign-tap-choice="take-the-long-way"]:not([disabled])',
    );
    await expect(litStair).toBeVisible({ timeout: WAIT_MS });
    await litStair.tap();
    // Clear the 180ms route-risk tap lock before the fragile tap.
    const unlockAfter = await page.evaluate(
      (lockMs) => Date.now() + lockMs,
      ROUTE_RISK_CHOICE_LOCK_MS,
    );
    await page.waitForFunction(
      (deadline) => Date.now() >= deadline,
      unlockAfter,
      { timeout: WAIT_MS },
    );

    const fragile = tray.locator(
      'button[data-aftersign-tap-choice="carry-a-fragile-packet"]:not([disabled])',
    );
    await expect(fragile).toBeVisible({ timeout: WAIT_MS });
    await fragile.tap();
    // Tray's own hide is the player-facing proof the fragile tap
    // committed — same posture as the SAFE round-trip sibling.
    await expect(fragile).toBeHidden({ timeout: WAIT_MS });

    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");

    await waitForBeat(page, "io-return-recognition");
    await tapReturnReason(page, "blunt");

    await waitForBeat(page, "return-tone-choice");
    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");
    await tapChoice(page, "deliver-packet");

    // ── ROUND 2 — the player-visible proof of the failed run ──────────
    // #2401 acceptance: "After that failure, repair-the-loss is
    // offered on the next run, AND the failed-route recall line
    // (#packetRecallLine) renders."
    await waitForBeat(page, "packet-offered");

    const recall = page.locator(`#${PACKET_RECALL_LINE_ID}`);
    await expect(
      recall,
      "recall paragraph must render at round-2 packet-offered when the fragile run failed",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(recall).toHaveAttribute(
      PACKET_RECALL_LINE_DATA_ATTR,
      "failed",
    );
    // Source of truth: the copy module. A pinned literal would make
    // this pass trivially after any copy reword (AI003 — same
    // reasoning as the pinned-literal guard on the #2179 spec).
    const expectedRecall = aftersignPacketRecallLine("failed");
    expect(expectedRecall).not.toBe("");
    await expect(recall).toHaveText(expectedRecall);

    // Sibling discipline (mirrors the SAFE round-trip): the recall
    // paragraph must sit RIGHT after `#line`, not overwrite it, so
    // the beat-owned dialogue table stays untouched.
    const line = page.locator("#line");
    await expect(line).toBeVisible({ timeout: WAIT_MS });
    const lineText = (await line.textContent())?.trim() ?? "";
    const recallText = (await recall.textContent())?.trim() ?? "";
    expect(
      lineText,
      "beat dialogue line must not be overwritten by the failed-route recall paragraph",
    ).not.toBe(recallText);
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
      "failed-route recall paragraph must be the immediate next sibling of #line",
    ).toBe(true);
  });
});
