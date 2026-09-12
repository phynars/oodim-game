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
// AXIS (Soren's REQUEST_CHANGES on PR #1734, second review).
// The gate reads `state.player.routeRisk` — and `routeRisk` is written
// by EXACTLY ONE code path: the `onChoose` callback that
// `renderRouteRiskChoice` binds to each button it stamps into
// `[data-aftersign-route-risk-surface]` (main.js — the render-loop
// surface's `onChoose` calls `recordRouteRun`). The
// `acknowledge-kiosk` / `skip-kiosk-acknowledge` fork writes a
// DIFFERENT axis (`state.player.secondAction`) and does NOT touch
// `routeRisk` — so a round that only taps that fork exits with
// `routeRisk === null` on both saves, both round-two packet-choice
// renders receive `computeOfferedActions(null)`, the action set is
// identical, and the gate reds. This draft drives round one through
// the ROUTE-RISK SURFACE tap, which is the only input a real player
// has for the axis the gate reads.
//
// COLD-START BUDGET (iteration 3, addressing the sibling
// io-recognition red).  The aftersign lane bundles every
// aftersign/e2e/*.spec.ts.  A different spec in the same lane
// (`io-recognition-memory-beat-contract.spec.ts`) uses 90s per
// test and 60s per waitForFunction because SwiftShader + three.js
// cold init routinely exceeds Playwright's 30s default on CI.
// Aligning here so this spec doesn't compound the same cold-start
// jitter into false reds — the divergence assertion should red
// only when identity sets actually match, never because a
// waitForFunction slipped past 20s during WebGL warmup.
const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

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
// first-round player actually has.
type MemorylessRouteRiskAction = "take-the-long-way" | "repair-the-loss";

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => Boolean(window.__game?.scene?.ready === true && window.__game?.getSnapshot),
    undefined,
    { timeout: WAIT_MS },
  );
}

async function snapshot(page: Page): Promise<Snapshot> {
  await waitForReady(page);
  return page.evaluate(() => window.__game?.getSnapshot?.() ?? {});
}

// Beat readiness — poll the snapshot for `scene.beat` rather than
// requiring a `[data-beat-id]` DOM attribute. main.js does not
// universally stamp `data-beat-id` for every beat transition, and
// prior drafts red-locked on `waitForBeat("packet-offered")` because
// no such attribute exists on cold boot. The snapshot is the ground
// truth authored by the runtime (see `story-state-contract.md`).
async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect
    .poll(async () => (await snapshot(page)).scene?.beat, {
      message: `story line should reach beat "${beat}"`,
      timeout: WAIT_MS,
      intervals: [100, 250, 500, 1000],
    })
    .toBe(beat);
}

async function tap(page: Page, selector: string): Promise<void> {
  const element = page.locator(selector).first();
  await expect(element, `expected tap target ${selector} to be visible`).toBeVisible({
    timeout: WAIT_MS,
  });
  await expect(element, `expected tap target ${selector} to be enabled`).toBeEnabled({
    timeout: WAIT_MS,
  });
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
// served page that writes `state.player.routeRisk`.
async function tapRouteRiskAction(page: Page, action: string): Promise<void> {
  await tap(
    page,
    `[data-aftersign-route-risk-surface] button[data-aftersign-tap-choice="${action}"]:not([disabled])`,
  );
}

// Read the identity set on the route-risk surface — compares
// `data-aftersign-tap-choice` attribute values (never labels), so a
// label-only "change" cannot satisfy the divergence gate.
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

function sameActionSet(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

async function boot(page: Page, slot: string): Promise<void> {
  await page.goto(`/aftersign/index.html?slot=${slot}`, { waitUntil: "load" });
  await waitForReady(page);
  await waitForBeat(page, "packet-offered");
}

// Play one full round from packet-offered → packet-offered (round 2).
async function playRound(
  page: Page,
  routeRiskAction: MemorylessRouteRiskAction,
  tone: "kind" | "evasive" | "blunt",
): Promise<Snapshot> {
  await tap(page, "#packetButton");
  await waitForBeat(page, "packet-choice");

  // The memory-writing tap.
  await tapRouteRiskAction(page, routeRiskAction);

  await expect
    .poll(async () => (await snapshot(page)).player?.routeRisk ?? null, {
      message: `route-risk surface tap on "${routeRiskAction}" must persist state.player.routeRisk before delivery`,
      timeout: WAIT_MS,
    })
    .not.toBeNull();

  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-delivered");

  await waitForBeat(page, "io-return-recognition");
  await tapReturnReason(page, tone);

  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");

  await waitForBeat(page, "packet-offered");
  return snapshot(page);
}

test.describe("#1731 M2-E1: two divergent rounds expose mechanically different actions", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("label-only sameness pins the identity-only gate (baseline)", () => {
    expect(
      sameActionSet(
        ["take-the-long-way", "take-the-shortcut"],
        ["take-the-shortcut", "take-the-long-way"],
      ),
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
    // Budget = 3 × COLD_START_MS = 270s.  This test creates TWO
    // browser contexts (contextA + contextB) and boots each in
    // sequence — every boot pays a full SwiftShader + three.js
    // cold init (~90s on the CI lane, matching COLD_START_MS).
    // Two sequential cold boots ≈ 180s, which is exactly the
    // *2 budget the prior revision allotted — leaving zero
    // headroom for the taps that follow. Bumping to *3 buys
    // ~90s of tap-execution room while still capping the test
    // well under Playwright's default per-worker ceiling.
    // (Soren's REQUEST_CHANGES on PR #1734.)
    test.setTimeout(COLD_START_MS * 3);

    // SAVE A — round one commits `take-the-long-way`
    // → routeRisk = {safe, true} → round-two set includes
    // `take-the-shortcut` + `carry-a-fragile-packet`.
    const contextA = await browser.newContext({
      viewport: PHONE_VIEWPORT,
      hasTouch: true,
      isMobile: true,
    });
    const pageA = await contextA.newPage();
    await boot(pageA, `m2-e1-safesucc-${Date.now()}`);
    const outcomeA = await playRound(pageA, "take-the-long-way", "kind");
    await tap(pageA, "#packetButton");
    await waitForBeat(pageA, "packet-choice");
    const actionsA = await routeRiskActionIdentities(pageA);

    // SAVE B — round one commits `repair-the-loss`
    // → routeRisk = {safe, false} → round-two set is the recovery
    // baseline `[repair-the-loss, take-the-long-way]`, disjoint
    // from Save A's set.
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

    expect(actionsA, "route-risk surface must expose at least one action").not.toEqual([]);
    expect(actionsB, "route-risk surface must expose at least one action").not.toEqual([]);
    expect(
      sameActionSet(actionsA, actionsB),
      `identity sets must diverge across saves (A=${actionsA.join(",")} B=${actionsB.join(",")})`,
    ).toBe(false);

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
    test.setTimeout(COLD_START_MS * 2);

    await boot(page, `m2-e1-continuous-${Date.now()}`);

    const round1 = await playRound(page, "take-the-long-way", "kind");
    expect(
      round1.player?.routeRisk,
      "round one must persist a route-risk memory fact",
    ).not.toBeNull();
    expect(
      round1.packet?.delivered ?? round1.delivery?.outcome,
      "round one must complete a real delivery",
    ).toBeTruthy();

    await tap(page, "#packetButton");
    await waitForBeat(page, "packet-choice");
    const round2Actions = await routeRiskActionIdentities(page);
    const memorylessBaseline = ["repair-the-loss", "take-the-long-way"].sort();
    expect(
      sameActionSet(round2Actions, memorylessBaseline),
      `round-two action set must diverge from the memoryless baseline (got ${round2Actions.join(",")})`,
    ).toBe(false);

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
