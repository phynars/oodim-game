import { test, expect, type Page } from "@playwright/test";

// AFTERSIGN io-continue-beats tap-driven playtest (#1234; supersedes
// the single-tone PR #1236 spec).
//
// Proves the SHIPPED page speaks Io's THREE distinct authored replies
// at the return-tone fork — verbatim from the flagship script
// (docs/flagship/vertical-slice-script.md §8) — and that the chosen
// tone survives a reload in the durable save.
//
// Played, not driven (BRIEF 2026-08-15): every run reaches the fork by
// visible-DOM taps only. `window.__game` reads appear exclusively in
// ASSERTIONS (the persisted-tone check and the save-proof poll) —
// never to drive input.
//
// Coverage:
//   1. THREE fresh-save runs, one per tone button (kind / evasive /
//      blunt). Each asserts `#line` shows THAT tone's verbatim script
//      reply at `return-tone-choice` — three DIFFERENT texts, so a
//      regression that collapses the fork to one reply reds all but
//      one run.
//   2. The blunt run continues to `io-next-job` and asserts the
//      invariant HANDOFF line is contained in `#line` (preserves the
//      PR #1236 consumer coverage).
//   3. A reload run: choose "kind", wait for the durable write
//      (choose-return-tone now forceSave()s — #1234), reload the same
//      slot, and assert the restored save snapshot carries
//      `player.returnReason === "kind"`.

const SPEC_TIMEOUT_MS = 120_000;
const WAIT_MS = 60_000;

// Verbatim copies of the authored lines under test. Kept as literals
// here (rather than imported from
// apps/web/src/aftersign/story/ioContinueBeats.ts) so a rewrite of the
// module strings that forgets the script turns this surface RED — the
// whole point of a consumer test is to pin the shipped words.
const REPLY_BY_TONE = {
  kind: "Careful. Say that too often and people will start handing you breakable things.",
  evasive: "Work is a clean word. We can use it until it stains.",
  blunt: "Good. Wanting is easier to route than pretending.",
} as const;

type Tone = keyof typeof REPLY_BY_TONE;

const TONES: readonly Tone[] = ["kind", "evasive", "blunt"];

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

async function tapReturnReason(page: Page, reason: Tone): Promise<void> {
  const button = page
    .locator(`button[data-return-reason="${reason}"]:not([disabled])`)
    .first();
  await expect(
    button,
    `recognition beat should expose the "${reason}" tone button`,
  ).toBeVisible({ timeout: WAIT_MS });
  await button.click();
}

// Boot a FRESH save on `slot` and tap (visible DOM only) up to the
// return-tone fork: packet gesture → second action → deliver →
// auto-advance into io-return-recognition.
async function playToToneFork(page: Page, slot: string): Promise<void> {
  await page.goto(`?slot=${slot}`, { waitUntil: "load" });
  await waitForBeat(page, "packet-offered");

  await page.locator("#packetButton").click();
  await waitForBeat(page, "packet-choice");

  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-delivered");

  // Auto-advance to recognition (~1180ms setTimeout in deliverPacket()).
  await waitForBeat(page, "io-return-recognition");
}

test.describe("AFTERSIGN return-tone fork: three authored replies, tone persisted (#1234)", () => {
  for (const tone of TONES) {
    test(`tapping the "${tone}" return renders its verbatim script reply`, async ({ page }) => {
      test.setTimeout(SPEC_TIMEOUT_MS);

      await playToToneFork(page, `io-continue-${tone}-${Date.now()}`);
      await tapReturnReason(page, tone);

      await waitForBeat(page, "return-tone-choice");
      // Equal (not contained): the return-tone-choice branch of
      // `lineForBeat()` returns exactly the reply string from
      // `buildIoContinueBeats(tone)[0].line`.
      const lineNode = page.locator("#line");
      await expect(lineNode).toHaveText(REPLY_BY_TONE[tone], {
        timeout: WAIT_MS,
      });

      if (tone === "blunt") {
        // Preserve the PR #1236 handoff coverage on one run: advance
        // to io-next-job and assert the invariant HANDOFF line is
        // CONTAINED in `#line` (PR #1228 may prepend memory-reflection
        // text, so containment — not equality).
        await tapChoice(page, "ask-for-next-job");
        await waitForBeat(page, "io-next-job");
        await expect(lineNode).toContainText(HANDOFF_LINE, {
          timeout: WAIT_MS,
        });
      }
    });
  }

  test("the chosen tone survives a reload in the durable save", async ({ page }) => {
    test.setTimeout(SPEC_TIMEOUT_MS);

    const slot = `io-continue-reload-${Date.now()}`;
    await playToToneFork(page, slot);
    await tapReturnReason(page, "kind");

    await waitForBeat(page, "return-tone-choice");
    await expect(page.locator("#line")).toHaveText(REPLY_BY_TONE.kind, {
      timeout: WAIT_MS,
    });

    // The tone tap triggers an async forceSave() (#1234). Wait for the
    // durable write to land before reloading: forceSave stamps
    // save.lastLoadProof.source, which is null on this fresh run until
    // the write completes. ASSERT-only window.__game read.
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (window as unknown as {
                __game?: { save?: { lastLoadProof?: { source: string | null } } };
              }).__game?.save?.lastLoadProof?.source ?? null,
          ),
        { timeout: WAIT_MS },
      )
      .not.toBeNull();

    // Reload the SAME slot (the query string survives page.reload) and
    // assert the restored save snapshot carries the persisted tone.
    await page.reload({ waitUntil: "load" });
    await waitForBeat(page, "return-tone-choice");

    const persistedTone = await page.evaluate(
      () =>
        (window as unknown as {
          __game?: { player?: { returnReason?: string | null } };
        }).__game?.player?.returnReason ?? null,
    );
    expect(persistedTone).toBe("kind");
  });
});
