// Fail-to-pass sibling for #2192 (Soren's REQUEST_CHANGES on PR #2239).
//
// What this spec locks:
//   When Io's second-packet handoff line is live in the offer tray,
//   the `data-aftersign-job-offer-route-risk` paragraph must render
//   the FROZEN red-tag route + risk literals from
//   `AFTERSIGN_JOB_OFFER_COPY.trusted` — not the blue-seal fallback
//   that `offerCopy.route`/`.risk` resolves to for a fresh boot.
//
// Why a dedicated spec:
//   The sibling `red-tag-second-packet-served.spec.ts` only asserts
//   that `#offeredJobs` contains the string "Saint Orra" — a hardcoded
//   literal passed that check, hiding the fact that the route/risk
//   text could drift from the single source. This spec reads the
//   frozen copy table directly and asserts the paragraph matches it
//   byte-for-byte, so a future hardcoded restamp reds here before it
//   can smear the surface the player reads.
//
// Fails on main: the pre-PR#2239 renderer prints the blue-seal
// `offerCopy.route` as the fallback (fresh-boot memory → firstRun
// branch), which contains "lit stair" and NOT "Carry the red tag
// behind the shuttered pharmacy". The trusted-branch literal below
// is absent from the tray on main → this spec reds.
import { expect, test, type Page } from "@playwright/test";
import { AFTERSIGN_JOB_OFFER_COPY } from "../../apps/web/src/aftersign/aftersignJobOfferCopy.js";

const WAIT_MS = 60_000;

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

test.describe("AFTERSIGN red-tag offer-tray route literal", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("route/risk paragraph matches AFTERSIGN_JOB_OFFER_COPY.trusted", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(
      `/aftersign/?slot=red-tag-route-literal-${Date.now()}`,
      { waitUntil: "load" },
    );
    await waitForReady(page);

    // Round 1: safe delivery → sealed outcome → trusted branch on round 2.
    await tap(page, "#deliverButton");
    await waitForBeat(page, "io-return-recognition");
    await tap(page, "#acknowledgeRouteButton");
    await waitForBeat(page, "return-tone-choice");
    await tap(page, "#deliverButton");
    await waitForBeat(page, "io-next-job");

    const secondPacket = page.locator('button[data-choice-id="accept-second-packet"]');
    await expect(secondPacket).toHaveText("Take the second packet");
    await secondPacket.tap();
    await tap(page, "#deliverButton");
    await waitForBeat(page, "packet-offered");

    // The frozen trusted-branch route + risk literal from the copy
    // table — the ONLY string the offer tray should carry on the
    // second-packet handoff. A hardcoded restamp would mismatch here.
    const trusted = AFTERSIGN_JOB_OFFER_COPY.trusted;
    const expected = `Route: ${trusted.route} Risk: ${trusted.risk}`;
    const routeRisk = page.locator(
      '[data-aftersign-job-offer-route-risk="true"]',
    );
    await expect(routeRisk).toHaveText(expected);
  });
});
