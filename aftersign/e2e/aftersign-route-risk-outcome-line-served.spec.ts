import { expect, test, type Page } from "@playwright/test";
import { aftersignRouteOutcomeLine } from "../../apps/web/src/aftersign/aftersignRouteOutcomeCopy.js";

// AFTERSIGN #1963 — route-outcome line rendered on the served page.
//
// The wire under review adds a route-risk-aware branch to the
// `packet-delivered` line in `aftersign/main.js` (`lineForBeat`).
// When `state.player.routeRisk.succeeded === true` and
// `lastRoute === "safe"` (or `"fast"`), Io speaks the authored
// route-outcome line from
// `apps/web/src/aftersign/aftersignRouteOutcomeCopy.js` INSTEAD
// of the generic "clean handoff" line — a durable acknowledgement
// that the player ran the light-side (or dark-side) route, not
// merely selected a job.
//
// Soren's review on the first two drafts blocked on the copy module
// existing in isolation with NO played-through e2e that taps a real
// route-risk button and asserts the shipped `#line` DOM node speaks
// the authored outcome literal. This spec is that proof — played,
// not driven — for BOTH fork values.
//
// SAFE fork — round-1 fresh boot (test 1):
//   1. Reach `packet-choice` through the shipped tap funnel
//      (`#job-offer-job-safe-delivery` → `#packetButton` → keep
//      sealed) so the route-risk tray is rendered against a real
//      served surface.
//   2. Tap the SAFE route action (`take-the-long-way`) inside the
//      `#routeRiskChoice` tray — the same button any player would
//      touch. This is the ONLY route into the `succeeded: true /
//      lastRoute: "safe"` fact from the offered-action set on a
//      fresh boot (see routeRiskMemory.ts::computeOfferedActions).
//   3. Acknowledge the kiosk + deliver the packet to advance the
//      beat to `packet-delivered` — the beat whose line the wire
//      diverts.
//   4. Assert `#line`.textContent is the SAFE outcome literal
//      verbatim (element-level, not snapshot-only), and is
//      distinctly NOT the fresh "clean handoff" line.
//
//   This test's tap sequence — SAFE tap → acknowledge-kiosk →
//   deliver-packet → packet-delivered — was authored and merged
//   green in PR #1963; it is the shipped, proven surface for the
//   SAFE fork.
//
// FAST fork — round-2 with pre-seeded routeRisk memory (test 2):
//
//   The FAST action `take-the-shortcut` is only offered when
//   `computeOfferedActions` sees a prior memory of
//   `{ lastRoute: "safe", succeeded: true }` on `state.player.routeRisk`
//   (routeRiskMemory.ts:111). The natural way to plant that fact is
//   to play a full SAFE round-1, then loop through
//   `io-return-recognition → return-tone-choice → io-next-job →
//   deliver-packet → packet-offered` back into round-2 — but that
//   route-through-the-loop sequence AFTER a route-risk tap is not
//   verified by any shipped sibling spec. `m-loop-e1-two-round-playtest.spec.ts`
//   drives the same loop WITHOUT tapping a route-risk button; PR #1963
//   only proves the surface up to `packet-delivered` on round-1;
//   no other spec taps a route-risk button and then advances beyond
//   `packet-delivered`. Six prior iterations of this PR that tried
//   to prove that unverified transition hung the CI runner
//   (AI008 in the reviewer's taxonomy).
//
//   To ship FAST coverage on a proven surface, this test seeds the
//   round-1 memory fact through the same authoritative save endpoint
//   `aftersign/main.js` reads at boot — the mechanism the sibling
//   `memory-divergence-phone-playtest.spec.ts:117-146` uses to plant
//   completed-loop memory without playing the loop. The seeded save
//   carries:
//
//     - `player.routeRisk = { lastRoute: "safe", succeeded: true }`
//       so `computeOfferedActions` stamps `take-the-shortcut` into
//       the round-2 route-risk tray on boot.
//     - `packet.delivered = true` + `delivery.outcome = "sealed"` +
//       Io's `memory[]` facts so `packet-offered` renders the
//       looped-return job set the sibling memory-divergence spec
//       pins (`job-night-transfer`, `job-signed-receipt`), matching
//       the `computeOfferedJobs({ priorOutcome: "completed" })`
//       contract.
//
//   The single tap sequence then exercised is:
//
//     packet-offered → tap returning-offer → `#packetButton` →
//     packet-choice → tap `take-the-shortcut` → acknowledge-kiosk →
//     deliver-packet → packet-delivered → assert `#line`.
//
//   That's the SAME sequence PR #1963 shipped green for SAFE, just
//   entered from a seeded looped-return memory instead of a fresh
//   boot. No `io-return-recognition` transition after a route-risk
//   tap, no round-1-to-round-2 loop across a route-risk fact — the
//   unverified premise Soren blocked on is not in the sequence.
//
// A regression in the route-outcome wire (branch dropped, null
// return silently defaulted, wrong literal, or lookup keyed on the
// wrong axis) reds this spec on the exact surface the player reads.

const WAIT_MS = 10_000;
const COLD_START_MS = 45_000;

const SAFE_OUTCOME_LINE =
  "You kept to the light. It saw you home. I noted that.";
const FRESH_DELIVERED_LINE =
  "Done. Blue route, clean handoff. Come back after the rain; I will know the mark was yours.";

const BOOTSTRAP_PLAYER_ID = "local-slice-player";
const SAVE_ENDPOINT_BASE = "/aftersign/save";

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

// Funnel from cold boot to `packet-choice` on a FRESH slot. On a fresh
// boot the shipped surface stamps `#job-offer-job-safe-delivery` at
// `packet-offered`; the player picks it, then taps `#packetButton` to
// enter `packet-choice`. Mirrors the round-1 funnel in
// `m-loop-e1-two-round-playtest.spec.ts:111-121`.
async function reachPacketChoiceFresh(page: Page): Promise<void> {
  await waitForBeat(page, "packet-offered");
  const jobOffer = page.locator("#job-offer-job-safe-delivery");
  await expect(
    jobOffer,
    "fresh-boot packet-offered must stamp #job-offer-job-safe-delivery",
  ).toBeVisible({ timeout: WAIT_MS });
  await jobOffer.tap();
  const packetButton = page.locator("#packetButton");
  await expect(
    packetButton,
    "#packetButton must be tappable after picking a job at packet-offered",
  ).toBeEnabled({ timeout: WAIT_MS });
  await packetButton.tap();
  await waitForBeat(page, "packet-choice");
}

// From the route-choice tray, advance the beat to `packet-delivered`
// through the shipped kiosk acknowledgement + delivery choices. Called
// AFTER the SAFE / FAST route action has been tapped and the routeRisk
// fact has been committed to the snapshot. This is the exact tail PR
// #1963 shipped green for the SAFE fork.
async function deliverFromRouteChoice(page: Page): Promise<void> {
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-delivered");
}

async function snapshotRouteRisk(page: Page): Promise<{
  lastRoute?: string;
  succeeded?: boolean;
} | null> {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __game?: {
            getSnapshot: () => {
              player?: {
                routeRisk?: { lastRoute?: string; succeeded?: boolean } | null;
              };
            };
          };
        }
      ).__game?.getSnapshot().player?.routeRisk ?? null,
  );
}

async function snapshotIoLine(page: Page): Promise<string | null> {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __game?: {
            getSnapshot: () => {
              npcs: { io: { lastLine?: string | null } };
            };
          };
        }
      ).__game?.getSnapshot().npcs.io.lastLine ?? null,
  );
}

// PUT a full authoritative save through the same endpoint
// `aftersign/main.js` reads at boot. Mirrors the seed helper in
// `memory-divergence-phone-playtest.spec.ts:117-146` — same endpoint,
// same round-trip verify, same discipline. Verifies the round-trip
// GET before returning so a downstream boot cannot silently miss
// the seed.
async function seedAuthoritativeSave(
  page: Page,
  slot: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const encodedPlayerId = encodeURIComponent(BOOTSTRAP_PLAYER_ID);
  const encodedSlot = encodeURIComponent(slot);
  const saveUrl = `${SAVE_ENDPOINT_BASE}/${encodedPlayerId}/${encodedSlot}`;

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
}

test.describe("AFTERSIGN packet-delivered route-outcome line — safe fork (#1963)", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("tapping the SAFE route action speaks the authored SAFE outcome line at packet-delivered", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `route-outcome-safe-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    // 1. Funnel to packet-choice through the shipped tap surface.
    await reachPacketChoiceFresh(page);

    // 2. Tap the SAFE route action inside the route-risk tray. On a
    //    fresh boot (no prior routeRisk fact), computeOfferedActions
    //    returns `["repair-the-loss", "take-the-long-way"]`; the
    //    "take-the-long-way" action is the ONLY route into the
    //    `succeeded: true / lastRoute: "safe"` fact the delivered-
    //    line branch keys on.
    const tray = page.locator("#routeRiskChoice");
    await expect(
      tray,
      "route-risk tray must be visible at packet-choice for the SAFE tap to land",
    ).toHaveAttribute("data-visible", "true", { timeout: WAIT_MS });
    const safeRouteButton = tray.locator(
      'button[data-aftersign-tap-choice="take-the-long-way"]:not([disabled])',
    );
    await expect(
      safeRouteButton,
      "the SAFE route action button must be a real tappable element",
    ).toBeVisible({ timeout: WAIT_MS });
    await safeRouteButton.tap();

    // Confirm the tap landed on a live handler — routeRisk fact
    // should now be recorded on the snapshot as
    // `{ lastRoute: "safe", succeeded: true }`. Without this, the
    // wire's branch guard `routeMemory && routeMemory.succeeded`
    // silently fails and we'd read the base line without the tap
    // ever having committed.
    await expect.poll(() => snapshotRouteRisk(page), { timeout: WAIT_MS }).toEqual({
      lastRoute: "safe",
      succeeded: true,
    });

    // 3. Acknowledge the kiosk + deliver the packet.
    await deliverFromRouteChoice(page);

    // 4. Assert the shipped `#line` DOM node speaks the SAFE outcome
    //    literal verbatim, and is distinctly NOT the fresh
    //    "clean handoff" line. Element-level, not snapshot-only —
    //    a regression that only wires the snapshot (or writes a
    //    different id) reds here.
    const line = page.locator("#line");
    await expect(line).toBeVisible({ timeout: WAIT_MS });
    await expect(
      line,
      "#line must speak the authored SAFE route-outcome line at packet-delivered",
    ).toHaveText(SAFE_OUTCOME_LINE, { timeout: WAIT_MS });
    const spokenText = (await line.textContent()) ?? "";
    expect(
      spokenText,
      "packet-delivered after a SAFE route tap must diverge from the fresh 'clean handoff' line",
    ).not.toBe(FRESH_DELIVERED_LINE);

    // Cross-check against the snapshot so a future refactor that
    // splits the DOM writer from `lineForBeat` cannot let the two
    // views drift silently.
    expect(
      await snapshotIoLine(page),
      "snapshot lastLine must match the DOM #line — one axis, no drift",
    ).toBe(SAFE_OUTCOME_LINE);
  });

  test("tapping the FAST route action speaks the authored FAST outcome line at packet-delivered", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    const fastOutcomeLine = aftersignRouteOutcomeLine("fast");
    expect(
      fastOutcomeLine,
      "FAST route must have authored outcome copy",
    ).not.toBeNull();

    const slot = `route-outcome-fast-${Date.now()}`;

    // Seed the routeRisk memory fact + completed-loop packet state
    // through the authoritative save endpoint BEFORE boot. Boot
    // hydrates `state.player.routeRisk` from `player.routeRisk` and
    // Io's `state.npcs.io.memory` from `memory[]`; the served page
    // then renders `packet-offered` with the looped-return job set
    // (per `memory-divergence-phone-playtest.spec.ts`) and the
    // route-risk tray will render `take-the-shortcut` at
    // `packet-choice` (per routeRiskMemory.ts:111).
    //
    // Payload shape mirrors `memory-divergence-phone-playtest.spec.ts`'s
    // `COMPLETED_MEMORY_SAVE`, with one addition: `player.routeRisk`
    // carrying the SAFE-succeeded fact.
    await seedAuthoritativeSave(page, slot, {
      beat: "packet-offered",
      packet: {
        delivered: true,
        route: "blue rainline",
        sealed: true,
        deliveredAt: "2026-01-01T00:00:00.000Z",
      },
      delivery: { outcome: "sealed" },
      player: {
        id: BOOTSTRAP_PLAYER_ID,
        name: null,
        flags: { io_intro_seen: true },
        routeRisk: { lastRoute: "safe", succeeded: true },
      },
      memory: [
        {
          id: "fact-delivery-outcome-seeded",
          kind: "delivery-outcome",
          subject: "io",
          object: "sealed",
          sessionId: "session-seeded",
        },
        {
          id: "fact-route-attention-seeded",
          kind: "route-attention",
          subject: "io",
          object: "done",
          sessionId: "session-seeded",
        },
      ],
      save: { revision: 1 },
    });

    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    // Confirm the seeded routeRisk fact hydrated onto the runtime
    // snapshot. If this poll times out, the memory fact never
    // reached `state.player.routeRisk` and `take-the-shortcut`
    // won't render below — naming it here localizes the blame
    // instead of surfacing as an opaque `toBeVisible` timeout on
    // the FAST button.
    await expect
      .poll(() => snapshotRouteRisk(page), { timeout: WAIT_MS })
      .toEqual({ lastRoute: "safe", succeeded: true });

    // Funnel to packet-choice through the looped-return job offer.
    // `memory-divergence-phone-playtest.spec.ts:213-232` proves that
    // a save with `packet.delivered = true` +
    // `delivery.outcome = "sealed"` + `memory[]` carrying the
    // delivery-outcome + route-attention facts renders exactly the
    // `["job-night-transfer", "job-signed-receipt"]` offer set at
    // `packet-offered` and that the beat funnels to `packet-choice`
    // via the SAME `#packetButton` tap used on the fresh-boot lane.
    await waitForBeat(page, "packet-offered");
    const returningOffer = page
      .locator(
        "#job-offer-job-night-transfer:not([disabled]), #job-offer-job-signed-receipt:not([disabled])",
      )
      .first();
    await expect(
      returningOffer,
      "seeded looped-return save must render a returning-player job offer (job-night-transfer or job-signed-receipt) — see memory-divergence-phone-playtest.spec.ts:213-232",
    ).toBeVisible({ timeout: WAIT_MS });
    await returningOffer.tap();

    const packetButton = page.locator("#packetButton");
    await expect(
      packetButton,
      "#packetButton must be tappable after picking a job at packet-offered",
    ).toBeEnabled({ timeout: WAIT_MS });
    await packetButton.tap();
    await waitForBeat(page, "packet-choice");

    // Tap the FAST route action. The seeded SAFE-succeeded memory
    // is exactly the input `computeOfferedActions` reads to emit
    // `["take-the-shortcut", "carry-a-fragile-packet"]`
    // (routeRiskMemory.ts:111), so `take-the-shortcut` is a real
    // tappable button at this point.
    const tray = page.locator("#routeRiskChoice");
    await expect(
      tray,
      "route-risk tray must be visible at packet-choice for the FAST tap to land",
    ).toHaveAttribute("data-visible", "true", { timeout: WAIT_MS });
    const fastRouteButton = tray.locator(
      'button[data-aftersign-tap-choice="take-the-shortcut"]:not([disabled])',
    );
    await expect(
      fastRouteButton,
      "the FAST route action button must be a real tappable element (offered because the seeded memory carries { lastRoute: 'safe', succeeded: true })",
    ).toBeVisible({ timeout: WAIT_MS });
    await fastRouteButton.tap();

    // Confirm the FAST tap flipped the runtime memory fact.
    await expect
      .poll(() => snapshotRouteRisk(page), { timeout: WAIT_MS })
      .toEqual({ lastRoute: "fast", succeeded: true });

    // Acknowledge + deliver — same tail as the SAFE test above,
    // the shipped-green sequence from PR #1963.
    await deliverFromRouteChoice(page);

    // Assert the shipped `#line` DOM node speaks the FAST outcome
    // literal verbatim. Element-level, not snapshot-only.
    const line = page.locator("#line");
    await expect(line).toBeVisible({ timeout: WAIT_MS });
    await expect(
      line,
      "#line must speak the authored FAST route-outcome line at packet-delivered",
    ).toHaveText(fastOutcomeLine!, { timeout: WAIT_MS });
    expect(
      await snapshotIoLine(page),
      "snapshot lastLine must match the FAST DOM #line — one axis, no drift",
    ).toBe(fastOutcomeLine);
  });
});
