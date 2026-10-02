import { expect, test, type Page } from "@playwright/test";

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
//   - Opt-in script: `npm run test:e2e:aftersign:production-durable-authority`
//     (added in the root package.json alongside this file) sets the env
//     var expected here and invokes playwright on this spec only.
//
// What this spec proves (and the sibling two-round spec does NOT):
//   The two-round spec drives a full round inside ONE page document and
//   asserts the second-round tray stamp becomes "completed" — proving the
//   memory derivation is live, but NOT proving the durable save survives
//   a navigation. This spec plays the SAME full round (packet tap →
//   acknowledge → deliver → recognition → next-job) and THEN does a hard
//   `page.reload()`. After the reload the tray must come back stamped
//   `completed` (not `fresh`), restored from the Worker-backed save. If
//   the Worker silently loses the save, the restored tray falls through
//   `computeOfferedJobs(undefined)` back to `[SAFE_DEFAULT_JOB_ID]` with
//   stamp `fresh` and this spec goes red — which is the whole point.
const productionUrl = process.env.AFTERSIGN_PRODUCTION_URL;

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

// `COMPLETED_JOB_IDS` as declared in packages/aftersign/src/computeOfferedJobs.ts.
// Hard-coded here rather than imported because this file is driven by the
// aftersign Playwright config, which does NOT bundle the apps/web TS
// sources; importing would blow up module resolution. The sibling two-
// round spec takes the same inline approach for `job-night-transfer`.
const COMPLETED_JOB_IDS = ["job-night-transfer", "job-signed-receipt"] as const;

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

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`);
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.tap();
}

test.describe("production durable authority", () => {
  test.skip(!productionUrl, "set AFTERSIGN_PRODUCTION_URL to run against the deployed Worker");
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a played first round survives a hard reload against the deployed Worker", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    // Unique slot per run — the sibling `aftersign-mloop-two-round.playtest.spec.ts`
    // uses the same `?slot=…${Date.now()}` isolation pattern. Without this,
    // a second run of this spec against the same deployed Worker would
    // start on the ALREADY-completed branch, and the pre-click `fresh`
    // assertion would go red for a reason unrelated to the durable save.
    const slot = `prod-durable-authority-${Date.now()}`;
    const base = productionUrl!.replace(/\/+$/, "");
    const separator = base.includes("?") ? "&" : "?";
    await page.goto(`${base}${separator}slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    // --- Round one: play the SAME path the two-round spec plays. ---
    // Any divergence from that path risks reaching a branch the memory
    // model does not stamp `completed`; the two-round spec is the one
    // and only verified recipe for driving the derivation into the
    // `priorOutcome: "completed"` branch of `computeOfferedJobs`.
    await waitForBeat(page, "packet-offered");
    const tray = page.locator("#offeredJobs");
    await expect(tray).toHaveAttribute("data-mloop-divergence-memory", "fresh");
    const freshOffer = tray.locator("button[data-offered-job-id]");
    await expect(freshOffer).toHaveCount(1);
    await freshOffer.tap();
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");
    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");

    await waitForBeat(page, "io-return-recognition");
    await page.locator('button[data-return-reason="blunt"]:not([disabled])').tap();
    await waitForBeat(page, "return-tone-choice");
    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");
    await tapChoice(page, "deliver-packet");

    // At this point `#offeredJobs` has re-rendered for round two and the
    // completed-branch save has been written to the Durable Object. Pin
    // that pre-reload state so a failure after reload has a clear "it
    // WAS completed, it CAME BACK fresh" diff.
    await waitForBeat(page, "packet-offered");
    await expect(tray).toHaveAttribute("data-mloop-divergence-memory", "completed");
    const preReloadOffers = tray.locator("button[data-offered-job-id]");
    await expect(preReloadOffers).toHaveCount(COMPLETED_JOB_IDS.length);
    const preReloadIds = await preReloadOffers.evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).getAttribute("data-offered-job-id")),
    );
    expect(preReloadIds, "pre-reload offer ids must match the completed branch").toEqual(
      [...COMPLETED_JOB_IDS],
    );

    // --- The reload boundary — the whole reason this spec exists. ---
    // A new browser document is the minimum useful reload boundary: the
    // rendered offer must be rebuilt from the Worker-backed save, not
    // retained only in the previous page's JavaScript heap.
    await page.reload({ waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");

    // Load-bearing assertion: the restored tray must stamp `completed`
    // (not `fresh`). A Worker that silently loses the save falls back
    // through `computeOfferedJobs(undefined)` to `[SAFE_DEFAULT_JOB_ID]`
    // with stamp `fresh`, and this assertion goes red. The old spec
    // only tapped once (no `completed` memory ever written) and asserted
    // the id-set differed — on a healthy Worker that would ALSO fire a
    // false red, because one tap doesn't advance memory past the safe
    // default.
    await expect(tray).toHaveAttribute("data-mloop-divergence-memory", "completed");

    const restoredOffers = tray.locator("button[data-offered-job-id]");
    await expect(restoredOffers).toHaveCount(COMPLETED_JOB_IDS.length);
    const restoredIds = await restoredOffers.evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).getAttribute("data-offered-job-id")),
    );
    expect(
      restoredIds,
      "restored offers must match COMPLETED_JOB_IDS — a Worker that lost the save " +
        "would fall back to [SAFE_DEFAULT_JOB_ID] here",
    ).toEqual([...COMPLETED_JOB_IDS]);
  });
});
