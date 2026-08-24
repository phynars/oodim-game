// aftersign/e2e/job-offers-played.spec.ts
//
// Real-tap e2e for #1393: the served page must be able to REACH the
// divergent completed-set of `#offeredJobs` buttons at the
// `packet-offered` beat with a completed prior delivery in memory.
//
// This spec is intentionally standalone — it does NOT drive input
// through the harness (`window.__game.input.choose(...)`). Every
// choice is expressed as a real DOM tap on the shipped button, so
// the divergent branch of `computeOfferedJobs` (proved element-
// level in the vitest harness) is now proved on the served page.
//
// Preconditions in aftersign/main.js (see #1395 for the required
// runtime patches):
//   1. The next-packet loop (`ask-for-next-job` → `io-next-job` →
//      deliver tap) re-enters at `packet-offered`, not
//      `packet-choice`.
//   2. `state.packet.delivered` has been reset to `false` at that
//      re-entry, so the beat is live and `#offeredJobs` renders,
//      BUT a durable `priorOutcome: "completed"` marker survives
//      (either via `state.npcs.io.memory` `delivery-outcome` fact
//      or a new completed-loop flag) so
//      `deriveOfferedJobsPlayerMemory` maps to the completed set.
//
// If either precondition regresses, this spec goes red at the
// waitForBeat / assertion below — that's the point.

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

type Beat =
  | "packet-offered"
  | "packet-choice"
  | "packet-delivered"
  | "io-return-recognition"
  | "return-tone-choice"
  | "io-next-job";

const isolatedSlot = () => `job-offers-played-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const gotoAftersign = async (page: Page, slot: string) => {
  await page.goto(`/aftersign/?slot=${slot}`);
  // Wait for the shipped surface to publish state.
  await page.waitForFunction(() => Boolean((window as any).__game?.scene?.beat));
};

const currentBeat = async (page: Page): Promise<Beat> =>
  (await page.evaluate(() => (window as any).__game.scene.beat)) as Beat;

const waitForBeat = async (page: Page, beat: Beat, timeoutMs = 10_000) => {
  await page.waitForFunction(
    (expected) => (window as any).__game?.scene?.beat === expected,
    beat,
    { timeout: timeoutMs },
  );
};

// Tap the packet button hard enough to commit the "sealed" fork.
// The served surface reads a real pointerdown/pointerup sequence,
// so a click() on the shipped `#packetButton` is what the player's
// finger would do at the packet-offered beat.
const tapPacketSealed = async (page: Page) => {
  const button = page.locator("#packetButton");
  await expect(button).toBeVisible();
  await button.click();
};

const tapAcknowledgeRoute = async (page: Page) => {
  const button = page.locator("#acknowledgeRouteButton");
  await expect(button).toBeVisible();
  await button.click();
};

const tapDeliver = async (page: Page) => {
  const button = page.locator("#deliverButton");
  await expect(button).toBeVisible();
  await button.click();
};

// Recognition-beat tone button — any posture works for reaching
// the loop; we pick "kind" so the state stays in the safest lane.
const tapRecognitionKind = async (page: Page) => {
  const button = page.locator('[data-return-reason="kind"]').first();
  await expect(button).toBeVisible();
  await button.click();
};

// Io's "ask for next job" button on the io-next-job beat — this is
// the tap that (after #1395) routes back to `packet-offered` with a
// completed-loop marker intact.
const tapAskForNextJob = async (page: Page) => {
  const button = page.locator('[data-choice-id="ask-for-next-job"]').first();
  await expect(button).toBeVisible();
  await button.click();
};

test.describe("#1393 — served page reaches packet-offered with completed prior delivery", () => {
  test("real-tap next-packet loop re-enters packet-offered and renders the completed-set offered jobs", async ({
    page,
  }) => {
    const slot = isolatedSlot();
    await gotoAftersign(page, slot);

    // Fresh boot lands on `packet-offered` (or `arrival` that
    // immediately advances). Wait for the first playable beat.
    await page.waitForFunction(() => {
      const beat = (window as any).__game?.scene?.beat;
      return beat === "packet-offered" || beat === "arrival";
    });
    if ((await currentBeat(page)) === "arrival") {
      await waitForBeat(page, "packet-offered");
    }

    // First delivery — all real taps.
    await tapPacketSealed(page);
    await waitForBeat(page, "packet-choice");
    await tapAcknowledgeRoute(page);
    await tapDeliver(page);
    await waitForBeat(page, "packet-delivered");

    // Advance through Io's recognition + tone fork to reach
    // `io-next-job`, where the ask-for-next-job tap fires.
    await waitForBeat(page, "io-return-recognition");
    await tapRecognitionKind(page);
    await waitForBeat(page, "return-tone-choice");
    // The return-tone-choice beat auto-advances on its own tap
    // (see io-continue-beats-tap-playtest.spec.ts for the shape);
    // reuse the same recognition tap-through pattern.
    await tapRecognitionKind(page).catch(() => {
      /* if the beat already auto-advanced, ignore */
    });
    await waitForBeat(page, "io-next-job");

    // The critical tap: after #1395's routing patch, this re-enters
    // `packet-offered` (NOT `packet-choice`) with a completed prior
    // delivery preserved in memory.
    await tapAskForNextJob(page);
    await waitForBeat(page, "packet-offered");

    // Assert the durable completed marker survived the loop —
    // either as a `delivery-outcome` memory fact on Io, or as a
    // completed-loop marker on player state. Both are acceptable
    // shapes (see #1393 acceptance criteria: "restore path
    // preserves a completed-loop marker separate from
    // packet.delivered").
    const priorCompleted = await page.evaluate(() => {
      const g = (window as any).__game;
      const facts = g?.npcs?.io?.memory ?? [];
      const hasDeliveryFact = Array.isArray(facts)
        && facts.some(
          (fact: { kind?: string }) => fact?.kind === "delivery-outcome",
        );
      const completedLoop = Boolean(g?.player?.completedLoop)
        || Boolean(g?.player?.priorDelivery);
      return { hasDeliveryFact, completedLoop };
    });
    expect(priorCompleted.hasDeliveryFact || priorCompleted.completedLoop).toBe(true);

    // The divergent completed-set of offered-job buttons must render
    // on the served page — this is the surface the harness proved
    // element-level but the served page could not reach before #1393.
    const nightTransfer = page.locator("#job-offer-job-night-transfer");
    const signedReceipt = page.locator("#job-offer-job-signed-receipt");
    await expect(nightTransfer).toBeVisible();
    await expect(signedReceipt).toBeVisible();

    // The safe-default (fresh-boot) button must NOT render at this
    // beat — its presence would mean `deriveOfferedJobsPlayerMemory`
    // still saw an empty prior-outcome and served the safe-default
    // set instead of the completed set.
    const safeDefault = page.locator('[data-safe-default-offered-job="true"]');
    await expect(safeDefault).toHaveCount(0);
  });
});
