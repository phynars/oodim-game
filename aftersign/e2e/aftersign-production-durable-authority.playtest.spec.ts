import { expect, test } from "@playwright/test";

// Opt-in production harness. Default aftersign/playwright.config.ts targets
// the local vite preview (baseURL http://localhost:4374/aftersign/); this
// spec deliberately overrides to the DEPLOYED Worker so the durable save
// path is exercised against the real Durable Object, not an in-memory
// preview. Both URL and run-switch are env-gated so a normal
// `npm run test:aftersign` lane never fires it.
//
// Wiring:
//   - File lives under aftersign/e2e/ so the only aftersign Playwright
//     config (aftersign/playwright.config.ts, testDir: "e2e") can see it.
//   - `.playtest.spec.ts` is kept in the filename to match the playtest
//     naming the surface contract tests look for
//     (aftersignMloopServedDivergencePlaytestContract.test.ts et al).
//   - Guarded by AFTERSIGN_PRODUCTION_URL: unset → test.skip, so cold
//     local + CI runs stay green without needing a deployed target.
//   - Opt-in script: `npm run test:aftersign:production` (added in the
//     root package.json alongside this file) sets the env var expected
//     here and invokes playwright on this spec only.
const productionUrl = process.env.AFTERSIGN_PRODUCTION_URL;

test.describe("production durable authority", () => {
  test.skip(!productionUrl, "set AFTERSIGN_PRODUCTION_URL to run against the deployed Worker");

  test("reload surfaces the memory-driven offer, not the safe default", async ({ page }) => {
    await page.goto(productionUrl!);

    const offeredJobs = page.locator("#offeredJobs");
    await expect(offeredJobs).toBeVisible();

    // Capture the pre-click offer id. On a fresh document with no
    // Worker-backed memory this is the safe-default branch of
    // `computeOfferedJobs` — see
    // `apps/web/src/aftersign/aftersignMloopDivergence.contract.test.ts`
    // (`computeOfferedJobs(undefined) === [SAFE_DEFAULT_JOB_ID]`) and the
    // rendering contract in
    // `apps/web/src/aftersign/aftersignMloopDivergenceTrayContract.test.ts`
    // which pins `button.setAttribute("data-offered-job-id", …)` as the
    // tray's rendered surface — so this locator is the same string the
    // tray contract test asserts the bundle writes.
    const preClickOffer = offeredJobs.locator("button[data-offered-job-id]").first();
    await expect(preClickOffer).toBeVisible();
    const preClickOfferId = await preClickOffer.getAttribute("data-offered-job-id");
    expect(preClickOfferId, "pre-click offer must expose its job id").not.toBeNull();

    await preClickOffer.click();

    // Narrow the "click actually moved memory forward" premise before we
    // reload: wait for the bundle to repaint SOMETHING past the safe-default
    // tray. The weakest contract that holds across both branches of the
    // post-tap render path (packet-choice ack and durable packet-recall
    // re-entry — see aftersignJobAcceptedRender.consumer.test.ts and
    // aftersignPacketRecallRender.ts) is: either the tray's offered-id set
    // changes, or #offeredJobs is replaced by a non-tray surface. If
    // neither happens inside a generous timeout, the click did not advance
    // memory and the reload assertion below would be meaningless — fail
    // fast with a clear reason instead of going red on the wrong line.
    await expect
      .poll(
        async () => {
          const stillTrayWithSameOffers = await offeredJobs
            .locator(`button[data-offered-job-id="${preClickOfferId}"]`)
            .count();
          const nonTrayChildren = await offeredJobs
            .locator(":scope > *:not(button[data-offered-job-id])")
            .count();
          return stillTrayWithSameOffers === 1 && nonTrayChildren === 0;
        },
        {
          message:
            "tap on offered-job button did not advance the rendered surface — " +
            "either the click did not fire or the bundle did not re-render past " +
            "packet-offered; reload assertion below would be unverifiable",
          timeout: 10_000,
        },
      )
      .toBeFalsy();

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
