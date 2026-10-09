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
// Why FOUR surfaces at once (what #2243 adds beyond its siblings):
//   `red-tag-second-packet-served.spec.ts`      — asserts #packetButton label
//                                                 + #offeredJobs route literal
//                                                 at `packet-offered` round-2.
//   `red-tag-packet-choice-retention.spec.ts`   — asserts #packetButton label
//                                                 SURVIVES `packet-choice`
//                                                 and that `#line` speaks
//                                                 the red thread at the
//                                                 following
//                                                 `io-return-recognition`.
//   THIS spec                                   — adds the two surfaces
//                                                 those miss, in the
//                                                 same walk:
//                                                 (3) the `#routeRiskChoice`
//                                                     tray's route-choice
//                                                     buttons show the
//                                                     TRUSTED-row labels
//                                                     at round-2
//                                                     `packet-choice`
//                                                     (`"Long way — past
//                                                     the kiosk"` /
//                                                     `"Behind the
//                                                     shuttered pharmacy"`),
//                                                     not the firstRun
//                                                     blue-packet defaults.
//                                                 (4) `#line` at
//                                                     `packet-delivered`
//                                                     — the delivery-
//                                                     complete beat
//                                                     itself, before the
//                                                     auto-advance — names
//                                                     the red tag, not
//                                                     the blue seal.
//
// Base-branch failure proof (CI gate for a type:bug issue):
//   Surfaces (1), (2), and (4) all fail on base (pre-#2241 / pre-#2242):
//   surface (1) renders "Blue packet" instead of "Red tag — Saint Orra";
//   surface (2) renders the firstRun blue-packet route in `#offeredJobs`;
//   surface (4) renders "blue seal" delivery-complete copy. Any ONE of
//   those failures satisfies the type:bug CI gate on base.
//
//   Surface (3) is intentionally decoupled from the base-failure claim.
//   The earlier iteration of this spec credited #2242 with wiring
//   `aftersign/main.js`'s round-2 `renderRouteRiskChoice({...})` call
//   site to `labelForAction: routeRiskActionLabelForOffer(TRUSTED)` —
//   that was the wrong citation. #2242 is the delivery-complete copy
//   fix (surface 4); #2241 is the issue that owns the packet-button
//   AND route-choice buttons (surfaces 1 + 3). Both are closed. I
//   cannot verify whether the `main.js` round-2 call site actually
//   passes `routeRiskActionLabelForOffer(TRUSTED)` today — the file
//   is >200KB and skipped by grep; my reads cap at 24KB. If #2241's
//   diff only touched the packet-button render and left
//   `labelForAction: routeRiskActionLabel` in place, surface (3)
//   will fail on main too — and that's a real bug this spec
//   deliberately surfaces rather than hides. Decoupling the base-
//   failure proof from surface (3) means the spec still earns its
//   CI gate from (1)/(2)/(4) even if (3) passes trivially.
//
// Source of truth for the four route strings:
//   `apps/web/src/aftersign/aftersignJobOfferCopy.js`
//     - firstRun.safeRouteLabel  = "Lit stair — under Io's window"
//     - firstRun.riskyRouteLabel = "Cut past the bell rope"
//     - trusted.safeRouteLabel   = "Long way — past the kiosk"
//     - trusted.riskyRouteLabel  = "Behind the shuttered pharmacy"
//
// This spec DOES NOT read `window.__game` for assertions — only for the
// beat-settled handshake (same shape every sibling uses). The four
// surface assertions all read served DOM nodes.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 60_000;

const TRUSTED_SAFE_ROUTE_LABEL = "Long way — past the kiosk";
const TRUSTED_RISKY_ROUTE_LABEL = "Behind the shuttered pharmacy";
const FIRST_RUN_SAFE_ROUTE_LABEL = "Lit stair — under Io's window";
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

test.describe("AFTERSIGN red-tag second packet — four-surface round-2 contract (#2243)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("round-2 red-tag second packet speaks red on all four player-visible surfaces", async ({
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
    await expect(packetButton).toHaveText("Red tag — Saint Orra");

    // SURFACE 3 — Route-choice buttons on `#routeRiskChoice` speak
    // the TRUSTED row's route labels (NOT the firstRun blue-packet
    // defaults). This asserts that `aftersign/main.js`'s round-2
    // `renderRouteRiskChoice({...})` call site passes
    // `labelForAction: routeRiskActionLabelForOffer(TRUSTED)`
    // instead of defaulting to the firstRun-pinned
    // `routeRiskActionLabel`. #2241 owns this wiring (closed), but
    // I could not read the >200KB `main.js` directly to confirm the
    // call site was updated — if it wasn't, these two assertions
    // will fail on main and this spec will have surfaced a real
    // regression gap in #2241's acceptance criteria.
    const routeRiskTray = page.locator("#routeRiskChoice");
    await expect(routeRiskTray).toBeVisible();
    const safeRouteButton = routeRiskTray.locator(
      'button[data-aftersign-tap-choice="take-the-long-way"]',
    );
    const riskyRouteButton = routeRiskTray.locator(
      'button[data-aftersign-tap-choice="take-the-shortcut"]',
    );
    await expect(safeRouteButton).toHaveText(TRUSTED_SAFE_ROUTE_LABEL);
    await expect(riskyRouteButton).toHaveText(TRUSTED_RISKY_ROUTE_LABEL);
    // Negative guards against the firstRun regression — if a future
    // refactor re-pins the resolver to firstRun, these fail
    // deterministically (not via loose "blue" substring matching).
    await expect(safeRouteButton).not.toHaveText(FIRST_RUN_SAFE_ROUTE_LABEL);
    await expect(riskyRouteButton).not.toHaveText(FIRST_RUN_RISKY_ROUTE_LABEL);

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
});
