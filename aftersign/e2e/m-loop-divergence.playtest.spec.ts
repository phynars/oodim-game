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

type VisibleOfferReadout = {
  readonly ids: readonly string[];
  readonly fingerprints: readonly string[];
};

async function readVisibleOffers(page: Page): Promise<VisibleOfferReadout> {
  // #job-offer-<jobId> is the shipped render surface. Reading the ids
  // (not the composite label text) keeps the divergence assertion
  // stable if a copy edit renames a label without shifting the
  // memory-branch outcome.
  //
  // #1568 (this file's element-level assertion): each visible offer
  // button ALSO carries `data-offer-fingerprint="<id>#<risk>"` — the
  // composite semantic key `fingerprintJobOfferAction` produces
  // (packages/aftersign/src/jobOfferActionFingerprint.ts). We read it
  // straight off the DOM so the divergence proof lands element-level,
  // not text-level (2026-08-22 M-LOOP amendment: dialogue-only diffs
  // score zero) and without any `window.__game.getSnapshot()`
  // divergence read.
  await waitForBeat(page, "packet-offered");
  const offers = page.locator('[id^="job-offer-"]');
  await expect(
    offers.first(),
    "at least one #job-offer-* button must render at packet-offered",
  ).toBeVisible({ timeout: WAIT_MS });

  const count = await offers.count();
  const ids: string[] = [];
  const fingerprints: string[] = [];
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
    // #1568 — the M-LOOP fingerprint MUST land on the button the
    // player taps. Shape is `<jobId>#<risk>` (see
    // fingerprintJobOfferAction). A served-renderer regression that
    // drops this attribute reds the spec at THIS assertion, before
    // the divergence proof below.
    const fingerprint = await offer.getAttribute("data-offer-fingerprint");
    expect(
      fingerprint,
      `#${id ?? "(unknown)"} must expose data-offer-fingerprint (semanticKey <id>#<risk>) from fingerprintJobOfferAction`,
    ).toMatch(/^[a-z0-9-]+#(?:low|medium|high)$/);
    if (id) {
      ids.push(id);
    }
    if (fingerprint) {
      fingerprints.push(fingerprint);
    }
  }

  return {
    ids: ids.slice().sort(),
    fingerprints: fingerprints.slice().sort(),
  };
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
    const firstVisit = await readVisibleOffers(page);
    expect(
      firstVisit.ids,
      "first-visit safe-default branch must render #job-offer-job-safe-delivery",
    ).toEqual(["job-offer-job-safe-delivery"]);
    // #1568 — safe-default branch offers the low-risk safe-delivery
    // job, so the fingerprint set is the singleton `job-safe-delivery#low`.
    // Reading it here pins the format contract before the divergence
    // check compares SETS across memory records.
    expect(
      new Set(firstVisit.fingerprints),
      "first-visit fingerprint set must match the safe-default branch",
    ).toEqual(new Set(["job-safe-delivery#low"]));

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
    const looped = await readVisibleOffers(page);
    expect(
      looped.ids,
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
      looped.ids,
      "memory must change the visible action set, not only dialogue",
    ).not.toEqual(firstVisit.ids);

    // #1568 — element-level M-LOOP divergence proof read straight off
    // the DOM. `data-offer-fingerprint` is `<jobId>#<risk>` — no label
    // copy in the key, so a dialogue-only edit does NOT falsely count
    // as divergence, and a risk-tier reshuffle of the same ids DOES.
    // Comparing the fingerprintsSeen SETS (not the arrays) makes the
    // proof order-independent — same shape the sibling package
    // predicate `ioJobOffersDiverge` and the served-surface consumer
    // test `jobOfferActionFingerprint.consumer.test.ts` use.
    const fingerprintsSeenA = new Set(firstVisit.fingerprints);
    const fingerprintsSeenB = new Set(looped.fingerprints);
    expect(
      fingerprintsSeenB,
      "completed-branch memory must publish the completed-set fingerprint keys",
    ).toEqual(
      new Set([
        "job-night-transfer#medium",
        "job-signed-receipt#low",
      ]),
    );
    expect(
      fingerprintsSeenA,
      "two divergent memory records must produce different data-offer-fingerprint sets (element-level, not text-level)",
    ).not.toEqual(fingerprintsSeenB);
  });
});
