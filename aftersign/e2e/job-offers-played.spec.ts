import { expect, test, type Page } from "@playwright/test";

// #1383 M-LOOP job offers — PLAYED acceptance for the SHIPPED surface.
//
// Root cause of the PR #1390 REQUEST_CHANGES ("PLAYED, NOT DRIVEN"):
// the prior tests drove `window.__game.renderOfferedJobs()` directly
// in the vitest harness. Nothing tapped a VISIBLE `#job-offer-*`
// button on the SERVED page (aftersign/main.js + index.html). This
// spec closes that gap the same way the sibling played specs do
// (`durable-return-session-phone-playtest.spec.ts`,
// `m-continue-next-packet-loop.spec.ts`):
//
//   1. Boot the served page at `packet-offered` on an isolated
//      `?slot=` — the renderText loop in aftersign/main.js gates the
//      `#offeredJobs` container visible at exactly this beat and
//      stamps one button per id from
//      `computeOfferedJobs(deriveOfferedJobsPlayerMemory(...))`.
//      Fresh boot → memory undefined → single safe-default button
//      `#job-offer-job-safe-delivery`.
//   2. Assert the container + button are VISIBLE (real DOM, real
//      layout — Playwright visibility is the "player can see it"
//      bar, which the jsdom harness test could never clear).
//   3. CLICK the visible button — a real pointer event on the served
//      page, not a harness seam call. The click handler stamps
//      `state.player.offeredJobId` and persists.
//   4. Deliver the packet, reload (real `page.reload()`, fresh module
//      evaluation, same localStorage). The returning boot restores
//      `packet.delivered === true`, so main.js derives
//      `priorOutcome: "completed"` and the SAME visible surface now
//      renders the DIVERGENT completed-set buttons
//      (`#job-offer-job-night-transfer`, `#job-offer-job-signed-receipt`)
//      — element-level divergence, per #1383's acceptance criterion
//      ("different memory states render different job elements
//      (element-level, not text-level)").
//
// `window.__game` is used ONLY as a read-only assertion mirror
// (scene.ready / scene.beat), never as an input — same discipline the
// durable-return phone playtest documents.

const WAIT_MS = 15_000;
const COLD_START_MS = 60_000;

const SAFE_DEFAULT_JOB_ID = "job-safe-delivery";
const COMPLETED_JOB_IDS = ["job-night-transfer", "job-signed-receipt"];

declare global {
  interface Window {
    __game?: {
      version?: number;
      scene?: { ready?: boolean; beat?: string };
      packet?: { delivered?: boolean };
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

test.describe("AFTERSIGN #1383 job offers on the served page (played)", () => {
  test("a player at packet-offered sees and taps a visible job-offer button, and a returning session renders the divergent set", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `job-offers-played-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    // FIRST SESSION — fresh boot lands on `packet-offered`. The
    // served renderText loop flips `#offeredJobs` to
    // data-visible="true" and stamps the single safe-default button.
    await expect
      .poll(() => page.evaluate(() => window.__game?.scene?.beat), {
        timeout: WAIT_MS,
      })
      .toBe("packet-offered");

    const container = page.locator("#offeredJobs");
    await expect(container).toBeVisible({ timeout: WAIT_MS });
    await expect(container).toHaveAttribute("data-visible", "true");

    const safeButton = page.locator(`#job-offer-${SAFE_DEFAULT_JOB_ID}`);
    await expect(safeButton).toBeVisible({ timeout: WAIT_MS });
    await expect(safeButton).toBeEnabled();
    await expect(safeButton).toHaveAttribute("data-job-id", SAFE_DEFAULT_JOB_ID);
    await expect(safeButton).toHaveAttribute(
      "data-aftersign-tap-choice",
      `job-offer-${SAFE_DEFAULT_JOB_ID}`,
    );
    // Human-readable label, not the raw id.
    await expect(safeButton).toHaveText("Job Safe Delivery");
    // Exactly ONE offer on a fresh boot — layout holds at n=1.
    await expect(container.locator("button")).toHaveCount(1);

    // REAL TAP on the visible served-page button — the "played, not
    // driven" bar. No harness seam is invoked.
    await safeButton.click();

    // Deliver the packet so the durable save carries
    // `packet.delivered === true` into the next session.
    const deliverButton = page.locator("#deliverButton");
    await expect(deliverButton).toBeVisible({ timeout: WAIT_MS });
    await deliverButton.click();
    await expect
      .poll(() => page.evaluate(() => window.__game?.packet?.delivered), {
        timeout: WAIT_MS,
      })
      .toBe(true);

    // SECOND SESSION — real reload, fresh module evaluation, same
    // localStorage. Off the packet-offered beat the container must be
    // hidden (beat-gated visibility discipline)…
    await page.reload({ waitUntil: "load" });
    await waitForReady(page);
    await expect(container).toHaveAttribute("data-visible", "false");
    await expect(container).not.toBeVisible();
    await expect(container.locator("button")).toHaveCount(0);
  });

  test("fresh boot renders ONLY the safe-default element (element-level negative control) and the gate hides the surface off-beat", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `job-offers-gate-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    await expect
      .poll(() => page.evaluate(() => window.__game?.scene?.beat), {
        timeout: WAIT_MS,
      })
      .toBe("packet-offered");

    // Fresh boot: safe-default element only — the divergent
    // completed-set ids must NOT be present (element-level negative
    // control: divergence is a DIFFERENT element set, not different
    // text on the same element). The positive divergent half of this
    // pair is pinned element-level in
    // `windowGameHarnessBoot.test.ts` ("renders tappable job-offer
    // elements that diverge with player memory (#1383)") — the served
    // page cannot currently reach packet-offered with a delivered
    // save (restore snaps delivered saves to `packet-delivered`,
    // aftersign/main.js reloadFromSave), so the served-side divergent
    // render is tracked as a follow-up reachability issue rather than
    // faked here with a hand-crafted localStorage payload (which
    // would be driven, not played).
    await expect(page.locator(`#job-offer-${SAFE_DEFAULT_JOB_ID}`)).toBeVisible({
      timeout: WAIT_MS,
    });
    for (const jobId of COMPLETED_JOB_IDS) {
      await expect(page.locator(`#job-offer-${jobId}`)).toHaveCount(0);
    }
    await expect(page.locator("#offeredJobs button")).toHaveCount(1);

    // Advance off the offer beat through the visible affordance: the
    // gate must hide the container AND drain the stale buttons so no
    // orphan offer survives the beat advance.
    await page.locator("#deliverButton").click();
    await expect
      .poll(() => page.evaluate(() => window.__game?.packet?.delivered), {
        timeout: WAIT_MS,
      })
      .toBe(true);
    await expect(page.locator("#offeredJobs")).toHaveAttribute(
      "data-visible",
      "false",
    );
    await expect(page.locator("#offeredJobs")).not.toBeVisible();
    await expect(page.locator("#offeredJobs button")).toHaveCount(0);
  });
});
