import { expect, test, type Page } from "@playwright/test";

// Live-verify follow-up to #2216 (step 3 of the verifier walk): after
// tapping the kiosk's "Acknowledge route" button at `packet-choice`,
// the control must visibly commit the player's choice — an
// `aria-pressed="true"` state on `#acknowledgeRouteButton` is the
// player-visible proof.
//
// Setup follows the sibling spec `aftersign-mloop-two-round.playtest.spec.ts`
// verbatim: phone viewport + `hasTouch` + `isMobile` via `test.use`,
// unique `?slot=` per run so no durable save bleeds in, wait for
// `__game.scene.ready`, then wait for the `packet-offered` beat
// before touching the offered-jobs tray. The job tray exposes its
// first-round row as `button[data-offered-job-id="job-safe-delivery"]`
// inside `#offeredJobs` (NOT `#job-offer-job-safe-delivery` — that id
// is not stamped on the shipped surface, verified by grep). Taking
// the offer then `#packetButton` crosses into the `packet-choice`
// beat where `#acknowledgeRouteButton` renders.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

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
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({
    timeout: WAIT_MS,
  });
}

test.describe("AFTERSIGN #2216 — Acknowledge route stays visibly selected", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("route acknowledgement visibly remains selected after a player tap", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await page.goto(
      `/aftersign/?slot=route-selection-state-live-verify-${Date.now()}`,
      { waitUntil: "load" },
    );
    await waitForReady(page);

    // Round-one entry: take the safe-delivery offer from the
    // `#offeredJobs` tray, then commit the packet via `#packetButton`
    // so the beat crosses into `packet-choice` where the
    // Acknowledge / Skip controls render.
    await waitForBeat(page, "packet-offered");
    const safeDelivery = page.locator(
      '#offeredJobs button[data-offered-job-id="job-safe-delivery"]',
    );
    await expect(safeDelivery).toBeVisible({ timeout: WAIT_MS });
    await safeDelivery.tap();

    const packetButton = page.locator("#packetButton");
    await expect(packetButton).toBeVisible({ timeout: WAIT_MS });
    await packetButton.tap();

    await waitForBeat(page, "packet-choice");

    const acknowledgeRoute = page.locator("#acknowledgeRouteButton");
    await expect(acknowledgeRoute).toBeVisible({ timeout: WAIT_MS });
    await acknowledgeRoute.tap();

    // The regression the fix pins: after a real phone tap commits
    // `acknowledge-kiosk`, the Acknowledge button must stamp
    // `aria-pressed="true"` and keep it set — the player's commitment
    // must land on the exact control they touched. On main (before
    // #2216's `choose()` edit) this attribute is never written, so
    // the assertion fails on the base branch (bug-issue CI gate).
    await expect(acknowledgeRoute).toHaveAttribute("aria-pressed", "true");
    // Sibling: the un-chosen route must NOT look selected.
    await expect(page.locator("#skipRouteButton")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
