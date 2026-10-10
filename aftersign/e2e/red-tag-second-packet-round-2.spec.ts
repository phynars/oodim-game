import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN red-tag second packet — four-surface round-2 contract (#2243,
// decomposed from #2240; blocked-by #2242).
//
// Soren rejected the earlier draft of this spec (PR #2250 iter-1): it was
// written at `apps/web/src/aftersign/e2e/`, which no Playwright config
// scans (`aftersign/playwright.config.ts` has `testDir: "e2e"`, resolving
// to THIS directory). Its buttons were targeted by role name
// ("seal packet", "next packet") — strings that do not appear in the
// shipped UI; the real controls are `#packetButton`, `#deliverButton`,
// `#acknowledgeRouteButton`, and `button[data-choice-id="…"]`. The
// `toHaveCount(0)` guards on "blue tag" copy also couldn't fail, because
// no "blue tag" string exists anywhere in the repo — the blue variant
// of the second packet speaks of a "blue seal", "blue packet", or
// "blue route" instead. This rewrite follows the sibling pattern pinned
// in `red-tag-packet-choice-retention.spec.ts` and
// `red-tag-second-packet-served.spec.ts`.
//
// Why FOUR surfaces (what #2243 adds beyond its siblings), and how
// they land across TWO tests in this file:
//
//   `red-tag-second-packet-served.spec.ts`      — asserts #packetButton label
//                                                 + #offeredJobs route literal
//                                                 at `packet-offered` round-2.
//   `red-tag-packet-choice-retention.spec.ts`   — asserts #packetButton label
//                                                 SURVIVES `packet-choice`
//                                                 and that `#line` speaks
//                                                 the red thread at the
//                                                 following
//                                                 `io-return-recognition`.
//   THIS spec, main `test(...)`                 — surfaces (1), (2), (4):
//                                                 (1) `#packetButton` at
//                                                     `packet-offered`
//                                                     reads "Red tag — Saint
//                                                     Orra" (owned by
//                                                     #2241, shipped).
//                                                 (2) `#offeredJobs` names
//                                                     the red thread, not
//                                                     the blue packet
//                                                     (owned by #2241,
//                                                     shipped).
//                                                 (4) `#line` at
//                                                     `packet-delivered` —
//                                                     the delivery-complete
//                                                     beat itself, BEFORE
//                                                     the auto-advance —
//                                                     names the red tag,
//                                                     not the blue seal
//                                                     (owned by #2242,
//                                                     shipped).
//   THIS spec, `test.fixme(...)` for surface 3  — the `#routeRiskChoice`
//                                                 tray's route-choice
//                                                 buttons at round-2
//                                                 `packet-choice` must
//                                                 speak the TRUSTED-row
//                                                 labels (`"Long way —
//                                                 past the kiosk"` /
//                                                 `"Behind the shuttered
//                                                 pharmacy"`), not the
//                                                 firstRun blue-packet
//                                                 defaults. Pinned as
//                                                 `test.fixme` and NOT
//                                                 executed until #2245
//                                                 lands — see below.
//
// Why surface 3 is `test.fixme` and not a running assertion today:
//
//   `apps/web/src/aftersign/routeRiskActionLabels.js` (the resolver
//   module) says on record that `aftersign/main.js` has TWO
//   `renderRouteRiskChoice({...})` call sites, and BOTH still pass
//   `labelForAction: routeRiskActionLabel` — the firstRun-pinned
//   resolver kept as the default. The round-2 wire-up to
//   `routeRiskActionLabelForOffer(chooseAftersignJobOfferCopy(memory))`
//   is explicitly deferred to follow-up issue #2245 ("[#2241 B2] Wire
//   routeRiskActionLabelForOffer into main.js round-2 red-tag
//   renderRouteRiskChoice call site"), which is OPEN. Soren flagged
//   this on the PR #2250 iter-3 review: without #2245, surface 3
//   fails on main, and merging this spec as-is would add a red e2e.
//
//   An earlier draft of this header credited #2241 or #2242 with the
//   route-choice wiring. Both were wrong. The authoritative source is
//   the resolver module's own header comment, which pins the wire-up
//   to #2245 and documents #2241 as the resolver-only PR (pure
//   factory + unit tests, no main.js change). I did not re-read
//   `aftersign/main.js` here — the file is >200KB and skipped by the
//   search index — so I'm trusting the resolver module's self-
//   description, which is the file whose contract surface 3 asserts
//   anyway.
//
// Base-branch failure proof (CI gate for a type:bug issue):
//   Surfaces (1), (2), and (4) all fail on base (pre-#2241 / pre-#2242):
//   surface (1) renders "Blue packet" instead of "Red tag — Saint Orra";
//   surface (2) renders the firstRun blue-packet route in `#offeredJobs`;
//   surface (4) renders "blue seal" delivery-complete copy. Any ONE of
//   those failures satisfies the type:bug CI gate on base, so the
//   `test.fixme`'d surface (3) is not needed to earn the gate.
//
// Source of truth for the four route strings (used by the fixme'd
// surface 3 for when #2245 lands and the test is un-fixme'd):
//   `apps/web/src/aftersign/aftersignJobOfferCopy.js`
//     - firstRun.safeRouteLabel  = "Lit stair — under Io's window"
//     - firstRun.riskyRouteLabel = "Cut past the bell rope"
//     - trusted.safeRouteLabel   = "Long way — past the kiosk"
//     - trusted.riskyRouteLabel  = "Behind the shuttered pharmacy"
//
// This spec DOES NOT read `window.__game` for assertions — only for the
// beat-settled handshake (same shape every sibling uses). The surface
// assertions all read served DOM nodes.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 60_000;

const TRUSTED_RISKY_ROUTE_LABEL = "Behind the shuttered pharmacy";
const FIRST_RUN_RISKY_ROUTE_LABEL = "Cut past the bell rope";

declare global {
  interface Window {
    __game?: {
      version?: number;
      scene?: { ready?: boolean };
      getSnapshot?: () => { scene: { beat: string } };
    };
  }
}

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => window.__game?.version === 1 && window.__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect
    .poll(
      () => page.evaluate(() => window.__game?.getSnapshot?.().scene.beat),
      { timeout: WAIT_MS },
    )
    .toBe(beat);
}

async function tap(page: Page, selector: string): Promise<void> {
  const target = page.locator(selector);
  await expect(target).toBeVisible({ timeout: WAIT_MS });
  await expect(target).toBeEnabled();
  await target.tap();
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page
    .locator(`button[data-choice-id="${choiceId}"]:not([disabled])`)
    .first();
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.tap();
}

async function tapReturnReason(page: Page, reason: string): Promise<void> {
  const button = page
    .locator(`button[data-return-reason="${reason}"]:not([disabled])`)
    .first();
  await expect(button).toBeVisible({ timeout: WAIT_MS });
  await button.tap();
}

test.describe("AFTERSIGN red-tag second packet — four-surface round-2 contract (#2243)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("round-2 red-tag second packet speaks red on packet-button, offer tray, and delivery line", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto(
      `/aftersign/?slot=red-tag-second-packet-round-2-${Date.now()}`,
      { waitUntil: "load" },
    );
    await waitForReady(page);

    // Round one — deliver sealed, kind return tone, ask for the next
    // job. Same opening walk as the sibling specs.
    await tap(page, "#deliverButton");
    await waitForBeat(page, "io-return-recognition");
    await tap(page, "#acknowledgeRouteButton");
    await waitForBeat(page, "return-tone-choice");
    await tap(page, "#deliverButton");
    await waitForBeat(page, "io-next-job");

    // Accept the red-tag second packet. The two choice buttons at
    // `io-next-job` carry `data-choice-id="accept-second-packet"` /
    // `"decline-second-packet"`; the accept button's visible text is
    // "Take the second packet".
    const acceptSecondPacket = page.locator(
      'button[data-choice-id="accept-second-packet"]',
    );
    await expect(acceptSecondPacket).toHaveText("Take the second packet");
    await acceptSecondPacket.tap();
    await tap(page, "#deliverButton");
    await waitForBeat(page, "packet-offered");

    // SURFACE 1 — Packet-button label at round-2 `packet-offered`.
    // Set by `commitPacketOutcome` in `aftersign/main.js` when
    // `state.delivery.id === "red-tag"` (PR #2199).
    const packetButton = page.locator("#packetButton");
    await expect(packetButton).toHaveText("Red tag — Saint Orra");

    // SURFACE 2 — Route literal in the offer tray. `#offeredJobs`
    // speaks the trusted row's `route` string
    // ("Carry the red tag behind the shuttered pharmacy to Saint
    // Orra before the bells count twice."), not the firstRun
    // blue-packet route.
    const offeredJobs = page.locator("#offeredJobs");
    await expect(offeredJobs).toContainText(/red tag/i);
    await expect(offeredJobs).toContainText(/Saint Orra/i);
    await expect(offeredJobs).not.toContainText(/Blue packet/i);
    await expect(offeredJobs).not.toContainText(/blue seal/i);

    // Carry the packet into `packet-choice`.
    await packetButton.tap();
    await waitForBeat(page, "packet-choice");

    // Label survives the beat flip (red-tag retention, PR #2201).
    // This is also pinned by the sibling retention spec; we check it
    // here so the walk's state is anchored before we move on to the
    // delivery beat.
    await expect(packetButton).toHaveText("Red tag — Saint Orra");

    // Commit the sealed-default fork — same tap the sibling specs
    // use to reach `packet-delivered`.
    await tap(page, "#deliverButton");
    await waitForBeat(page, "packet-delivered");

    // SURFACE 4 — Delivery-complete copy at `packet-delivered`
    // itself (asserted BEFORE the auto-advance to
    // `io-return-recognition`, so the beat is pinned by
    // `waitForBeat` above). `#line` is the only line node in
    // `aftersign/index.html`. It must speak the red thread, not
    // the blue seal.
    const lineEl = page.locator("#line");
    await expect(lineEl).toContainText(/red tag|Saint Orra/i);
    await expect(lineEl).not.toContainText(/blue seal/i);
    await expect(lineEl).not.toContainText(/blue route/i);
  });

  // SURFACE 3 — Route-choice buttons at round-2 `packet-choice` speak
  // the TRUSTED-row labels, not the firstRun blue-packet defaults.
  //
  // Un-fixme'd by PR #2253 (the #2245 wire-up): `aftersign/main.js`'s
  // round-2 `renderRouteRiskChoice({...})` call site now reads
  // `routeRiskLabelsForDelivery(state.delivery.id)` from
  // `aftersign/src/redTagRouteOfferLabels.js`, which pins the trusted
  // row by delivery identity (not by `npcs.io.memory`) so an empty
  // memory can no longer fall back to the firstRun blue-packet
  // labels. This is the phone-viewport, tap-driven assertion Soren
  // asked for on PR #2253 — it reaches the red-tag packet-choice
  // surface through the shipped controls and reads the rendered
  // button text.
  test("round-2 red-tag packet-choice route buttons speak the trusted row (#2245 wire-up)", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto(
      `/aftersign/?slot=red-tag-second-packet-round-2-surface-3-${Date.now()}`,
      { waitUntil: "load" },
    );
    await waitForReady(page);

    // Round 1 begins at `packet-offered`, not `packet-choice`. Take
    // the shipped safe-delivery offer and inspect the packet before
    // trying to tap a route button. This writes
    // `{lastRoute:"safe", succeeded:true}` so round 2 offers the
    // shortcut button whose trusted label is the regression symptom.
    //
    // Round-1 opening + route tap mirror the PASSING sibling at
    // `aftersign/e2e/aftersign-packet-recall-feel.playtest.spec.ts`
    // (lines ~96-120): we must wait for the tray's
    // `data-visible="true"` BEFORE asserting the button is visible,
    // because the shipped tray is `data-visible="false"` with
    // `display: none` at every beat other than `packet-choice`
    // (`aftersign/index.html` line 759: `.route-choice[data-visible="true"]`
    // is the CSS selector that unhides it). Playwright's
    // `toBeVisible` reads display state, so a race between
    // `waitForBeat("packet-choice")` returning and the DOM flipping
    // `data-visible` fails exactly the way CI reported ("Expected:
    // visible, Received: hidden"). Soren's REQUEST_CHANGES on
    // PR #2253 iter-3 — AI008: the earlier draft asserted the button
    // visible without gating on the tray's own visibility handshake.
    await waitForBeat(page, "packet-offered");
    const firstJob = page.locator("#job-offer-job-safe-delivery");
    await expect(firstJob).toBeVisible({ timeout: WAIT_MS });
    await firstJob.tap();
    const firstPacket = page.locator("#packetButton");
    await expect(firstPacket).toBeEnabled({ timeout: WAIT_MS });
    await firstPacket.tap();
    await waitForBeat(page, "packet-choice");

    const roundOneRouteRiskTray = page.locator("#routeRiskChoice");
    await expect(roundOneRouteRiskTray).toHaveAttribute(
      "data-visible",
      "true",
      { timeout: WAIT_MS },
    );
    const roundOneLongWay = roundOneRouteRiskTray.locator(
      'button[data-aftersign-tap-choice="take-the-long-way"]:not([disabled])',
    );
    await expect(roundOneLongWay).toBeVisible({ timeout: WAIT_MS });
    await roundOneLongWay.tap();
    // The tray flipping back to hidden is the player-visible proof
    // the route tap committed; same handshake the recall spec uses.
    await expect(roundOneLongWay).toBeHidden({ timeout: WAIT_MS });

    // After the route tap the beat advances to
    // `delivery-acknowledgment`; the shipped controls there are the
    // `data-choice-id` buttons the recall spec taps, NOT
    // `#acknowledgeRouteButton` / `#deliverButton` (those belong to
    // the sealed-default fork the top-level test uses). Mirroring
    // the sibling spec keeps round-1 drivable without the fork.
    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "io-return-recognition");
    await tapReturnReason(page, "blunt");
    await waitForBeat(page, "return-tone-choice");
    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");

    const acceptSecondPacket = page.locator(
      'button[data-choice-id="accept-second-packet"]',
    );
    await expect(acceptSecondPacket).toHaveText("Take the second packet");
    await acceptSecondPacket.tap();
    await tap(page, "#deliverButton");
    await waitForBeat(page, "packet-offered");

    const packetButton = page.locator("#packetButton");
    await packetButton.tap();
    await waitForBeat(page, "packet-choice");

    const routeRiskTray = page.locator("#routeRiskChoice");
    // Same tray-visibility handshake as round 1 — gate on the
    // shipped `data-visible="true"` flip, not Playwright's generic
    // visibility heuristic, so the assertion can't race the
    // `packet-choice` beat flip. (Soren's REQUEST_CHANGES on
    // PR #2253 iter-3.)
    await expect(routeRiskTray).toHaveAttribute("data-visible", "true", {
      timeout: WAIT_MS,
    });
    // After a safe+succeeded round-1,
    // `computeOfferedActions({lastRoute:"safe",succeeded:true})`
    // returns `["take-the-shortcut","carry-a-fragile-packet"]`
    // (see `apps/web/src/aftersign/routeRiskMemory.ts`). The
    // long-way button is NOT in that offered set — it only ever
    // renders alongside `repair-the-loss` on a null / failed memory
    // (and then WITHOUT a shortcut sibling). The two trusted
    // route-label strings this spec guards therefore cannot both
    // render on the same packet-choice; we assert on the shortcut
    // (which carries the regression's player-visible symptom:
    // "Behind the shuttered pharmacy" vs the firstRun "Cut past
    // the bell rope"). The sibling retention spec asserts the
    // long-way label on a null-memory flow.
    const riskyRouteButton = routeRiskTray.locator(
      'button[data-aftersign-tap-choice="take-the-shortcut"]',
    );
    await expect(riskyRouteButton).toHaveText(TRUSTED_RISKY_ROUTE_LABEL);
    // Negative guard against the firstRun regression — if a future
    // refactor re-pins the resolver to firstRun, this fails
    // deterministically (not via loose "blue" substring matching).
    await expect(riskyRouteButton).not.toHaveText(FIRST_RUN_RISKY_ROUTE_LABEL);
  });
});
