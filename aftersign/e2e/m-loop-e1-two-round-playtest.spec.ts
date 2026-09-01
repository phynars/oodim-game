import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN M-LOOP-E1 — two-round phone playtest (#1552).
//
// One boot-to-last-beat journey that plays round 1, returns to Io, and
// asserts round 2 offers a DIFFERENT visible action set — driven only
// by taps on real player affordances (no `window.__game.input.*`).
//
// This spec sits alongside:
//   - `job-offers-played.spec.ts` (the divergence CONTRACT on the
//     `#job-offer-*` served surface — first visit vs looped return)
//   - `m-loop-divergence.playtest.spec.ts` (the element-level
//     `data-offer-fingerprint` divergence proof)
// and stitches their two beats into ONE end-to-end journey so the
// milestone can be answered yes/no by a single Playwright run.
//
// Selector vocabulary — the same used across sibling specs:
//   - `[data-beat-id="<beat>"]` for beat gates.
//   - `#job-offer-<jobId>` for served offer buttons.
//   - `button[data-choice-id="<choice>"]` for beat choices.
//   - `button[data-return-reason="<tone>"]` for the return-tone beat.
// The regex/getByText fallback used in an earlier draft is rejected —
// #1552 requires per-beat assertions on the shipped affordances, not
// keyword oracles on `body.innerText`.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 10_000;
const COLD_START_MS = 45_000;

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

async function visibleOfferIds(page: Page): Promise<string[]> {
  return page.locator('[id^="job-offer-"]').evaluateAll((nodes) =>
    nodes
      .filter((node) => {
        const element = node instanceof HTMLElement ? node : null;
        return Boolean(element && element.offsetParent !== null);
      })
      .map((node) => node.id)
      .sort(),
  );
}

test.describe("M-LOOP-E1 two-round phone playtest", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("boots, completes round one, returns, and sees round two offer a different visible action set", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    // Fresh slot — "?slot=<unique>" is what makes round 1 a true first
    // visit (packet.delivered === false) and round 2 a true looped
    // return on the SAME memory record (priorOutcome === "completed").
    // Without it, the two rounds could straddle whatever slot the
    // durable store happened to have, breaking the divergence proof.
    await page.goto(`/aftersign/?slot=m-loop-e1-two-round-${Date.now()}`, {
      waitUntil: "load",
    });
    await waitForReady(page);

    // ── ROUND 1 ── first-visit safe-default branch ────────────────────
    await waitForBeat(page, "packet-offered");
    const firstRoundOfferIds = await visibleOfferIds(page);
    expect(
      firstRoundOfferIds,
      "first visit must render the safe-default offer only",
    ).toEqual(["job-offer-job-safe-delivery"]);
    await expect(page.locator("#job-offer-job-safe-delivery")).toHaveText(
      "Safe delivery · low risk",
    );
    await page.locator("#job-offer-job-safe-delivery").tap();

    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");
    await expect(
      page.locator('[id^="job-offer-"]'),
      "job offers must clear while the player is inside the delivery beat",
    ).toHaveCount(0, { timeout: WAIT_MS });

    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");

    await waitForBeat(page, "io-return-recognition");
    await expect(
      page.getByText(/I remember you.*blue seal.*unbroken/i),
      "Io's recognition line must render on the looped return",
    ).toBeVisible({ timeout: WAIT_MS });
    await tapReturnReason(page, "blunt");

    await waitForBeat(page, "return-tone-choice");
    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");
    await tapChoice(page, "deliver-packet");

    // ── ROUND 2 ── looped-return completed branch ─────────────────────
    await waitForBeat(page, "packet-offered");
    const secondRoundOfferIds = await visibleOfferIds(page);
    expect(
      secondRoundOfferIds,
      "looped return must render the completed-set offers",
    ).toEqual(
      ["job-offer-job-night-transfer", "job-offer-job-signed-receipt"].sort(),
    );

    // The M-LOOP-E1 divergence proof — round 2 must offer a different
    // visible action set than round 1. Comparing sorted id ARRAYS (not
    // innerText) keeps the proof stable against copy edits and drops
    // to the shipped affordance vocabulary.
    expect(
      secondRoundOfferIds,
      "memory must change the visible action set, not only dialogue",
    ).not.toEqual(firstRoundOfferIds);

    await expect(page.locator("#job-offer-job-night-transfer")).toHaveText(
      "Night transfer · medium risk",
    );
    await expect(page.locator("#job-offer-job-signed-receipt")).toHaveText(
      "Signed receipt · low risk",
    );

    // Replacement proof — the safe-default offer must be GONE on the
    // looped return, not merely joined by extras. `toHaveCount(0)` is
    // what makes this a real divergence rather than a superset.
    await expect(
      page.locator("#job-offer-job-safe-delivery"),
      "safe-default offer must not persist onto the looped return — the completed set REPLACES it",
    ).toHaveCount(0);
  });
});
