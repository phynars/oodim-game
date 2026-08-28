import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN M-LOOP memory-divergence phone playtest.
//
// Sits alongside `job-offers-played.spec.ts` (the real-tap divergence
// contract) and satisfies the structural guard in
// `apps/web/src/aftersign/aftersignMemoryDivergencePlaytestSurface.test.ts`.
// The guard's file-header comment names this pattern explicitly:
//
//   > A memory-divergence phone playtest proves that two runs with
//   > DIFFERENT durable-memory records produce DIFFERENT visible
//   > action sets on the served page.
//
// The played surface is `computeOfferedJobs` — the same served
// `#job-offer-<jobId>` DOM that ships to production (see
// `packages/aftersign/src/computeOfferedJobs.ts` and the served renderer
// in `aftersign/main.js`). We drive the phone viewport with real taps
// and read `window.__game` ONLY for the scene-ready gate — no
// `window.__game.input.*` puppeteering.
//
// The two divergent memory records are produced BY PLAY, not by seeding
// localStorage — a first-visit `slot` has no packet delivered
// (`packet.delivered === false` → safe-default branch), and a looped
// return slot has a `priorOutcome === "completed"` memory (completed
// branch). Their visible offer sets are asserted with `not.toEqual`.

const WAIT_MS = 10_000;
const COLD_START_MS = 45_000;
const PHONE_VIEWPORT = { width: 390, height: 844 } as const;

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

async function readVisibleOfferIds(page: Page): Promise<string[]> {
  // #job-offer-<jobId> is the shipped render surface. Reading the ids
  // (not the composite label text) keeps the divergence assertion
  // stable if a copy edit renames a label without shifting the
  // memory-branch outcome.
  await waitForBeat(page, "packet-offered");
  const offers = page.locator('[id^="job-offer-"]');
  await expect(
    offers.first(),
    "at least one #job-offer-* button must render at packet-offered",
  ).toBeVisible({ timeout: WAIT_MS });

  const count = await offers.count();
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const offer = offers.nth(index);
    if (!(await offer.isVisible())) {
      continue;
    }
    const id = await offer.getAttribute("id");
    // Guard also asserts data-route-risk stays authored on every visible
    // offer — a served renderer regression that drops the attribute
    // should red this spec, not silently pass.
    const routeRisk = await offer.getAttribute("data-route-risk");
    expect(
      routeRisk,
      `#${id ?? "(unknown)"} must expose data-route-risk from computeOfferedJobs`,
    ).toMatch(/^(?:low|medium|high)$/);
    if (id) {
      ids.push(id);
    }
  }

  return ids.sort();
}

test.describe("AFTERSIGN M-LOOP memory divergence — played phone", () => {
  test("two different memory records offer different visible tappable jobs", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);
    await page.setViewportSize(PHONE_VIEWPORT);

    // FIRST-VISIT MEMORY (packet.delivered === false) — safe-default
    // branch of computeOfferedJobs. Fresh slot, no prior play.
    const firstVisitSlot = `m-loop-divergence-first-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${firstVisitSlot}`, {
      waitUntil: "load",
    });
    await waitForReady(page);
    const firstVisitOffers = await readVisibleOfferIds(page);
    expect(
      firstVisitOffers,
      "first-visit safe-default branch must render #job-offer-job-safe-delivery",
    ).toEqual(["job-offer-job-safe-delivery"]);

    // Drive one full loop so the slot's durable memory records
    // `priorOutcome === "completed"`. This is what makes the SECOND
    // pass a different memory record, not just a different visit.
    await page.locator("#job-offer-job-safe-delivery").click();
    await page.locator("#packetButton").click();
    await waitForBeat(page, "packet-choice");
    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "io-return-recognition");
    await tapReturnReason(page, "blunt");
    await waitForBeat(page, "return-tone-choice");
    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");
    await tapChoice(page, "deliver-packet");

    // LOOPED-RETURN MEMORY (priorOutcome === "completed") — completed
    // branch of computeOfferedJobs. Same slot, memory now non-empty.
    const loopedOffers = await readVisibleOfferIds(page);
    expect(
      loopedOffers,
      "completed-branch memory must render the completed-set offers",
    ).toEqual(
      [
        "job-offer-job-night-transfer",
        "job-offer-job-signed-receipt",
      ].sort(),
    );

    // The proof: two different memory records → different visible
    // action sets. This is the guard's canonical divergence signal.
    expect(
      loopedOffers,
      "memory must change the visible action set, not only dialogue",
    ).not.toEqual(firstVisitOffers);
  });
});
