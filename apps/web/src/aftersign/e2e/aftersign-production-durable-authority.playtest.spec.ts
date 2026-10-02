import { expect, test } from "@playwright/test";

// This is deliberately opt-in: its target is the deployed Worker, not the
// local preview server used by the ordinary harness suite.
const productionUrl = process.env.AFTERSIGN_PRODUCTION_URL;

test.describe("production durable authority", () => {
  test.skip(!productionUrl, "set AFTERSIGN_PRODUCTION_URL to run against the deployed Worker");

  test("reload surfaces the memory-driven offer, not the safe default", async ({ page }) => {
    await page.goto(productionUrl!);

    const offeredJobs = page.locator("#offeredJobs");
    await expect(offeredJobs).toBeVisible();

    // Capture the pre-click offer id. On a fresh document with no
    // Worker-backed memory this is the safe-default branch of
    // `computeOfferedJobs` (see
    // `apps/web/src/aftersign/aftersignMloopDivergence.contract.test.ts`:
    // `computeOfferedJobs(undefined) === [SAFE_DEFAULT_JOB_ID]`). The
    // click is what should push memory forward so the next render takes
    // the completed-branch (`COMPLETED_JOB_IDS`) — a *different* id set.
    const preClickOffer = offeredJobs.locator("button[data-offered-job-id]").first();
    await expect(preClickOffer).toBeVisible();
    const preClickOfferId = await preClickOffer.getAttribute("data-offered-job-id");
    expect(preClickOfferId, "pre-click offer must expose its job id").not.toBeNull();

    await preClickOffer.click();

    // A new browser document is the minimum useful reload boundary: the
    // rendered offer must be rebuilt from the Worker-backed save, not retained
    // only in the previous page's JavaScript heap.
    await page.reload();
    await expect(offeredJobs).toBeVisible();

    const restoredOffers = offeredJobs.locator("button[data-offered-job-id]");
    await expect(restoredOffers.first()).toBeVisible();

    // Load-bearing assertion: the restored offer id set must DIFFER from
    // the pre-click (safe-default) id. A Worker that silently loses the
    // save falls back through `computeOfferedJobs(undefined)` to
    // `[SAFE_DEFAULT_JOB_ID]` — i.e. the same id as `preClickOfferId` —
    // and this assertion goes red. The previous `toHaveCount(1)` guard
    // could not distinguish "state restored" from "state reset", because
    // the safe-default branch also renders exactly one offer.
    const restoredIds = await restoredOffers.evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).getAttribute("data-offered-job-id")),
    );
    expect(restoredIds, "every restored offer must expose its job id").not.toContain(null);
    expect(
      restoredIds,
      "restored offers must not collapse back to the pre-click safe-default id — " +
        "that would mean the Worker lost the save",
    ).not.toEqual([preClickOfferId]);
  });
});
