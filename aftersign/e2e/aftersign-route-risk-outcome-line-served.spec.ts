import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN #1963 — route-outcome line rendered on the served page.
//
// The wire under review adds a route-risk-aware branch to the
// `packet-delivered` line in `aftersign/main.js` (`lineForBeat`).
// When `state.player.routeRisk.succeeded === true` and
// `lastRoute === "safe"`, Io speaks the authored SAFE outcome line
// from `apps/web/src/aftersign/aftersignRouteOutcomeCopy.js` INSTEAD
// of the generic "clean handoff" line — a durable acknowledgement
// that the player ran the light-side route, not merely selected a
// job.
//
// Soren's review on the first two drafts blocked on the copy module
// existing in isolation with NO played-through e2e that taps a real
// route-risk button and asserts the shipped `#line` DOM node speaks
// the SAFE outcome literal. This spec is that proof — played, not
// driven:
//
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
// A regression in the route-outcome wire (branch dropped, null
// return silently defaulted, wrong literal, or lookup keyed on the
// wrong axis) reds this spec on the exact surface the player reads.

const WAIT_MS = 10_000;
const COLD_START_MS = 45_000;

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
    await waitForBeat(page, "packet-offered");
    await page.locator("#job-offer-job-safe-delivery").tap();
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");

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
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (
                window as unknown as {
                  __game?: {
                    getSnapshot: () => {
                      player?: {
                        routeRisk?: {
                          lastRoute?: string;
                          succeeded?: boolean;
                        } | null;
                      };
                    };
                  };
                }
              ).__game?.getSnapshot().player?.routeRisk ?? null),
        { timeout: WAIT_MS },
      )
      .toEqual({ lastRoute: "safe", succeeded: true });

    // 3. Acknowledge the kiosk + deliver the packet.
    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "packet-delivered");

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
    const snapshotLine = await page.evaluate(
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
    expect(
      snapshotLine,
      "snapshot lastLine must match the DOM #line — one axis, no drift",
    ).toBe(SAFE_OUTCOME_LINE);
  });
});
