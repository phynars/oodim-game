import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN #1551 — M-LOOP-E1: the served offer's route + risk copy
// must be VISIBLE and must DIVERGE between the first run and the
// looped return — proven by real taps on the shipped page, not by a
// harness snapshot.
//
// Soren's REQUEST_CHANGES on PR #1555: the only divergence proof was
// the vitest consumer test reading
// `getSnapshot().story.nextJob?.offer?.copy` — a harness-side object,
// not the DOM a player reads. This spec closes that gap:
//
//   FIRST VISIT (no delivery-outcome fact in Io's memory)
//     `chooseAftersignJobOfferCopy({})` → firstRun branch →
//     the `<p data-aftersign-job-offer-route-risk>` inside
//     `#offeredJobs` renders the firstRun route/risk copy verbatim
//     (see aftersign/main.js renderText(), packet-offered beat).
//
//   LOOPED RETURN (delivery-outcome fact `object === "sealed"` after
//   playing one full loop with the packet kept sealed)
//     `chooseAftersignJobOfferCopy({ firstPacketOutcome: "sealed",
//     deliveredSealed: true })` → trusted branch → the same visible
//     `<p>` now renders the trusted route/risk copy verbatim.
//
// Both runs are produced BY PLAY on one slot — same discipline as the
// sibling `job-offers-played.spec.ts` (whose tap script this reuses):
// no localStorage seeding, no `window.__game` state mutation. The
// only `window.__game` read is the scene-ready gate.
//
// Copy strings are the verbatim authored branches from
// `apps/web/src/aftersign/aftersignJobOfferCopy.js` (preserved in
// `apps/web/src/aftersign/HANDOFF-1535.md`) — asserted via getByText
// so a player-visible drift on either branch reds this spec.

const WAIT_MS = 10_000;
const COLD_START_MS = 45_000;
const PHONE_VIEWPORT = { width: 375, height: 812 } as const;

// Verbatim from AFTERSIGN_JOB_OFFER_COPY (HANDOFF-1535.md).
const FIRST_RUN_COPY =
  "Route: Take the lit stair. Do not stop under the bell rope. "
  + "Risk: Low risk. Long route. Io can see most of it from the kiosk.";
const TRUSTED_COPY =
  "Route: Cross behind the shuttered pharmacy before the bells count twice. "
  + "Risk: Short route. Unlit. Better pay because Io trusts your hands.";

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

test.describe("AFTERSIGN job-offer route/risk copy — played divergence (#1551)", () => {
  test("first visit shows the firstRun route/risk copy; the looped return shows the trusted copy", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);
    await page.setViewportSize(PHONE_VIEWPORT);

    const slot = `job-offer-route-risk-copy-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    // FIRST VISIT — packet-offered beat, no delivery-outcome memory
    // fact yet → firstRun branch. The copy paragraph must be VISIBLE
    // (readable on a 375×812 viewport) and carry the verbatim
    // firstRun route/risk strings.
    await waitForBeat(page, "packet-offered");
    const routeRiskCopy = page.locator(
      "#offeredJobs [data-aftersign-job-offer-route-risk]",
    );
    await expect(
      routeRiskCopy,
      "route/risk copy paragraph must render inside the served #offeredJobs tray",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(
      page.getByText(FIRST_RUN_COPY, { exact: true }),
      "first-visit offer must speak the firstRun route/risk copy verbatim",
    ).toBeVisible({ timeout: WAIT_MS });
    const firstRunVisibleCopy = (await routeRiskCopy.textContent()) ?? "";

    // Play one full loop, keeping the packet SEALED (the default —
    // a plain packet tap commits SEALED via the hold gesture; the
    // canonical tap script below never opens it), so the durable
    // delivery-outcome fact lands with `object === "sealed"` and the
    // looped return resolves the TRUSTED copy branch. Tap script
    // mirrors `job-offers-played.spec.ts` line for line.
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

    // LOOPED RETURN — back at packet-offered with a sealed
    // delivery-outcome fact in Io's memory → trusted branch. The
    // SAME visible paragraph must now carry the trusted copy, and it
    // must differ from what the first run showed.
    await waitForBeat(page, "packet-offered");
    await expect(
      routeRiskCopy,
      "route/risk copy paragraph must still render at the looped packet-offered",
    ).toBeVisible({ timeout: WAIT_MS });
    await expect(
      page.getByText(TRUSTED_COPY, { exact: true }),
      "looped-return offer must speak the trusted route/risk copy verbatim",
    ).toBeVisible({ timeout: WAIT_MS });
    const loopedVisibleCopy = (await routeRiskCopy.textContent()) ?? "";

    // The divergence proof a player can SEE: the visible route/risk
    // text on the looped return is not the text from the first run.
    expect(
      loopedVisibleCopy,
      "visible route/risk copy must diverge between first and looped runs",
    ).not.toBe(firstRunVisibleCopy);
    expect(firstRunVisibleCopy).toBe(FIRST_RUN_COPY);
    expect(loopedVisibleCopy).toBe(TRUSTED_COPY);

    // The firstRun copy must NOT linger anywhere on the looped page —
    // divergence means replacement, not accumulation.
    await expect(
      page.getByText(FIRST_RUN_COPY, { exact: true }),
      "firstRun route/risk copy must NOT render on the looped return",
    ).toHaveCount(0);
  });
});
