import { expect, test, type Page } from "@playwright/test";

// #1731 — M2-E1 served-page acceptance gate.
//
// Two divergent completed rounds on the phone viewport must expose
// mechanically different tappable actions on the SECOND round's
// packet-choice — where the route/risk memory wiring
// (`computeOfferedActions` in `apps/web/src/aftersign/routeRiskMemory.ts`)
// stamps different `data-aftersign-tap-choice` buttons into the served
// `[data-aftersign-route-risk-surface]` container based on the durable
// route/outcome fact `state.player.routeRisk`.
//
// WHERE THE MEMORY AXIS IS WRITTEN (Soren's REQUEST_CHANGES on
// PR #1734, second review). The gate reads `state.player.routeRisk`
// — and `routeRisk` is written by EXACTLY ONE code path: the
// `onChoose` callback that `renderRouteRiskChoice` binds to each
// button it stamps into `[data-aftersign-route-risk-surface]`
// (main.js:1866 for the seam surface, main.js:1949 for the
// render-loop surface — both call `recordRouteRun`). The
// `acknowledge-kiosk` / `skip-kiosk-acknowledge` fork writes a
// DIFFERENT axis (`state.player.secondAction`, main.js:2714-2729)
// and does NOT touch `routeRisk` — so a round that only taps that
// fork exits with `routeRisk === null` on both saves, both round-two
// packet-choice renders receive `computeOfferedActions(null)`, the
// action set is identical (the memoryless recovery baseline
// `["repair-the-loss","take-the-long-way"]`), and the gate reds.
// Draft 2 of this spec made exactly that mistake. This draft drives
// round one through the ROUTE-RISK SURFACE tap, which is the only
// input a real player has for the axis the gate reads.
//
// WHICH TWO IDENTITIES DIVERGE ROUND TWO (from routeRiskMemory.ts
// `computeOfferedActions`):
//   memory === null                            → ["repair-the-loss",
//                                                 "take-the-long-way"]
//     (the memoryless first-run baseline —
//      both taps are the two options a fresh
//      player sees at round one's packet-choice)
//   {lastRoute:"safe", succeeded:true}          → ["take-the-shortcut",
//                                                 "carry-a-fragile-packet"]
//   {lastRoute:"safe", succeeded:false}         → ["repair-the-loss",
//                                                 "take-the-long-way"]
//     (recovery baseline — same as null)
//   {lastRoute:"fast", succeeded:true}          → ["carry-a-fragile-packet",
//                                                 "take-the-long-way"]
//
// Round-one taps only see the memoryless-baseline pair, so the two
// available divergent commits are `take-the-long-way` (records
// safe+succeeded → round two `[take-the-shortcut, carry-a-fragile-
// packet]`) and `repair-the-loss` (records safe+failed → round two
// `[repair-the-loss, take-the-long-way]`).  The two round-two sets
// share ZERO identities — a clear identity-level divergence.
//
// Vocabulary (ground truth: aftersign/index.html + main.js +
// docs/flagship/story-state-contract.md + servedSurface.contract.test.ts):
//   • Route-risk surface: `[data-aftersign-route-risk-surface]`,
//     visible whenever `state.scene.beat === "packet-choice"`
//     (main.js:1941). Each offered action is stamped as
//     `<button data-aftersign-tap-choice="<id>">` (routeRiskMemory.ts).
//   • Delivery commit id: `deliver-packet` (stamped as
//     `data-choice-id`); beat after delivery is `packet-delivered`;
//     ~1180ms later main.js auto-advances to `io-return-recognition`.
//   • Return tone at `io-return-recognition`: buttons stamped with
//     `data-return-reason="kind|evasive|blunt"`; next beat is
//     `return-tone-choice`; then `ask-for-next-job` advances to
//     `io-next-job`, and the loop returns to `packet-offered` for
//     round two.
//   • `#packetButton` release (a plain tap) commits SEALED via
//     `commitPacketOutcome` and advances to `packet-choice`
//     (main.js:2431/2440).
//
// Every input is a phone tap on a visible + enabled real DOM element.
// `window.__game` reads appear ONLY in assertions (per #1731's
// "Snapshot access is assert-only" clause).

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 20_000;

type Snapshot = {
  scene?: { ready?: boolean; beat?: string };
  packet?: { delivered?: boolean; sealed?: boolean };
  delivery?: { outcome?: string };
  player?: {
    returnReason?: string | null;
    routeRisk?: { lastRoute?: string; succeeded?: boolean } | null;
    secondAction?: string | null;
  };
};

declare global {
  interface Window {
    __game?: {
      scene?: { ready?: boolean; beat?: string };
      getSnapshot?: () => Snapshot;
    };
  }
}

// Route-risk actions offered when memory is null — the two commits a
// first-round player actually has. Everything else is unreachable
// without prior memory (see the mapping table above).
type MemorylessRouteRiskAction = "take-the-long-way" | "repair-the-loss";

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__game?.scene?.ready === true, undefined, {
    timeout: WAIT_MS,
  });
}

async function snapshot(page: Page): Promise<Snapshot> {
  await waitForReady(page);
  return page.evaluate(() => window.__game?.getSnapshot?.() ?? {});
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect(
    page.locator(`[data-beat-id="${beat}"]`),
    `story line should reach beat "${beat}"`,
  ).toBeVisible({ timeout: WAIT_MS });
}

async function tap(page: Page, selector: string): Promise<void> {
  const element = page.locator(selector).first();
  await expect(element, `expected tap target ${selector} to be visible`).toBeVisible({
    timeout: WAIT_MS,
  });
  await expect(element, `expected tap target ${selector} to be enabled`).toBeEnabled();
  await element.tap();
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  await tap(page, `button[data-choice-id="${choiceId}"]:not([disabled])`);
}

async function tapReturnReason(
  page: Page,
  reason: "kind" | "evasive" | "blunt",
): Promise<void> {
  await tap(page, `button[data-return-reason="${reason}"]:not([disabled])`);
}

// Tap a button inside `[data-aftersign-route-risk-surface]` by its
// `data-aftersign-tap-choice` identity. This is the ONE input on the
// served page that writes `state.player.routeRisk` (via
// `recordRouteRun` in the surface's `onChoose` binding — main.js:1866
// / 1949). Every other packet-choice tap writes a different axis.
async function tapRouteRiskAction(page: Page, action: string): Promise<void> {
  await tap(
    page,
    `[data-aftersign-route-risk-surface] button[data-aftersign-tap-choice="${action}"]:not([disabled])`,
  );
}

// The gate lives on the route-risk surface — `renderRouteRiskChoice`
// stamps one `<button data-aftersign-tap-choice="<action>">` per
// offered action into `[data-aftersign-route-risk-surface]` at
// packet-choice. Reads the IDENTITY of each action (the
// tap-choice attribute), not the label — a label-only change
// cannot satisfy the divergence gate.
async function routeRiskActionIdentities(page: Page): Promise<string[]> {
  const surface = page.locator("[data-aftersign-route-risk-surface]");
  await expect(
    surface,
    "packet-choice must host the route-risk surface (routeRiskMemory.ts)",
  ).toBeVisible({ timeout: WAIT_MS });
  const identities = await surface
    .locator("button[data-aftersign-tap-choice]:not([disabled])")
    .evaluateAll((nodes) =>
      nodes
        .filter((node): node is HTMLElement => node instanceof HTMLElement)
        .filter((node) => node.offsetParent !== null)
        .map((node) => node.getAttribute("data-aftersign-tap-choice") ?? "")
        .filter((value) => value.length > 0),
    );
  return [...identities].sort();
}

// Identity-only comparator. Labels are excluded by construction:
// we compare `data-aftersign-tap-choice` attribute values, not
// `textContent`.
function sameActionSet(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

// Boot a fresh slot to the packet-offered starting beat.
async function boot(page: Page, slot: string): Promise<void> {
  await page.goto(`?slot=${slot}`, { waitUntil: "load" });
  await waitForReady(page);
  await waitForBeat(page, "packet-offered");
}

// Play one full round from packet-offered:
//   #packetButton (release → SEALED, sets beat=packet-choice) →
//   TAP the ROUTE-RISK SURFACE (writes state.player.routeRisk via
//     recordRouteRun — the memory axis the gate actually reads) →
//   deliver-packet (packet-delivered) →
//   auto-advance to io-return-recognition (~1180ms) →
//   pick return tone → return-tone-choice → ask-for-next-job →
//   io-next-job → main.js re-arms packet-offered for round two.
//
// The tap that writes the divergence-relevant memory is the
// `tapRouteRiskAction` call — NOT the acknowledge-kiosk /
// skip-kiosk-acknowledge fork. That fork writes secondAction
// (main.js:2714-2729), which is a different axis; the served
// gate reads routeRisk, not secondAction. See the header block for
// the mapping table.
async function playRound(
  page: Page,
  routeRiskAction: MemorylessRouteRiskAction,
  tone: "kind" | "evasive" | "blunt",
): Promise<Snapshot> {
  await tap(page, "#packetButton");
  await waitForBeat(page, "packet-choice");

  // The memory-writing tap — this is the input the gate cares about.
  // Both `take-the-long-way` and `repair-the-loss` are offered when
  // memory is null (the round-one baseline). After this tap,
  // state.player.routeRisk is `{safe, true}` or `{safe, false}`
  // respectively — see the mapping table in the header.
  await tapRouteRiskAction(page, routeRiskAction);

  // Confirm the durable axis actually took the write. If this ever
  // reds it means main.js changed the onChoose binding and the whole
  // gate is stale — better a named assertion here than an opaque
  // divergence failure two rounds later.
  await expect
    .poll(async () => (await snapshot(page)).player?.routeRisk ?? null, {
      message: `route-risk surface tap on "${routeRiskAction}" must persist state.player.routeRisk before delivery`,
      timeout: WAIT_MS,
    })
    .not.toBeNull();

  // Deliver — commits the packet-outcome + route-attention memory
  // facts, but does NOT overwrite state.player.routeRisk.
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-delivered");

  // Auto-advance (~1180ms) into recognition — waited on, not skipped.
  await waitForBeat(page, "io-return-recognition");
  await tapReturnReason(page, tone);

  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");

  // Round wrap — main.js loops the player back to packet-offered
  // for the next job. Wait for the loop to re-arm before the caller
  // reads the divergent action set.
  await waitForBeat(page, "packet-offered");

  return snapshot(page);
}

test.describe("#1731 M2-E1: two divergent rounds expose mechanically different actions", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("label-only sameness pins the identity-only gate (baseline)", () => {
    // A same-set with different labels would compare equal here —
    // we compare identities, not text — so a label-only "change"
    // cannot satisfy the divergence gate downstream.
    expect(
      sameActionSet(["take-the-long-way", "take-the-shortcut"], [
        "take-the-shortcut",
        "take-the-long-way",
      ]),
      "identity-only comparator must ignore order",
    ).toBe(true);
    expect(
      sameActionSet(
        ["take-the-shortcut", "carry-a-fragile-packet"],
        ["take-the-long-way", "carry-a-fragile-packet"],
      ),
      "different identities must be flagged as divergent",
    ).toBe(false);
  });

  test("two divergent saves expose and permit a mechanically different action", async ({
    browser,
  }) => {
    test.setTimeout(180_000);

    // SAVE A — round one commits `take-the-long-way` on the
    // route-risk surface → state.player.routeRisk = {safe, true}.
    // Round-two offered set: ["take-the-shortcut",
    // "carry-a-fragile-packet"].
    const contextA = await browser.newContext({
      viewport: PHONE_VIEWPORT,
      hasTouch: true,
      isMobile: true,
    });
    const pageA = await contextA.newPage();
    await boot(pageA, `m2-e1-safesucc-${Date.now()}`);
    const outcomeA = await playRound(pageA, "take-the-long-way", "kind");
    // Round two — read the action identity set at packet-choice.
    await tap(pageA, "#packetButton");
    await waitForBeat(pageA, "packet-choice");
    const actionsA = await routeRiskActionIdentities(pageA);

    // SAVE B — round one commits `repair-the-loss` on the route-risk
    // surface → state.player.routeRisk = {safe, false} (a failed run).
    // Round-two offered set: ["repair-the-loss", "take-the-long-way"]
    // — the recovery baseline, identity-disjoint from Save A's set.
    const contextB = await browser.newContext({
      viewport: PHONE_VIEWPORT,
      hasTouch: true,
      isMobile: true,
    });
    const pageB = await contextB.newPage();
    await boot(pageB, `m2-e1-safefail-${Date.now()}`);
    const outcomeB = await playRound(pageB, "repair-the-loss", "evasive");
    await tap(pageB, "#packetButton");
    await waitForBeat(pageB, "packet-choice");
    const actionsB = await routeRiskActionIdentities(pageB);

    // Round-one memory must have landed on both saves — the axis the
    // gate reads, not just a completed delivery.
    expect(
      outcomeA.player?.routeRisk,
      "SAVE A must have written state.player.routeRisk during round one",
    ).not.toBeNull();
    expect(
      outcomeB.player?.routeRisk,
      "SAVE B must have written state.player.routeRisk during round one",
    ).not.toBeNull();
    expect(
      outcomeA.packet?.delivered ?? outcomeA.delivery?.outcome,
      "SAVE A must have completed round one delivery",
    ).toBeTruthy();
    expect(
      outcomeB.packet?.delivered ?? outcomeB.delivery?.outcome,
      "SAVE B must have completed round one delivery",
    ).toBeTruthy();

    // THE GATE — identity-level divergence at the same beat, same
    // surface, same viewport. Labels are excluded by construction
    // (we compare `data-aftersign-tap-choice` attribute values).
    expect(actionsA, "route-risk surface must expose at least one action").not.toEqual([]);
    expect(actionsB, "route-risk surface must expose at least one action").not.toEqual([]);
    expect(
      sameActionSet(actionsA, actionsB),
      `identity sets must diverge across saves (A=${actionsA.join(",")} B=${actionsB.join(",")})`,
    ).toBe(false);

    // A save must expose an action the other save cannot take —
    // and the differing action must be tappable to prove it is
    // mechanically available, not decorative.
    const differing =
      actionsA.find((id) => !actionsB.includes(id)) ??
      actionsB.find((id) => !actionsA.includes(id));
    expect(differing, "at least one identity must be unique to one save").toBeTruthy();
    const differingPage = actionsA.includes(differing!) ? pageA : pageB;
    await tapRouteRiskAction(differingPage, differing!);

    await contextA.close();
    await contextB.close();
  });

  test("cold-boot phone completes TWO consecutive rounds without reseeding", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await boot(page, `m2-e1-continuous-${Date.now()}`);

    // ROUND ONE — commit `take-the-long-way` on the route-risk
    // surface (memory=null baseline offers it). Writes
    // state.player.routeRisk = {safe, true}.
    const round1 = await playRound(page, "take-the-long-way", "kind");
    expect(
      round1.player?.routeRisk,
      "round one must persist a route-risk memory fact",
    ).not.toBeNull();
    expect(
      round1.packet?.delivered ?? round1.delivery?.outcome,
      "round one must complete a real delivery",
    ).toBeTruthy();

    // At round two's packet-choice, the memory fact must have
    // CHANGED the offered action identities relative to the
    // memory-less first-run baseline (`repair-the-loss`,
    // `take-the-long-way` — see `computeOfferedActions(null)` in
    // routeRiskMemory.ts). With {safe, true} the surface now offers
    // `take-the-shortcut` + `carry-a-fragile-packet`.
    await tap(page, "#packetButton");
    await waitForBeat(page, "packet-choice");
    const round2Actions = await routeRiskActionIdentities(page);
    const memorylessBaseline = ["repair-the-loss", "take-the-long-way"].sort();
    expect(
      sameActionSet(round2Actions, memorylessBaseline),
      `round-two action set must diverge from the memoryless baseline (got ${round2Actions.join(",")})`,
    ).toBe(false);

    // Round two exercises a mechanically different branch by tapping
    // one of the newly-offered identities on the route-risk surface
    // — one the round-one player did not have. This is the
    // "mechanically different action" the acceptance criterion asks
    // for: same viewport, same surface, same player, different tap
    // identity than round one had access to.
    const newIdentity = round2Actions.find((id) => !memorylessBaseline.includes(id));
    expect(
      newIdentity,
      "round-two set must contain at least one identity absent from the memoryless baseline",
    ).toBeTruthy();
    await tapRouteRiskAction(page, newIdentity!);

    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "packet-delivered");
    await waitForBeat(page, "io-return-recognition");
    await tapReturnReason(page, "evasive");
    await waitForBeat(page, "return-tone-choice");
    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");

    const round2 = await snapshot(page);
    expect(
      round2.packet?.delivered ?? round2.delivery?.outcome,
      "round two must complete a real delivery",
    ).toBeTruthy();
    expect(
      round2.player?.returnReason,
      "round two must persist the evasive return tone",
    ).toBe("evasive");
  });
});
