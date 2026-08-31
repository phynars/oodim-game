import { expect, test, type Page } from "@playwright/test";

// M-LOOP-E1 — two-round phone playtest.
//
// Stitches the two existing divergence proofs
// (`m-loop-e1-phone-action-divergence.spec.ts` and
// `job-offers-played.spec.ts`) into ONE boot-to-last-beat two-round
// journey: boot at `packet-offered`, complete round 1 through the full
// beat chain, and assert that the round-2 `packet-offered` re-render
// exposes a VISIBLY different action set than round 1 did.
//
// The played contract:
//   - Phone viewport, real taps only.
//   - Every visible beat transition is asserted, not just the endpoints.
//   - Divergence assertion is `not.toEqual` on the visible `#job-offer-*`
//     id set snapshotted at each round's `packet-offered` beat.
//   - `window.__game` is read as an assertion surface only — never
//     `window.__game.input.*`.
//
// The runtime beat chain from round-1 `packet-offered` to round-2
// `packet-offered` (documented in `job-offers-played.spec.ts`):
//   packet-offered → #packetButton → packet-choice →
//   choice[acknowledge-kiosk] → choice[deliver-packet] →
//   io-return-recognition → return-reason[blunt] →
//   return-tone-choice → choice[ask-for-next-job] → io-next-job →
//   choice[deliver-packet] → packet-offered (round 2)
//
// Round-1 offer set: `[#job-offer-job-safe-delivery]` (safe default,
// `packet.delivered === false`). Round-2 offer set: the completed-set
// pair `[#job-offer-job-night-transfer, #job-offer-job-signed-receipt]`
// (`packet.delivered === true` after one loop). The two id sets are
// disjoint — a `not.toEqual` on the sorted arrays is the divergence
// proof asked for by the M-LOOP-E1 acceptance.

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;
const COLD_START_MS = 30_000;

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
  await choice.tap();
}

async function tapReturnReason(page: Page, reason: string): Promise<void> {
  const button = page
    .locator(`button[data-return-reason="${reason}"]:not([disabled])`)
    .first();
  await expect(
    button,
    `return-tone "${reason}" should be visible and tappable`,
  ).toBeVisible({ timeout: WAIT_MS });
  await button.tap();
}

async function snapshotOfferedIds(page: Page): Promise<string[]> {
  const offers = page.locator('[id^="job-offer-"]');
  await expect(
    offers.first(),
    "packet-offered beat should render at least one #job-offer-* button",
  ).toBeVisible({ timeout: WAIT_MS });
  const ids = await offers.evaluateAll((nodes) =>
    nodes.map((node) => node.id).filter((id): id is string => Boolean(id)),
  );
  return ids.slice().sort();
}

test.describe("M-LOOP-E1 two-round played phone loop", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("boots, completes round one, returns, and offers a visibly different action set in round two by taps only", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    // Unique slot per run so a leaked mid-story save from a sibling
    // spec cannot make `packet.delivered` true at boot and turn the
    // safe-default branch into the completed set — that would collapse
    // the divergence assertion into a false positive/negative.
    const slot = `m-loop-e1-two-round-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    // ROUND 1 — first-visit `packet-offered`. `computeOfferedJobs(undefined)`
    // returns the safe default `[SAFE_DEFAULT_JOB_ID]`, so the only
    // `#job-offer-*` button rendered is `#job-offer-job-safe-delivery`.
    await waitForBeat(page, "packet-offered");
    const roundOneOffers = await snapshotOfferedIds(page);
    expect(
      roundOneOffers,
      "round-1 packet-offered should render exactly the safe-default offer",
    ).toEqual(["job-offer-job-safe-delivery"]);

    // Tap the safe-default offer, then the round-1 packet button. Each
    // visible transition is asserted so a regression that skips a beat
    // reds this spec on the missing `data-beat-id`.
    await page.locator("#job-offer-job-safe-delivery").tap();
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");
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

    // ROUND 2 — looped-return `packet-offered`. Wait for the beat to
    // re-fire BEFORE snapshotting so we compare against a genuinely
    // re-rendered offer set, never a stale round-1 DOM. With
    // `packet.delivered === true` and `priorOutcome === "completed"`,
    // `computeOfferedJobs` returns the completed-set pair.
    await waitForBeat(page, "packet-offered");
    await expect(
      page.locator("#job-offer-job-night-transfer"),
      "round-2 packet-offered should render the completed-set night-transfer offer",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(
      page.locator("#job-offer-job-signed-receipt"),
      "round-2 packet-offered should render the completed-set signed-receipt offer",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(
      page.locator("#job-offer-job-safe-delivery"),
      "safe-default offer must NOT render at the looped packet-offered — the completed set replaces it",
    ).toHaveCount(0);

    const roundTwoOffers = await snapshotOfferedIds(page);
    expect(
      roundTwoOffers,
      "round-2 completed-set offers should differ from the round-1 safe-default snapshot",
    ).not.toEqual(roundOneOffers);
    expect(
      roundTwoOffers,
      "round-2 should render exactly the completed-set pair",
    ).toEqual([
      "job-offer-job-night-transfer",
      "job-offer-job-signed-receipt",
    ]);

    // window.__game is an ASSERTION surface only — never driven. Mirror-
    // check the played divergence against the harness snapshot on the
    // RIGHT axis: the offer branch in `aftersign/main.js:1811` gates on
    // `state.npcs.io.memory.length > 0`, not on `state.packet.delivered`
    // (which is reset to `false` per packet at `main.js:2285/2544` and
    // is therefore `false` again at round-2 `packet-offered`). After one
    // completed loop, Io has accumulated the delivery-outcome +
    // second-action facts, so `memory.length` is > 0 — that is what
    // makes `computeOfferedJobs` pick the completed-set pair.
    const readOnly = await page.evaluate(() => {
      const game = (
        window as unknown as {
          __game?: {
            scene?: { ready?: boolean };
            getSnapshot?: () => {
              npcs?: { io?: { memory?: readonly unknown[] } };
            };
          };
        }
      ).__game;
      if (!game) return null;
      const snap = game.getSnapshot?.();
      const memory = snap?.npcs?.io?.memory;
      return {
        ready: game.scene?.ready === true,
        ioMemoryLength: Array.isArray(memory) ? memory.length : null,
      };
    });
    expect(readOnly, "window.__game must expose a read-only assertion surface").not.toBeNull();
    expect(readOnly!.ready).toBe(true);
    expect(
      readOnly!.ioMemoryLength,
      "round-2 offer divergence is driven by state.npcs.io.memory.length > 0 (main.js:1811) — after one completed loop Io holds >=1 durable memory fact",
    ).toBeGreaterThan(0);
  });
});
