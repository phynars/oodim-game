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
// not driven — for BOTH fork values:
//
//   SAFE fork (round-1 fresh boot):
//     1. Reach `packet-choice` through the shipped tap funnel
//        (`#job-offer-job-safe-delivery` → `#packetButton` → keep
//        sealed) so the route-risk tray is rendered against a real
//        served surface.
//     2. Tap the SAFE route action (`take-the-long-way`) inside the
//        `#routeRiskChoice` tray — the same button any player would
//        touch. This is the ONLY route into the `succeeded: true /
//        lastRoute: "safe"` fact from the offered-action set on a
//        fresh boot (see routeRiskMemory.ts::computeOfferedActions).
//     3. Acknowledge the kiosk + deliver the packet to advance the
//        beat to `packet-delivered` — the beat whose line the wire
//        diverts.
//     4. Assert `#line`.textContent is the SAFE outcome literal
//        verbatim (element-level, not snapshot-only), and is
//        distinctly NOT the fresh "clean handoff" line.
//
//   FAST fork (round-2 after natural SAFE round-1):
//     Same played flow, then loops through
//     io-return-recognition (tap a return-reason) →
//     return-tone-choice → io-next-job → deliver-packet →
//     packet-offered to re-enter round-2. Round-1's SAFE tap has
//     already written `state.player.routeRisk = { lastRoute: "safe",
//     succeeded: true }`, which is exactly the memory
//     `computeOfferedActions` reads to stamp `take-the-shortcut`
//     into the round-2 route-risk tray (routeRiskMemory.ts:111).
//
// RUNTIME PREMISE — grounded in a shipped, working two-round spec:
//
//   The loop tap sequence used here is a VERBATIM MIRROR of
//   `aftersign/e2e/m-loop-e1-two-round-playtest.spec.ts`, which has
//   been green on this exact CI lane for milestones. In particular
//   that spec proves:
//
//     - After `deliver-packet` (from `packet-choice`), the runner
//       DOES land on `[data-beat-id="io-return-recognition"]` — it
//       is NOT a transient beat that vanishes before Playwright
//       observes it (m-loop-e1-two-round-playtest.spec.ts:140).
//     - At `io-return-recognition` a player MUST tap a
//       `button[data-return-reason="..."]` (e.g. "blunt") to
//       advance to `return-tone-choice`
//       (m-loop-e1-two-round-playtest.spec.ts:143).
//     - At round-2 `packet-offered` the offered-job set diverges
//       from round-1: the player picks a REAL returning-player
//       offer (`#job-offer-job-night-transfer` or
//       `#job-offer-job-signed-receipt`) — NOT `#packetButton`
//       directly (m-loop-e1-two-round-playtest.spec.ts:151-155).
//
//   Prior iterations of this PR (5×) hedged those transitions with
//   an either-beat wait (`io-return-recognition` OR
//   `return-tone-choice`) and a `#packetButton`-only re-entry that
//   skipped the round-2 job-offer tap. Both encoded runtime
//   premises that contradict the sibling spec's proven behavior
//   and hung the runner (AI008 in the reviewer's taxonomy). This
//   revision drops the hedges and mirrors the sibling exactly.
//
// A regression in the route-outcome wire (branch dropped, null
// return silently defaulted, wrong literal, or lookup keyed on the
// wrong axis) reds this spec on the exact surface the player reads.

const WAIT_MS = 10_000;
const COLD_START_MS = 45_000;
// Two-round natural flow budget for the FAST fork — SAFE round-1
// records the routeRisk memory that gates round-2's
// `take-the-shortcut` render. The sibling
// `m-loop-e1-two-round-playtest.spec.ts` uses `COLD_START_MS` (45s)
// for the same two-round journey; we double it to 90s because we
// run an extra `deliverFromRouteChoice` in round-2 (2 more taps +
// beat waits) before asserting on the line.
const TWO_ROUND_FLOW_MS = 90_000;

const SAFE_OUTCOME_LINE =
  "You kept to the light. It saw you home. I noted that.";
const FRESH_DELIVERED_LINE =
  "Done. Blue route, clean handoff. Come back after the rain; I will know the mark was yours.";

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
// fact has been committed to the snapshot.
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
    // Two-round natural flow: round-1 SAFE tap sets
    // `state.player.routeRisk = { lastRoute: "safe", succeeded: true }`
    // (see routeRiskMemory.ts::recordRouteRun); the packet-offered →
    // packet-choice → packet-delivered → io-return-recognition →
    // return-tone-choice → io-next-job → deliver-packet →
    // packet-offered loop then re-enters `packet-choice` for round-2
    // with that memory intact, so
    // `computeOfferedActions({lastRoute:"safe",succeeded:true})`
    // emits `["take-the-shortcut","carry-a-fragile-packet"]`
    // (routeRiskMemory.ts:111) and the FAST button is rendered as a
    // real tappable element.
    //
    // The tap sequence below is a VERBATIM MIRROR of the working
    // sibling `m-loop-e1-two-round-playtest.spec.ts` — the same
    // beat waits, the same button selectors, in the same order.
    // That spec is green on this CI lane; any hang here would be a
    // regression on it too. Prior iterations of this PR hedged the
    // loop with premises that contradicted that sibling (an
    // either-beat wait for io-return-recognition, and a `#packetButton`-
    // only re-entry that skipped the round-2 job-offer tap); this
    // revision drops those hedges.
    test.setTimeout(TWO_ROUND_FLOW_MS);

    const fastOutcomeLine = aftersignRouteOutcomeLine("fast");
    expect(fastOutcomeLine, "FAST route must have authored outcome copy").not.toBeNull();

    const slot = `route-outcome-fast-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    // ─── ROUND 1 — SAFE run to record the routeRisk memory fact.
    await reachPacketChoiceFresh(page);

    const roundOneTray = page.locator("#routeRiskChoice");
    await expect(
      roundOneTray,
      "round-1 route-risk tray must be visible at packet-choice",
    ).toHaveAttribute("data-visible", "true", { timeout: WAIT_MS });
    const safeRouteButton = roundOneTray.locator(
      'button[data-aftersign-tap-choice="take-the-long-way"]:not([disabled])',
    );
    await expect(
      safeRouteButton,
      "round-1 SAFE route action must be tappable — this tap records the routeRisk fact that gates take-the-shortcut in round-2",
    ).toBeVisible({ timeout: WAIT_MS });
    await safeRouteButton.tap();

    // Confirm round-1's SAFE tap committed the memory fact — if
    // this poll times out, the routeRisk writer never fired and
    // round-2 cannot possibly render `take-the-shortcut`. Naming
    // the failure here localizes the blame instead of surfacing
    // as an opaque `toBeVisible` timeout on the FAST button.
    await expect
      .poll(() => snapshotRouteRisk(page), { timeout: WAIT_MS })
      .toEqual({ lastRoute: "safe", succeeded: true });

    await deliverFromRouteChoice(page);

    // ─── LOOP — packet-delivered → round-2 packet-choice.
    //
    // This sequence is a VERBATIM MIRROR of
    // `m-loop-e1-two-round-playtest.spec.ts:140-155`. That spec is
    // green on this CI lane; if any beat or tap here hangs, the
    // sibling would hang too — the loop shape has proven runtime
    // support on the served surface.

    // packet-delivered → io-return-recognition (real beat that the
    // sibling spec waits on directly and observes reliably; there
    // is no "transient window" to hedge against).
    await waitForBeat(page, "io-return-recognition");

    // Tap a return-reason to advance io-return-recognition →
    // return-tone-choice. "blunt" mirrors the sibling.
    await tapReturnReason(page, "blunt");

    // return-tone-choice → io-next-job.
    await waitForBeat(page, "return-tone-choice");
    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");

    // io-next-job → packet-offered (looped return-player offer set).
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "packet-offered");

    // Cross-check: the routeRisk fact from round-1 MUST still be
    // on the snapshot at round-2 packet-offered. `state.player` is
    // held in memory across the beat loop; no reload happens here,
    // so `state.player.routeRisk` from round-1's tap survives. If a
    // beat transition in the loop clears it, `take-the-shortcut`
    // won't render below and the reason wouldn't be obvious from
    // the downstream failure — naming it here localizes the blame.
    await expect
      .poll(() => snapshotRouteRisk(page), { timeout: WAIT_MS })
      .toEqual({ lastRoute: "safe", succeeded: true });

    // ─── ROUND 2 — packet-offered → packet-choice with the FAST
    // action offered. The looped `packet-offered` beat offers a
    // DIFFERENT job set than round-1 — the sibling spec proves
    // this concretely at :151-155:
    //
    //   `["job-offer-job-night-transfer", "job-offer-job-signed-receipt"]`
    //
    // Pick whichever offer is enabled first (either works — the
    // route-risk tray is offered inside the SAME packet-choice
    // beat regardless of which job the player accepted). This
    // mirrors the sibling's "returning player picks a real offer"
    // shape, not a fabricated `#packetButton`-direct re-entry.
    const returningOffer = page
      .locator(
        "#job-offer-job-night-transfer:not([disabled]), #job-offer-job-signed-receipt:not([disabled])",
      )
      .first();
    await expect(
      returningOffer,
      "round-2 packet-offered must render a returning-player job offer (job-night-transfer or job-signed-receipt) — see m-loop-e1-two-round-playtest.spec.ts:151-155",
    ).toBeVisible({ timeout: WAIT_MS });
    await returningOffer.tap();

    const packetButtonRound2 = page.locator("#packetButton");
    await expect(
      packetButtonRound2,
      "round-2 #packetButton must be tappable after picking the returning-player offer",
    ).toBeEnabled({ timeout: WAIT_MS });
    await packetButtonRound2.tap();
    await waitForBeat(page, "packet-choice");

    const roundTwoTray = page.locator("#routeRiskChoice");
    await expect(
      roundTwoTray,
      "round-2 route-risk tray must be visible at packet-choice for the FAST tap to land",
    ).toHaveAttribute("data-visible", "true", { timeout: WAIT_MS });
    const fastRouteButton = roundTwoTray.locator(
      'button[data-aftersign-tap-choice="take-the-shortcut"]:not([disabled])',
    );
    await expect(
      fastRouteButton,
      "the FAST route action button must be a real tappable element at round-2 packet-choice (offered because round-1 recorded { lastRoute: 'safe', succeeded: true })",
    ).toBeVisible({ timeout: WAIT_MS });
    await fastRouteButton.tap();

    await expect
      .poll(() => snapshotRouteRisk(page), { timeout: WAIT_MS })
      .toEqual({ lastRoute: "fast", succeeded: true });

    await deliverFromRouteChoice(page);

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
