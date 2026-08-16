import { test, expect, type Page } from "@playwright/test";

// AFTERSIGN io-continue-beats tap-driven playtest (PR #1236).
//
// Proves the SHIPPED consumer of `ioContinueBeats.ts` is
// `aftersign/main.js::lineForBeat()`, not the vitest harness. The spec
// plays boot → `io-next-job` using only visible-DOM taps (no
// `window.__game.input.*` calls), then asserts that at each of the two
// visible beats Io speaks the exact lines returned by
// `buildIoContinueBeats(reason)`:
//
//   1. At `return-tone-choice` — the REPLY line for the tone the player
//      tapped ("blunt" here, via the "Blunt return" recognition
//      button). Pinned string:
//        "Correct. I am paying in useful work, which is the only coin
//         left tonight."
//      (matches `IO_RETURN_TONE_OPTIONS.find(o => o.id === "blunt").reply`
//       in apps/web/src/aftersign/story/ioContinueBeats.ts).
//
//   2. At `io-next-job` — the HANDOFF line. Pinned string:
//        "Take the red tag to Saint Orra. If the pharmacy sign calls
//         you by the wrong name, answer once and only once."
//      (matches `IO_NEXT_JOB_HANDOFF.line` in the same module.)
//      The `#line` node may PREPEND memory-reflection text from
//      `ioMemoryResponseLinesFor(...)` (PR #1228 wiring) — we assert
//      the handoff line is CONTAINED in `#line`, not equal to it.
//
// Root-cause of the review that produced this spec: the earlier draft
// of #1236 wired `ioContinueBeats.ts` only into `bootWindowGame.ts`,
// which is the vitest harness — `main.js` never imported the module,
// so the served page never spoke the reply/handoff. Grepping
// `getIoContinueBeats|buildIoContinueBeats` under `aftersign/main.js`
// returned zero. This spec is the served-page proof that the fix
// landed: the shipped `#line` DOM node now shows the module's strings.

const SPEC_TIMEOUT_MS = 120_000;
const WAIT_MS = 60_000;

// Verbatim copies of the two lines under test. Kept as literals here
// (rather than imported) so a rewrite of the module strings that
// forgets to update this spec turns the surface RED — the whole point
// of a consumer test is to pin the shipped words.
const BLUNT_REPLY_LINE =
  "Correct. I am paying in useful work, which is the only coin left tonight.";
const HANDOFF_LINE =
  "Take the red tag to Saint Orra. If the pharmacy sign calls you by the wrong name, answer once and only once.";

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(
    page.locator(`[data-beat-id="${beatId}"]`),
    `story line should reach beat "${beatId}"`,
  ).toBeVisible({ timeout: WAIT_MS });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page
    .locator(`button[data-choice-id="${choiceId}"]:not([disabled])`)
    .first();
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.click();
}

async function tapReturnReason(
  page: Page,
  reason: "kind" | "evasive" | "blunt",
): Promise<void> {
  const button = page
    .locator(`button[data-return-reason="${reason}"]:not([disabled])`)
    .first();
  await expect(
    button,
    `recognition beat should expose the "${reason}" tone button`,
  ).toBeVisible({ timeout: WAIT_MS });
  await button.click();
}

test.describe("AFTERSIGN io-continue-beats: shipped consumer of ioContinueBeats.ts", () => {
  test("tapping Blunt return renders the module's REPLY line, then HANDOFF line, into #line", async ({ page }) => {
    test.setTimeout(SPEC_TIMEOUT_MS);

    await page.goto(`?slot=io-continue-tap-${Date.now()}`, { waitUntil: "load" });

    // Boot beat — the DOM bridge stamps `[data-beat-id]` on `#line` as
    // soon as the module's first renderText() runs.
    await waitForBeat(page, "packet-offered");

    // Commit the packet gesture (tap = preserve seal → packet-choice).
    await page.locator("#packetButton").click();
    await waitForBeat(page, "packet-choice");

    // Second deliberate action + deliver.
    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "packet-delivered");

    // Auto-advance to recognition (~1180ms setTimeout in deliverPacket()).
    await waitForBeat(page, "io-return-recognition");

    // Tap the BLUNT tone button — its `data-return-reason="blunt"`
    // stamp is what `main.js` reads to store
    // `state.player.returnReason = "blunt"`. That's the token
    // `lineForBeat()` then feeds to `buildIoContinueBeats("blunt")`
    // at the next two beats.
    await tapReturnReason(page, "blunt");

    await waitForBeat(page, "return-tone-choice");
    // Acceptance criterion (1): Io's REPLY line for the "blunt" posture
    // is what `#line` shows at this beat — sourced from
    // `story/ioContinueBeats.ts::IO_RETURN_TONE_OPTIONS`, not from an
    // inline main.js string. Equal (not contained) — the return-tone-choice
    // branch of `lineForBeat()` returns exactly this string.
    const lineNode = page.locator("#line");
    await expect(lineNode).toHaveText(BLUNT_REPLY_LINE, { timeout: WAIT_MS });

    // Advance to io-next-job.
    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");

    // Acceptance criterion (2): the HANDOFF line is CONTAINED in
    // `#line`. Contained (not equal) because PR #1228 prepends
    // `ioMemoryResponseLinesFor(...)` reflections — the handoff line
    // is the trailing sentence, but the leading memory reflection
    // makes the full string longer than the handoff alone.
    await expect(lineNode).toContainText(HANDOFF_LINE, { timeout: WAIT_MS });
  });
});
