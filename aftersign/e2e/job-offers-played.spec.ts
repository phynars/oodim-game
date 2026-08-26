import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN — `computeOfferedJobs` served-page divergence, real-tap.
//
// This is the spec issue #1395 explicitly requires: a played path
// (no harness input, no `__game.input.setPlayerMemory`, no
// `forceReload`) that reaches `packet-offered` with a completed prior
// delivery in memory, and asserts the divergent `computeOfferedJobs`
// render lands on the served DOM:
//
//   FIRST VISIT (packet.delivered === false)
//     `computeOfferedJobs(undefined)` → `[SAFE_DEFAULT_JOB_ID]`
//     → `#job-offer-job-safe-delivery` is visible; the completed-set
//        buttons are absent.
//
//   RETURNING PLAYER (packet.delivered === true after the first loop)
//     `computeOfferedJobs({ priorOutcome: "completed" })` →
//     `["job-night-transfer", "job-signed-receipt"]`
//     → `#job-offer-job-night-transfer` + `#job-offer-job-signed-receipt`
//        are both visible; the safe-default button is absent.
//
// Reviewer feedback on PR #1396 first pass:
//   • The `computeOfferedJobs` primitive already ships and is
//     consumed by the vitest harness surface
//     (`apps/web/src/aftersign/windowGameSurface.ts`), but the
//     SERVED `aftersign/main.js` never rendered its output.
//   • This spec drives the shipped `#offeredJobs` DOM node stamped
//     by `renderText()` at the `packet-offered` beat, so a real
//     regression that unwires either half — the render OR the
//     `packet-offered` re-entry after `io-next-job → deliver-packet`
//     — reds here.
//
// Selectors match the shipped surface exactly (`playerVisibleBeatDom.js`
// + `aftersign/main.js` renderText's `computeOfferedJobs` block):
//   - `[data-beat-id="<id>"]` for story-beat arrival gate
//   - `#packetButton` for the packet tap at `packet-offered`
//   - `button[data-choice-id="<id>"]` for choice buttons
//   - `button[data-return-reason="<tone>"]` for the return-tone fork
//   - `#job-offer-<jobId>` for the computeOfferedJobs render

const WAIT_MS = 10_000;
const COLD_START_MS = 30_000;

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game
        ?.scene?.ready === true,
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
  await choice.click();
}

async function tapReturnReason(page: Page, reason: string): Promise<void> {
  const button = page
    .locator(`button[data-return-reason="${reason}"]:not([disabled])`)
    .first();
  await expect(
    button,
    `return-tone "${reason}" should be visible and tappable`,
  ).toBeVisible({ timeout: WAIT_MS });
  await button.click();
}

test.describe("AFTERSIGN computeOfferedJobs — real-tap played divergence", () => {
  test("first visit offers the safe default; the looped return offers the completed set", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `job-offers-played-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    // ─────────────────────────────────────────────────────────────
    // FIRST VISIT — packet.delivered is false, so `computeOfferedJobs`
    // returns `[SAFE_DEFAULT_JOB_ID]`.  The safe-default button must
    // render and the completed-set buttons must be absent.
    // ─────────────────────────────────────────────────────────────
    await waitForBeat(page, "packet-offered");
    const safeOffer = page.locator("#job-offer-job-safe-delivery");
    await expect(
      safeOffer,
      "safe-default offered job should render on the first visit",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(safeOffer, "safe offer label and risk must come from the selector").toHaveText(
      "Safe delivery · low risk",
    );
    await safeOffer.click();
    await expect(
      page.locator("#job-offer-job-night-transfer"),
      "completed-set offer should NOT render before any delivery",
    ).toHaveCount(0);
    await expect(
      page.locator("#job-offer-job-signed-receipt"),
      "completed-set offer should NOT render before any delivery",
    ).toHaveCount(0);

    // Play through: packet tap → route ack → deliver → recognition →
    // blunt tone → ask-for-next-job → deliver.  After the second
    // deliver-packet the flow re-enters `packet-offered` (PR #1396 —
    // the next-packet loop is a fresh packet-tap gesture, not a
    // route-choice re-run), and `state.packet.delivered` is true from
    // the first delivery, so `computeOfferedJobs` returns the
    // completed set.
    await page.locator("#packetButton").click();
    await waitForBeat(page, "packet-choice");

    // Off the packet-offered beat, the offer surface must clear —
    // job offers are an opening-beat surface, not a persistent tray.
    // (The `#job-offer-*` id space belongs to the packet-offered
    // render only; any leak into packet-choice is a real regression.)
    await expect(
      page.locator('[id^="job-offer-"]'),
      "job-offer buttons must not persist past the packet-offered beat",
    ).toHaveCount(0, { timeout: WAIT_MS });

    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "io-return-recognition");

    await tapReturnReason(page, "blunt");
    await waitForBeat(page, "return-tone-choice");

    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");

    await tapChoice(page, "deliver-packet");

    // ─────────────────────────────────────────────────────────────
    // LOOPED RETURN — after the loop the served page lands back at
    // `packet-offered` with `state.packet.delivered === true`, so the
    // completed-set buttons render and the safe-default button is
    // absent.  This is the exact divergence #1395 asks the served
    // page to prove.
    // ─────────────────────────────────────────────────────────────
    await waitForBeat(page, "packet-offered");
    const nightTransferOffer = page.locator("#job-offer-job-night-transfer");
    await expect(
      nightTransferOffer,
      "completed-set night-transfer offer should render after a delivery",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(
      nightTransferOffer,
      "completed offer label and risk must diverge from the first-visit selector result",
    ).toHaveText("Night transfer · medium risk");
    await nightTransferOffer.click();
    await expect(
      page.locator("#job-offer-job-signed-receipt"),
      "completed-set signed-receipt offer should render after a delivery",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(
      page.locator("#job-offer-job-safe-delivery"),
      "safe-default offer must NOT render at the looped packet-offered — the divergent completed set replaces it",
    ).toHaveCount(0);
  });
});
