import { expect, test, type Locator, type Page } from "@playwright/test";

// AFTERSIGN #1795 — route-risk tray hide→show cycle, real-tap played.
//
// Soren's REQUEST_CHANGES on the first draft of this PR: the unit test on
// `buildRouteRiskRenderSignature` proves the pure key is stable, but the
// bug the PR claims to fix is a RENDERED bug — a phone tap landing on a
// button that gets replaced under the finger. The unit test cannot catch
// the regression the reviewer flagged (signature gate never reset on
// hide → hide→show with unchanged memory produces a visible EMPTY tray).
// This spec is the played-not-driven proof:
//
//   FIRST PACKET-CHOICE (tray shown for the first time — signature stamp
//     lands, buttons render).
//     `#routeRiskChoice` is visible with `data-visible="true"`, exposes
//     `data-render-signature="fresh"` (memory axis: no run recorded yet),
//     and hosts >=2 real tappable
//     `button[data-aftersign-tap-choice="<action>"]` children.
//
//   HIDE (advance past packet-choice via acknowledge-kiosk + deliver).
//     `#routeRiskChoice` flips to `data-visible="false"`; the tray is
//     drained (0 button children). With the fix, the render-signature
//     dataset entry is cleared here so the next show re-renders even
//     when the memory axis is unchanged.
//
//   LOOPED RETURN (play the full continue-beats loop back to a second
//     packet-choice WITHOUT tapping a route-risk button, so
//     `state.player.routeRisk` stays undefined → the memory axis and
//     therefore the signature is still "fresh").
//     `#routeRiskChoice` is visible again, and — this is the assertion
//     the buggy build reds on — the button children are BACK, real,
//     and tappable. Without the hide-branch reset, the stale
//     "fresh" signature matches on re-show, the gate blocks the
//     re-render, and the second visit sees a visible tray with zero
//     buttons — the exact tap-breaking shape Soren flagged.

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

async function expectTrayShownWithButtons(
  page: Page,
  label: string,
): Promise<Locator> {
  const tray = page.locator("#routeRiskChoice");
  await expect(
    tray,
    `${label}: #routeRiskChoice should be present in the DOM`,
  ).toHaveCount(1);
  await expect(
    tray,
    `${label}: #routeRiskChoice should be marked visible`,
  ).toHaveAttribute("data-visible", "true", { timeout: WAIT_MS });
  const trayButtons = tray.locator(
    "button[data-aftersign-tap-choice]:not([disabled])",
  );
  // >=2 buttons — computeOfferedActions always returns a two-element
  // set (see routeRiskMemory.ts). The precise action ids depend on the
  // fact axis and are asserted by the sibling consumer test; here we
  // only pin that the tray is not the empty-shell bug shape.
  await expect(
    trayButtons,
    `${label}: route-risk tray must expose tappable action buttons — an empty visible tray IS the tap-breaking bug this spec guards`,
  ).toHaveCount(2, { timeout: WAIT_MS });
  // Confirm a real tap-hit-test succeeds on the first button (Playwright
  // click auto-waits for actionability: visible, enabled, stable, and
  // hit-testable — an off-screen or covered element reds this).
  const firstButton = trayButtons.first();
  await expect(firstButton).toBeVisible();
  await expect(firstButton).toBeEnabled();
  return tray;
}

test.describe("AFTERSIGN route-risk tray — played hide→show cycle (#1795)", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("route-risk buttons remain tappable after a hide→show cycle with unchanged memory", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `route-risk-tray-hide-show-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    // FIRST PACKET-CHOICE — reach the beat where the route-risk tray is
    // rendered for the first time. Tap script mirrors the sibling
    // `job-offers-played.spec.ts` funnel line for line so a beat-graph
    // drift reds this the same way it reds every other -played spec.
    await waitForBeat(page, "packet-offered");
    await page.locator("#job-offer-job-safe-delivery").tap();
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");

    // FRESH BOOT: no route-risk fact has been recorded yet, so the
    // signature key derived from `state.player.routeRisk` is "fresh".
    // The tray must be visible and its two offered-action buttons
    // must be real, tappable elements.
    const trayFirstShow = await expectTrayShownWithButtons(
      page,
      "first packet-choice",
    );
    await expect(
      trayFirstShow,
      "first show must stamp the fresh-boot render signature",
    ).toHaveAttribute("data-render-signature", "fresh", { timeout: WAIT_MS });

    // HIDE — advance past packet-choice without touching a route-risk
    // button, so the durable memory axis stays undefined and the
    // signature stays "fresh". The buggy build leaves that stale
    // "fresh" signature on the dataset when the tray hides; the fix
    // clears it so the next show can re-render.
    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "io-return-recognition");

    // Confirm the tray is marked hidden and drained. Zero
    // `data-aftersign-tap-choice` children is the correct hide-branch
    // shape; the render-signature dataset entry must be gone so the
    // next show can re-stamp it (the actual fix under review).
    const trayHidden = page.locator("#routeRiskChoice");
    await expect(
      trayHidden,
      "route-risk tray should be marked hidden after leaving packet-choice",
    ).toHaveAttribute("data-visible", "false", { timeout: WAIT_MS });
    await expect(
      trayHidden.locator("button[data-aftersign-tap-choice]"),
      "hidden tray must have no route-risk action children",
    ).toHaveCount(0, { timeout: WAIT_MS });
    await expect(
      trayHidden,
      "hide branch must clear the render-signature gate; otherwise a hide→show with unchanged memory reproduces the empty-tray tap-breaking bug",
    ).not.toHaveAttribute("data-render-signature", /.+/, { timeout: WAIT_MS });

    // Walk the continue-beats loop back to packet-choice WITHOUT
    // tapping a route-risk button, so the memory axis is unchanged
    // and the signature on re-show is still "fresh". Same tap script
    // as `job-offers-played.spec.ts`.
    await tapReturnReason(page, "blunt");
    await waitForBeat(page, "return-tone-choice");
    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "packet-offered");
    await page.locator('[id^="job-offer-"]').first().tap();
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");

    // SECOND PACKET-CHOICE (unchanged memory axis) — the tray must
    // show AND the buttons must be back. Without the hide-branch
    // reset, `data-visible="true"` but zero button children — the
    // exact tap-breaking shape Soren flagged.
    const traySecondShow = await expectTrayShownWithButtons(
      page,
      "second packet-choice (after hide→show with unchanged memory)",
    );
    await expect(
      traySecondShow,
      "second show must re-stamp the fresh render signature after the hide-branch reset",
    ).toHaveAttribute("data-render-signature", "fresh", { timeout: WAIT_MS });

    // Prove the buttons are TAPPABLE, not just present — a real tap
    // must land on a route-risk action and record the run without
    // being replaced under the finger. Playwright's `.tap()` gates on
    // actionability, so a mid-tap re-render reds here.
    const secondShowButton = traySecondShow
      .locator("button[data-aftersign-tap-choice]:not([disabled])")
      .first();
    await secondShowButton.tap();

    // After that tap, the memory axis flips (recordRouteRun writes
    // `{ lastRoute, succeeded }` into `state.player.routeRisk`) and
    // the next signature diverges from "fresh" — proof the tap
    // actually landed on a live handler and the tray is a working
    // input surface, not a dead visible shell.
    await expect(
      traySecondShow,
      "tapping a route-risk button must flip the render signature away from 'fresh' — proof the tap landed on a live handler",
    ).not.toHaveAttribute("data-render-signature", "fresh", {
      timeout: WAIT_MS,
    });
  });
});
