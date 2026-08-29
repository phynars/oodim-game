import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN aftersign-job-take FEEL trip-wire — played, not driven.
//
// SCOPE. Where the sibling `job-offers-played.spec.ts` pins DIVERGENCE
// of the offered jobId set across the first-visit / returning-player
// axes, this spec is the JUICE-lane trip-wire for the same buttons:
// ONE fresh run through `packet-offered`, asserting that
//
//   (a) the served offer button carries the `[data-aftersign-job-take]`
//       locator + the memory-gated `data-aftersign-job-take-action`
//       axis at render time (state = "ready"), and
//   (b) tapping that button (real `.tap()` in the phone tap lane, not
//       `game.input.choose(...)`) flips the marker to `"armed"` on the
//       exact element the finger touched — proving the frozen feel row
//       from `aftersignJobTakeFeel.js` is stamped by the SERVED main.js
//       and not just by the vitest harness.
//
// PLAYED, NOT DRIVEN (BRIEF 2026-08-15). Every advance is a real tap on
// a visible, enabled DOM button; `window.__game` reads appear only in
// ASSERTIONS (scene.beat sync), never as an input driver. The tap that
// commits the fork is issued through the shipped
// `[data-aftersign-job-take]` locator — same DOM node id the served
// renderer stamps, no harness selector.
//
// CONSUMER (Soren PR #1549 re-review). Blocks the prior "harness-only"
// pattern: `resolveAftersignJobTakeFeel` is imported by
// `aftersign/main.js` (the SERVED page), and the applier here writes
// its output onto the offered-jobs button. If a future refactor drops
// the import or the applier from `main.js` and reverts to the
// harness-only wiring, THIS spec reds because the `data-aftersign-job-
// take` attribute (and the paired action-id attribute) disappears from
// the shipped surface. Same shape as the return-tone-choice feel
// trip-wire's KIND-PATH DISCIPLINE.
//
// LOCATION. Lives at `aftersign/e2e/` — the repo-root tree the
// `aftersign/playwright.config.ts` `testDir: "e2e"` config scans. A
// prior draft parked under `apps/web/src/aftersign/e2e/` (or as a
// HANDOFF doc) was dead weight (Soren PR #1304/#1549 reviews).

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;

// Pinned by `apps/web/src/aftersign/aftersignJobTakeFeel.js` — the
// frozen row + the writer's unit-suffix formatting. If the pinned
// row moves, the module's own contract tests red first; this
// trip-wire mirrors a stable subset verbatim so a drift here means
// an intentional spec change, not a fabrication.
const JOB_TAKE_FEEL_STAMP = {
  durationMs: "420ms",
  holdMs: "96ms",
  travelPx: "14px",
  scaleFrom: "0.97",
  scalePeak: "1.025",
  scaleSettle: "1",
  shadowLiftPx: "6px",
  easingPress: "cubic-bezier(0.2, 0.9, 0.25, 1)",
  easingRelease: "cubic-bezier(0.16, 1, 0.3, 1)",
  easingGlow: "cubic-bezier(0.22, 1, 0.36, 1)",
};

// The safe-delivery jobId is the first-visit selection
// (`selectIoJobOffers(undefined) → [SAFE_DEFAULT_JOB_ID]`), and the
// mloop-copy action id for that jobId is
// `mloop-safe-delivery-take` under the default/fresh memory gate
// (aftersign/mloop-copy.js:109-110). If the mloop-copy table moves,
// its own unit tests red first; the served renderer keys on the
// same table so this locator stays canonical.
const SAFE_DELIVERY_OFFER_ID = "job-offer-job-safe-delivery";
const SAFE_DELIVERY_ACTION_ID = "mloop-safe-delivery-take";

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } })
        .__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const raw = (
            window as unknown as { __game?: { scene?: { beat?: unknown } } }
          ).__game?.scene?.beat;
          return typeof raw === "string" ? raw : null;
        }),
      { timeout: WAIT_MS },
    )
    .toBe(beat);
}

const readJobTakeFeelStamp = (
  page: Page,
): Promise<{
  state: string | null;
  action: string | null;
  durationMs: string;
  holdMs: string;
  travelPx: string;
  scaleFrom: string;
  scalePeak: string;
  scaleSettle: string;
  shadowLiftPx: string;
  easingPress: string;
  easingRelease: string;
  easingGlow: string;
}> =>
  page.locator(`#${SAFE_DELIVERY_OFFER_ID}`).evaluate((node) => {
    const style = getComputedStyle(node);
    const readVar = (name: string): string =>
      style.getPropertyValue(name).trim();
    return {
      state: node.getAttribute("data-aftersign-job-take"),
      action: node.getAttribute("data-aftersign-job-take-action"),
      durationMs: readVar("--aftersign-job-take-duration-ms"),
      holdMs: readVar("--aftersign-job-take-hold-ms"),
      travelPx: readVar("--aftersign-job-take-travel-px"),
      scaleFrom: readVar("--aftersign-job-take-scale-from"),
      scalePeak: readVar("--aftersign-job-take-scale-peak"),
      scaleSettle: readVar("--aftersign-job-take-scale-settle"),
      shadowLiftPx: readVar("--aftersign-job-take-shadow-lift-px"),
      easingPress: readVar("--aftersign-job-take-easing-press"),
      easingRelease: readVar("--aftersign-job-take-easing-release"),
      easingGlow: readVar("--aftersign-job-take-easing-glow"),
    };
  });

test.describe("AFTERSIGN aftersign-job-take feel (phone tap)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("safe-delivery offer stamps [data-aftersign-job-take] at render and flips to armed on tap", async ({
    page,
  }) => {
    const slot = `job-take-feel-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    // First visit → packet-offered renders exactly the safe-default
    // offer with the memory-gated mloop action id.
    await waitForBeat(page, "packet-offered");

    const offer = page.locator(`#${SAFE_DELIVERY_OFFER_ID}`);
    await expect(
      offer,
      "safe-default offered job should render on the first visit",
    ).toBeVisible({ timeout: WAIT_MS });

    // RENDER PROOF — the served main.js wired the resolver and
    // applied the frozen feel row + memory-gated action id BEFORE
    // any tap. If the wiring regresses to harness-only, these
    // attributes disappear and the spec reds first.
    await expect(
      offer,
      "offer must carry the [data-aftersign-job-take] locator at render",
    ).toHaveAttribute("data-aftersign-job-take", "ready", {
      timeout: WAIT_MS,
    });
    await expect(
      offer,
      "offer must expose the memory-gated mloop action id via [data-aftersign-job-take-action]",
    ).toHaveAttribute("data-aftersign-job-take-action", SAFE_DELIVERY_ACTION_ID);

    const stampAtRender = await readJobTakeFeelStamp(page);
    expect(
      {
        state: stampAtRender.state,
        action: stampAtRender.action,
        durationMs: stampAtRender.durationMs,
        holdMs: stampAtRender.holdMs,
        travelPx: stampAtRender.travelPx,
        scaleFrom: stampAtRender.scaleFrom,
        scalePeak: stampAtRender.scalePeak,
        scaleSettle: stampAtRender.scaleSettle,
        shadowLiftPx: stampAtRender.shadowLiftPx,
        easingPress: stampAtRender.easingPress,
        easingRelease: stampAtRender.easingRelease,
        easingGlow: stampAtRender.easingGlow,
      },
      "frozen aftersign-job-take feel row must be stamped as CSS vars at render",
    ).toEqual({
      state: "ready",
      action: SAFE_DELIVERY_ACTION_ID,
      ...JOB_TAKE_FEEL_STAMP,
    });

    // TAP PROOF — a real phone tap on the shipped locator flips the
    // marker to "armed" on THIS exact button. `game.input.choose(...)`
    // is deliberately not used; the tap must land on a visible,
    // enabled DOM node the player could actually press. Poll the
    // marker to tolerate the setTimeout-driven auto-advance the
    // click callback schedules.
    await expect(offer).toBeEnabled({ timeout: WAIT_MS });
    await offer.tap();

    await expect
      .poll(
        () =>
          page
            .locator(`#${SAFE_DELIVERY_OFFER_ID}`)
            .getAttribute("data-aftersign-job-take"),
        { timeout: WAIT_MS },
      )
      .toBe("armed");

    // Action-id axis survives the tap — the same memory-gated id
    // that rides on `state.interaction.lastAction`'s head token
    // stays pinned to the button after the fork commits.
    await expect(offer).toHaveAttribute(
      "data-aftersign-job-take-action",
      SAFE_DELIVERY_ACTION_ID,
    );
  });
});
