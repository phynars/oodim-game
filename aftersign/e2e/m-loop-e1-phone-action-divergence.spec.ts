import { expect, test, type Page } from "@playwright/test";

// #1731 — M2-E1 served-page acceptance gate.
//
// Two divergent completed rounds on the phone viewport must expose
// mechanically different tappable actions on the SECOND round's
// packet-choice — where the route/risk memory wiring
// (`computeOfferedActions` in `apps/web/src/aftersign/routeRiskMemory.ts`)
// stamps different `data-aftersign-tap-choice` buttons into the served
// `[data-aftersign-route-risk-surface]` container based on the durable
// route/outcome fact.
//
// Vocabulary (ground truth: aftersign/index.html + main.js +
// docs/flagship/story-state-contract.md + servedSurface.contract.test.ts):
//   • packet-choice fork ids: `acknowledge-kiosk` (records
//     secondAction=acknowledged, route=safe) vs `skip-kiosk-acknowledge`
//     (records secondAction=skipped, route=fast).  There is no
//     `skip-kiosk` id on the served page — a prior draft of this
//     spec red on that typo.
//   • Delivery commit id: `deliver-packet`; beat after delivery is
//     `packet-delivered`; ~1180ms later main.js auto-advances to
//     `io-return-recognition` (see aftersign/e2e/io-continue-beats-
//     tap-playtest.spec.ts).
//   • Return tone at `io-return-recognition`: buttons stamped with
//     `data-return-reason="kind|evasive|blunt"`; next beat is
//     `return-tone-choice`; then `ask-for-next-job` advances to
//     `io-next-job`, and the loop returns to `packet-offered` for
//     round two.
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
//   packet gesture → packet-choice → route commit → deliver →
//   packet-delivered (real beat, auto-advances) → io-return-recognition →
//   pick return tone → return-tone-choice → ask-for-next-job → io-next-job
// Ends re-armed at the next packet-offered / packet-choice cycle so
// the caller can read the divergent action set on round two.
async function playRound(
  page: Page,
  routeCommit: "acknowledge-kiosk" | "skip-kiosk-acknowledge",
  tone: "kind" | "evasive" | "blunt",
): Promise<Snapshot> {
  // packet-offered → packet-choice. The offer button is the shipped
  // `#packetButton` (aftersign/index.html); its click handler is the
  // commit that mints the packet run.
  await tap(page, "#packetButton");
  await waitForBeat(page, "packet-choice");

  // Route commit — divergence starts here. `acknowledge-kiosk` and
  // `skip-kiosk-acknowledge` are the two forks (story-state-contract.md).
  await tapChoice(page, routeCommit);

  // Deliver.
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

    // SAVE A — safe route (acknowledge-kiosk), kind return.
    const contextA = await browser.newContext({
      viewport: PHONE_VIEWPORT,
      hasTouch: true,
      isMobile: true,
    });
    const pageA = await contextA.newPage();
    await boot(pageA, `m2-e1-safe-${Date.now()}`);
    const outcomeA = await playRound(pageA, "acknowledge-kiosk", "kind");
    // Round two — read the action identity set at packet-choice.
    await tap(pageA, "#packetButton");
    await waitForBeat(pageA, "packet-choice");
    const actionsA = await routeRiskActionIdentities(pageA);

    // SAVE B — fast route (skip-kiosk-acknowledge), evasive return.
    const contextB = await browser.newContext({
      viewport: PHONE_VIEWPORT,
      hasTouch: true,
      isMobile: true,
    });
    const pageB = await contextB.newPage();
    await boot(pageB, `m2-e1-fast-${Date.now()}`);
    const outcomeB = await playRound(pageB, "skip-kiosk-acknowledge", "evasive");
    await tap(pageB, "#packetButton");
    await waitForBeat(pageB, "packet-choice");
    const actionsB = await routeRiskActionIdentities(pageB);

    // Round-one memory must have landed on both saves.
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
    await tap(
      differingPage,
      `[data-aftersign-route-risk-surface] button[data-aftersign-tap-choice="${differing}"]`,
    );

    await contextA.close();
    await contextB.close();
  });

  test("cold-boot phone completes TWO consecutive rounds without reseeding", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await boot(page, `m2-e1-continuous-${Date.now()}`);

    // ROUND ONE — safe/kind. Records the memory fact.
    const round1 = await playRound(page, "acknowledge-kiosk", "kind");
    expect(
      round1.packet?.delivered ?? round1.delivery?.outcome,
      "round one must complete a real delivery",
    ).toBeTruthy();

    // At round two's packet-choice, the memory fact must have
    // CHANGED the enabled action identities relative to a memory-
    // less first-run baseline (`repair-the-loss`, `take-the-long-way`
    // — see `computeOfferedActions(null)` in routeRiskMemory.ts).
    await tap(page, "#packetButton");
    await waitForBeat(page, "packet-choice");
    const round2Actions = await routeRiskActionIdentities(page);
    const memorylessBaseline = ["repair-the-loss", "take-the-long-way"].sort();
    expect(
      sameActionSet(round2Actions, memorylessBaseline),
      `round-two action set must diverge from the memoryless baseline (got ${round2Actions.join(",")})`,
    ).toBe(false);

    // Second delivery. Reuse a fork the player HAS NOT taken this
    // slot yet — the fast route — so round two exercises a
    // mechanically different branch.
    await tapChoice(page, "skip-kiosk-acknowledge");
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
