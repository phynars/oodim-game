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
//     io-return-recognition → return-tone-choice → io-next-job to
//     re-enter `packet-offered`; round-1's SAFE tap has already
//     written `state.player.routeRisk = { lastRoute: "safe",
//     succeeded: true }`, which is exactly the memory
//     `computeOfferedActions` reads to stamp `take-the-shortcut`
//     into the round-2 route-risk tray (see routeRiskMemory.ts:114).
//     Round-2 re-entry taps `#packetButton` directly (mirroring the
//     shipped `m-continue-next-packet-loop-buttons-enabled.spec.ts`
//     returning-player sequence — the job re-pick from
//     `io-next-job → deliver-packet` has already committed). The
//     FAST button is then a real tappable element — no seeding
//     required.
//
//   RUNTIME PREMISE HARDENING (5th-iter Soren review — AI008):
//     `io-return-recognition` is a KNOWN transient beat that
//     auto-advances to `return-tone-choice` within ~1180ms
//     (flagship-reload-beat-regression.spec.ts:29,140-190). The
//     loop wait accepts EITHER beat; every intra-loop tap has a
//     pre-tap affordance check + post-tap snapshot observation so
//     any hang has a nameable locus, not an opaque runner timeout.
//
// A regression in the route-outcome wire (branch dropped, null
// return silently defaulted, wrong literal, or lookup keyed on the
// wrong axis) reds this spec on the exact surface the player reads.

const WAIT_MS = 10_000;
const COLD_START_MS = 45_000;
// Two-round natural flow budget for the FAST fork — SAFE round-1
// records the routeRisk memory that gates round-2's
// `take-the-shortcut` render. Matches the sibling two-round specs
// (`m-loop-e1-phone-action-divergence.spec.ts` sets 180s for two
// full rounds; this spec's round-2 stops at packet-delivered, so
// 90s suffices).
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

// Funnel from cold boot to `packet-choice`. On a FRESH boot the shipped
// surface stamps `#job-offer-job-safe-delivery` at `packet-offered`; the
// player picks it, then taps `#packetButton` to enter `packet-choice`.
// Round-2 uses `reenterPacketChoice` (below) because a returning player's
// re-offered job set is stamped with different `data-mloop-job-id`
// values — hardcoding `#job-offer-job-safe-delivery` there hangs the
// runner (see reviewer's AI008 note on runtime premise).
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

// Round-2 re-entry: the canonical next-packet-loop spec
// (`m-continue-next-packet-loop-buttons-enabled.spec.ts:96-108`) shows
// the returning player taps `#packetButton` DIRECTLY at the looped
// `packet-offered` (no job re-pick — the job selection from
// `io-next-job → deliver-packet` already committed the packet). Mirror
// that exactly.
async function reenterPacketChoice(page: Page): Promise<void> {
  await waitForBeat(page, "packet-offered");
  const packetButton = page.locator("#packetButton");
  await expect(
    packetButton,
    "round-2 looped packet-offered must render #packetButton visible",
  ).toBeVisible({ timeout: WAIT_MS });
  await expect(
    packetButton,
    "round-2 looped packet-offered must render #packetButton enabled (no dead frame)",
  ).toBeEnabled({ timeout: WAIT_MS });
  await packetButton.tap();
  await waitForBeat(page, "packet-choice");
}

// The `io-return-recognition` beat is KNOWN transient — the shipped
// code auto-advances it to `return-tone-choice` within ~1180ms of the
// prior beat commit (see flagship-reload-beat-regression.spec.ts:29,
// 140-190 documenting this window). A poll on
// `[data-beat-id="io-return-recognition"]` visibility can miss the
// window entirely on cold CI and hang until timeout. Accept EITHER
// beat: whichever the runner sees first is proof the loop advanced
// past packet-delivered.
async function waitForRecognitionOrTone(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const beat = (
        window as unknown as { __game?: { scene?: { beat?: string } } }
      ).__game?.scene?.beat;
      return beat === "io-return-recognition" || beat === "return-tone-choice";
    },
    undefined,
    { timeout: WAIT_MS },
  );
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
    // (see routeRiskMemory.ts:120 recordRouteRun); the packet-offered →
    // packet-choice → packet-delivered → io-return-recognition →
    // return-tone-choice → io-next-job → packet-offered loop then
    // re-enters `packet-choice` for round-2 with that memory intact,
    // so `computeOfferedActions({lastRoute:"safe",succeeded:true})`
    // emits `["take-the-shortcut","carry-a-fragile-packet"]`
    // (routeRiskMemory.ts:114) and the FAST button is rendered as a
    // real tappable element.
    //
    // Prior iterations of this PR (4×) tried to skip round-1 by
    // seeding an authoritative save with
    // `player.routeRisk = { lastRoute: "safe", succeeded: true }`
    // and booting straight into a `take-the-shortcut`-offering
    // packet-choice. Every iteration was rejected: the aftersign
    // e2e lane stayed red because the served-page boot's
    // hydration guards don't reliably restore `player.routeRisk`
    // from a seed unless the rest of the "prior succeeded
    // delivery" fixture is present (packet.delivered:true,
    // delivery.outcome:"sealed", and the matching
    // `delivery-outcome` / `route-attention` memory facts — see
    // the working seed in
    // `reset-route-risk-isolation.spec.ts:37-65`). Even with that
    // shape, the seeded packet-offered → packet-choice funnel is
    // a code path a returning player doesn't take.
    //
    // Running the full two-round loop costs ~30s more than a
    // seed would, but it exercises exactly the shipped surface a
    // player touches: the SAME `renderRouteRiskChoice` writer
    // call that stamps `take-the-shortcut` for a real returning
    // player also stamps it here. Played, not seeded. The 90s
    // budget mirrors the sibling two-round-flow specs
    // (`m-loop-e1-phone-action-divergence.spec.ts`,
    // `m-loop-divergent-offered-actions.playtest.spec.ts`).
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

    // Loop through the return + next-packet path to re-enter
    // packet-offered for round-2. Beat progression (per shipped
    // `m-continue-next-packet-loop-buttons-enabled.spec.ts`):
    // packet-delivered → io-return-recognition → return-tone-choice
    // → io-next-job → packet-offered.
    //
    // AI008 mitigation (Soren PR #1972 5th-iter review): the
    // reviewer named the crash source as unverified runtime
    // premises inside this loop. Each tap below is preceded by an
    // affordance check (the button MUST be present + enabled
    // BEFORE we tap) and followed by a beat-transition check that
    // ACCEPTS the transient `io-return-recognition` window
    // collapsing straight into `return-tone-choice` — a
    // `waitForBeat("io-return-recognition")` on cold CI can miss
    // the ~1180ms window entirely and hang (documented in
    // flagship-reload-beat-regression.spec.ts:29,140-190). Every
    // hang now has a nameable locus instead of a runner timeout.

    // packet-delivered → io-return-recognition (transient) OR
    // return-tone-choice — accept whichever the runner catches.
    await waitForRecognitionOrTone(page);

    // The return-reason button is rendered at io-return-recognition
    // and stays through the auto-advance into return-tone-choice
    // (`return-tone-choice` is where it commits the tap). If the
    // beat has already advanced past `return-tone-choice`, skip
    // the tap; otherwise tap the first enabled return-reason.
    const currentBeatAfterDeliver = await page.evaluate(
      () =>
        (window as unknown as { __game?: { scene?: { beat?: string } } })
          .__game?.scene?.beat ?? null,
    );
    if (currentBeatAfterDeliver === "io-return-recognition") {
      const returnReasonButton = page
        .locator('button[data-return-reason]:not([disabled])')
        .first();
      await expect(
        returnReasonButton,
        "io-return-recognition must offer at least one enabled return-reason button (loop entry to round-2)",
      ).toBeVisible({ timeout: WAIT_MS });
      await returnReasonButton.tap();
      await waitForBeat(page, "return-tone-choice");
    } else {
      // Already at return-tone-choice — the recognition beat
      // auto-advanced during the poll gap. Verify we're actually
      // there before continuing so a wrong beat doesn't cascade
      // into an opaque tapChoice failure.
      expect(
        currentBeatAfterDeliver,
        "after packet-delivered, beat must be io-return-recognition or return-tone-choice (transient window)",
      ).toBe("return-tone-choice");
    }

    // return-tone-choice → ask-for-next-job.
    await tapChoice(page, "ask-for-next-job");

    // io-next-job → deliver-packet (starts round-2's packet).
    await waitForBeat(page, "io-next-job");
    await tapChoice(page, "deliver-packet");

    // Round-2 packet-offered — routeRisk memory from round-1 is
    // still on `state.player.routeRisk` (persistence.js:60 clones
    // `state.player` into the persist payload, and the in-memory
    // routeRisk stays put across the beat loop).
    await waitForBeat(page, "packet-offered");
    // Cross-check: the routeRisk fact from round-1 MUST still be
    // on the snapshot at round-2 packet-offered. If a beat
    // transition in the loop clears it, `take-the-shortcut` won't
    // render below and the reason wouldn't be obvious from the
    // downstream failure. Use `expect.poll` (not a single
    // `expect`) because the beat stamp and the routeRisk clone
    // are two separate microtasks — the snapshot can lag one
    // tick behind the beat transition on cold CI.
    await expect
      .poll(() => snapshotRouteRisk(page), { timeout: WAIT_MS })
      .toEqual({ lastRoute: "safe", succeeded: true });

    // ─── ROUND 2 — packet-offered → packet-choice with the FAST
    // action offered. A returning player does NOT re-pick a job
    // offer at the looped packet-offered — the canonical
    // `m-continue-next-packet-loop-buttons-enabled.spec.ts:96-108`
    // taps `#packetButton` directly. Reusing `reachPacketChoiceFresh`
    // here (which insists on `#job-offer-job-safe-delivery`) is the
    // AI008 hang the reviewer flagged: round-2's offered-job set is
    // stamped with different `data-mloop-job-id` values and the
    // hardcoded selector never resolves. `reenterPacketChoice`
    // mirrors the shipped returning-player tap sequence exactly.
    await reenterPacketChoice(page);

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
