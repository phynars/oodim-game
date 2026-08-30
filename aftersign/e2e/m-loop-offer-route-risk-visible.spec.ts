import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN M-LOOP-E1 offer route/risk visibility playtest.
//
// Real-tap played surface for the served `#offeredJobs` route/risk
// `<p>` (main.js:1876). Divergence between the three memory branches
// (`firstRun` / `trusted` / `opened`) is covered end-to-end by the
// pure consumer test at
// `apps/web/src/aftersign/aftersignJobOfferCopy.consumer.test.ts`
// (which drives `window.__game.restoreDurableSave` + `acceptNextJob`
// through all three branches). That test lives outside this
// SwiftShader/vite-preview lane, so it doesn't pay this lane's
// cold-start tax.
//
// What THIS spec proves — and what the consumer test can't:
//   1. On a REAL-tap first-visit boot, the first-run route/risk copy
//      is VISIBLE (rendered as text) inside `#offeredJobs`, not just
//      present in the DOM behind a hidden container.
//   2. `#offeredJobs` renders EXACTLY ONE route/risk `<p>` at a time
//      (`renderText` clears the container before re-stamping the
//      label+copy) — a signature-gated re-render bug that appended a
//      new `<p data-aftersign-job-offer-route-risk>` every rAF tick
//      would surface here as N>1 on the count assert.
//
// The prior draft of this spec asserted a SECOND `packet-offered`
// beat with trusted-branch copy after a full loop. That flow is
// architecturally unreachable via play: `io-next-job` is terminal
// (see `apps/web/src/aftersign/verticalSliceRuntimeState.ts:47` and
// `windowGameSurface.ts:523`), and durable-save resume lands the
// reloaded slot at the exact beat the loop stopped on — never back
// at `packet-offered`. Two runs' route/risk divergence is proven at
// the API layer by the consumer test above; this spec proves the
// served-page projection is real, visible DOM text on a played boot.
//
// Cold-start / wait budgets are the aftersign flagship-tier defaults
// (matching `movement-feel-contract.spec.ts` and the widened bounds
// in `mobile-move-pad-served-feel.spec.ts`). SwiftShader + esm.sh
// three.js imports on CI regularly exceed a 10s wait during the
// aftersign lane's cold boot (#700/#506/#590/#766/#1551 review 4), so
// each locator poll gets 30s and the outer spec timeout gets 90s.
// A real regression still reds within one attempt; a boot hiccup
// gets absorbed inside the same attempt instead of tripping the
// retry surface.
const WAIT_MS = 30_000;
const COLD_START_MS = 90_000;

const firstRoute = "Take the lit stair. Do not stop under the bell rope.";
const firstRisk = "Low risk. Long route. Io can see most of it from the kiosk.";

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
  await expect(
    page.locator(`[data-beat-id="${beatId}"]`),
    `story line should visibly reach beat "${beatId}"`,
  ).toBeVisible({ timeout: WAIT_MS });
}

test("renders the first-run route and risk copy inside #offeredJobs on a played first visit", async ({
  page,
}) => {
  test.setTimeout(COLD_START_MS);
  const slot = `offer-route-risk-${Date.now()}`;
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
  await waitForReady(page);

  await waitForBeat(page, "packet-offered");

  // #1 — the route/risk `<p>` is rendered as visible text inside the
  // shipped `#offeredJobs` container. `.route-choice[data-visible="true"]`
  // is what unhides the container at packet-offered (see index.html
  // rule at .route-choice / [data-visible="true"]).
  const routeRiskP = page.locator(
    "#offeredJobs [data-aftersign-job-offer-route-risk]",
  );
  await expect(
    routeRiskP,
    "route/risk <p> must be rendered inside #offeredJobs at packet-offered",
  ).toBeVisible({ timeout: WAIT_MS });
  await expect(
    routeRiskP,
    "route/risk <p> must speak the first-run route copy verbatim",
  ).toContainText(firstRoute, { timeout: WAIT_MS });
  await expect(
    routeRiskP,
    "route/risk <p> must speak the first-run risk copy verbatim",
  ).toContainText(firstRisk, { timeout: WAIT_MS });

  // getByText re-verifies the copy is actually rendered as visible
  // text on the page (not just present in the DOM). A `<p>` with the
  // right dataset attribute but the wrong textContent would pass the
  // containText above ONLY if the copy is authored — so this pair
  // pins BOTH the marker and the words, and pins them as VISIBLE.
  await expect(
    page.getByText(firstRoute, { exact: false }),
    "first-run route copy must be visible on the served offer surface",
  ).toBeVisible({ timeout: WAIT_MS });
  await expect(
    page.getByText(firstRisk, { exact: false }),
    "first-run risk copy must be visible on the served offer surface",
  ).toBeVisible({ timeout: WAIT_MS });

  // #2 — no-accumulation guard: exactly one route/risk `<p>` exists
  // under `#offeredJobs`. A per-tick append regression would drift
  // this well above 1 by the time the poll converges (`toHaveCount`
  // retries until the timeout). State-quiesced by construction —
  // no `waitForTimeout`, satisfies `no-wall-clock-waits`.
  await expect(
    routeRiskP,
    "renderText must clear #offeredJobs each tick — no <p> accumulation across frames",
  ).toHaveCount(1, { timeout: WAIT_MS });
});
