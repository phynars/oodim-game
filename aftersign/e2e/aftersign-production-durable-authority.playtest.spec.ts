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
//   acknowledge → deliver → recognition → next-job), then explicitly
//   CLEARS origin localStorage before navigating back to the slot. That
//   clear is load-bearing: `aftersign/src/runtime/persistence.js:23`
//   defaults saves to `authority: "local-fallback"` when the Worker
//   write doesn't confirm, so a plain `page.reload()` would recover the
//   restored tray from the browser's own fallback cache and the final
//   `completed` assertion would stay green even if the Worker silently
//   lost the save (exactly the bug Mara flagged on the first revision).
//   With localStorage emptied the restore MUST come from the deployed
//   Worker's record — if that record is missing or corrupted the tray
//   falls through `computeOfferedJobs(undefined)` back to
//   `[SAFE_DEFAULT_JOB_ID]` with stamp `fresh`, and this spec goes red.
//   The pattern mirrors `durable-return-session-phone-playtest.spec.ts`
//   (`clearLocalStorage` + `page.goto(url)` at lines 156–162), which is
//   the canonical "force recovery from the backend record" boundary in
//   this directory.
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

// Mirrors `durable-return-session-phone-playtest.spec.ts`'s helper of the
// same name. Clears origin localStorage AND polls until the clear is
// observable, so a stale key written during the final beat (the save
// path is async) can't survive the subsequent navigation and silently
// serve the restored tray from the local-fallback branch of
// `aftersign/src/runtime/persistence.js:23`.
async function clearLocalStorage(page: Page): Promise<void> {
  await page.evaluate(() => window.localStorage.clear());
  await expect
    .poll(() => page.evaluate(() => window.localStorage.length), { timeout: WAIT_MS })
    .toBe(0);
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
    const url = `${base}${separator}slot=${slot}`;
    await page.goto(url, { waitUntil: "load" });
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
    // A plain `page.reload()` keeps origin localStorage, which means the
    // restored tray could be served out of `persistence.js:23`'s
    // `authority: "local-fallback"` branch and the final `completed`
    // assertion would stay green even if the deployed Worker silently
    // lost the save. Mara's REQUEST_CHANGES called this out directly.
    //
    // Clearing localStorage before the next navigation removes that
    // escape hatch: the only surviving record of the completed round is
    // the one the deployed Worker holds. A fresh `page.goto(url)` with
    // the SAME `slot` query parameter then forces the client to request
    // the state from the Worker on boot. If the Worker's record is
    // missing or stale, `computeOfferedJobs(undefined)` falls back to
    // `[SAFE_DEFAULT_JOB_ID]` with stamp `fresh`, and the assertions
    // below go red — which is the whole point of this spec.
    await clearLocalStorage(page);
    await page.goto(url, { waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");

    // Load-bearing assertion: the restored tray must stamp `completed`
    // (not `fresh`). Because localStorage was cleared above, this can
    // only be satisfied by a Worker-backed restore. A Worker that
    // silently lost the save falls through
    // `computeOfferedJobs(undefined)` to `[SAFE_DEFAULT_JOB_ID]` with
    // stamp `fresh`, and this assertion goes red — the exact bug this
    // spec is named after.
    await expect(tray).toHaveAttribute("data-mloop-divergence-memory", "completed");

    const restoredOffers = tray.locator("button[data-offered-job-id]");
    await expect(restoredOffers).toHaveCount(COMPLETED_JOB_IDS.length);
    const restoredIds = await restoredOffers.evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).getAttribute("data-offered-job-id")),
    );
    expect(
      restoredIds,
      "restored offers must match COMPLETED_JOB_IDS — localStorage was cleared " +
        "before this reload, so a Worker that lost the save would fall back to " +
        "[SAFE_DEFAULT_JOB_ID] here",
    ).toEqual([...COMPLETED_JOB_IDS]);
  });
});
