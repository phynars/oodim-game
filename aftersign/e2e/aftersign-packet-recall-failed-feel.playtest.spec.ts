import { expect, test, type Page } from "@playwright/test";
import { aftersignPacketRecallLine } from "../../apps/web/src/aftersign/aftersignPacketRecallCopy.js";
import {
  PACKET_RECALL_LINE_DATA_ATTR,
  PACKET_RECALL_LINE_ID,
} from "../../apps/web/src/aftersign/aftersignPacketRecallRender.ts";

// AFTERSIGN failed-route recall — seeded prior run.
//
// The mechanic under test: when Io's durable memory carries a FAILED
// prior route (`state.player.routeRisk.succeeded === false`), the next
// `packet-offered` beat must (a) stamp the "failed" recall line
// authored in `aftersignPacketRecallCopy.js` on the `#packetRecallLine`
// sibling of `#line`, and (b) re-render the `#routeRiskChoice` tray
// with `repair-the-loss` in the offered set — the recovery axis Io
// foregrounds after a failure. See `computeOfferedActions` in
// `apps/web/src/aftersign/routeRiskMemory.ts:100-108`: only a
// `!memory.succeeded` fact yields `["repair-the-loss", ...]`.
//
// Why seed instead of drive: nothing in the tap flow writes
// `succeeded: false` — the served `renderRouteRiskChoice` onChoose
// callback in main.js records the run as succeeded. Tapping a route
// button on a fresh slot always produces `succeeded: true` (see the
// green sibling `aftersign-route-risk-outcome-line-served.spec.ts` at
// line 90: `{ lastRoute: "safe", succeeded: true }`). To reach the
// failed-memory branch this spec seeds the durable save through the
// authoritative endpoint `aftersign/main.js` reads at boot — the same
// lane `memory-divergence-phone-playtest.spec.ts` uses to force
// divergent offered-job sets — so the READ path from a real durable
// save round-trips into the played DOM.
//
// Scope guard (PR #2043 iter-1 & iter-2 blocked): this spec is the
// READ half of the memory axis — that a durable failed-route fact
// (a) renders the "failed" recall line and (b) surfaces the
// divergent offered-action set. It does NOT add a tap-and-reflow
// assertion on `repair-the-loss`. The sibling safe-route spec's
// `toBeHidden` shape does not transfer to this branch:
// `computeOfferedActions` returns `["repair-the-loss","take-the-long-way"]`
// for ANY `!memory.succeeded` fact, so whatever fact `main.js`'s
// route-risk `onChoose` writes for `repair-the-loss` cannot flip the
// tray off it (see reviewer note on iter-2 — AI008: unverified
// runtime premise). The WRITE half of `renderRouteRiskChoice` is
// already proved played-not-driven by
// `aftersign/e2e/route-risk-tray-hide-show-played.spec.ts` (a
// fresh-boot route-risk tap flips `data-render-signature` away from
// "fresh") and pure by
// `apps/web/src/aftersign/routeRiskMemory.consumer.test.ts`.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 10_000;
const COLD_START_MS = 45_000;

const BOOTSTRAP_PLAYER_ID = "local-slice-player";
const SAVE_ENDPOINT_BASE = "/aftersign/save";

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

// Seed the authoritative save with a completed-but-failed prior
// route-risk run. Payload shape mirrors `buildPersistPayload` in
// `aftersign/src/runtime/persistence.js`: top-level `beat`, `player`
// (carrying the routeRisk fact boot restores onto
// `state.player.routeRisk`), `packet`, `delivery`, `memory`, `save`.
async function seedFailedRouteRiskSave(
  page: Page,
  slot: string,
): Promise<void> {
  const encodedPlayerId = encodeURIComponent(BOOTSTRAP_PLAYER_ID);
  const encodedSlot = encodeURIComponent(slot);
  const saveUrl = `${SAVE_ENDPOINT_BASE}/${encodedPlayerId}/${encodedSlot}`;

  // Mirror `EMPTY_MEMORY_SAVE` from `memory-divergence-phone-playtest.spec.ts`
  // — the offer-set axis (`computeOfferedJobs`) reads `packet.delivered`
  // + top-level `memory[]` and shows `job-safe-delivery` when both are
  // empty/false. This spec taps `#job-offer-job-safe-delivery` below,
  // so the empty-memory shape is required. The failed-route fact is
  // orthogonal — it lives on `player.routeRisk` and drives the
  // `computeOfferedActions` axis, not the offered-job axis.
  const payload = {
    beat: "packet-offered",
    packet: { delivered: false, route: null, sealed: true, deliveredAt: null },
    delivery: { outcome: "unknown" },
    player: {
      id: BOOTSTRAP_PLAYER_ID,
      name: null,
      flags: { io_intro_seen: true },
      // THIS is the axis this spec exists to exercise: a durable
      // failed-route memory. `computeOfferedActions` returns
      // `["repair-the-loss", "take-the-long-way"]` for any
      // `!succeeded` memory (line 100-108 of routeRiskMemory.ts).
      routeRisk: { lastRoute: "safe", succeeded: false },
    },
    memory: [],
    save: { revision: 1 },
  };

  const putResponse = await page.request.put(saveUrl, {
    data: { payload },
    headers: { "content-type": "application/json" },
  });
  expect(
    putResponse.ok(),
    `seed PUT for slot ${slot} must succeed before page boot (HTTP ${putResponse.status()})`,
  ).toBe(true);

  const verifyResponse = await page.request.get(saveUrl, {
    headers: { accept: "application/json" },
  });
  expect(
    verifyResponse.ok(),
    `seed round-trip GET for slot ${slot} must succeed before page boot (HTTP ${verifyResponse.status()})`,
  ).toBe(true);

  const verifyBody = (await verifyResponse.json()) as {
    payload?: { player?: { routeRisk?: { succeeded?: boolean } } } | null;
  };
  expect(
    verifyBody.payload?.player?.routeRisk?.succeeded,
    `seed round-trip payload for slot ${slot} must carry the failed routeRisk fact`,
  ).toBe(false);
}

test.describe("AFTERSIGN failed-route recall (phone tap)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("Io names the failed route when the player returns for another packet", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `packet-recall-failed-${Date.now()}`;

    // Seed the durable failed-route memory BEFORE navigation — the
    // slot-scoped authoritative endpoint is the same authority
    // `aftersign/main.js` reads at boot, so the fact reaches
    // `state.player.routeRisk` before `renderText()` runs at
    // `packet-offered`.
    await seedFailedRouteRiskSave(page, slot);

    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");

    // (a) The recall paragraph stamps the "failed" branch — Io names
    // the setback and offers repair without inventing its cause. The stamp
    // lives on a sibling of `#line`, not on `#line` itself; the beat
    // dialogue axis is preserved.
    const recall = page.locator(`#${PACKET_RECALL_LINE_ID}`);
    await expect(
      recall,
      "recall paragraph must render at packet-offered when a prior failed route exists",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(recall).toHaveAttribute(
      PACKET_RECALL_LINE_DATA_ATTR,
      "failed",
    );
    await expect(recall).toHaveText(aftersignPacketRecallLine("failed"));

    // (b) The `#routeRiskChoice` tray, on the failed-memory branch,
    // must offer `repair-the-loss` — the recovery axis
    // `computeOfferedActions` foregrounds when
    // `state.player.routeRisk.succeeded === false`. Tap into the
    // packet-choice beat and pin the offer set: `repair-the-loss`
    // visible, and the succeeded-branch offers (`take-the-shortcut`,
    // `carry-a-fragile-packet`) absent.
    await page.locator("#job-offer-job-safe-delivery").tap();
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");

    const tray = page.locator("#routeRiskChoice");
    const repairRoute = tray.locator(
      'button[data-aftersign-tap-choice="repair-the-loss"]:not([disabled])',
    );
    await expect(
      repairRoute,
      "failed-memory tray must offer repair-the-loss",
    ).toBeVisible({ timeout: WAIT_MS });

    // Divergence pin: the succeeded-safe offers must NOT render on
    // the failed-memory branch. This is the read half of the
    // `computeOfferedActions` axis — a refactor that folds the
    // failed / succeeded branches together reds here BEFORE any
    // player-visible drift.
    await expect(
      tray.locator(
        'button[data-aftersign-tap-choice="take-the-shortcut"]',
      ),
      "succeeded-safe offer must NOT render on the failed-memory branch",
    ).toHaveCount(0);
    await expect(
      tray.locator(
        'button[data-aftersign-tap-choice="carry-a-fragile-packet"]',
      ),
      "succeeded-safe offer must NOT render on the failed-memory branch",
    ).toHaveCount(0);
  });
});
