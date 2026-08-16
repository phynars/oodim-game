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
// CI flake note (Soren review, PR #1238): the aftersign lane runs at
// retries: 3 (aftersign/playwright.config.ts) and can crash BEFORE any
// spec runs on a SwiftShader webServer-boot hiccup — the failure
// signature is `playwright-report/results.json not found` posted by
// ci.yml's summary step. That failure mode is orthogonal to this spec;
// diagnose from the raw runner log tail (whose stack frames name the
// crashing file), not from this spec's line numbers.
//
// Cold-start budget: this file drives THREE tests, not four. The
// reload assertion (Soren PR #1238) is folded into the "kind" tone
// test so we pay one boot for both proofs — every extra top-level
// test in this lane pays another vite-preview + SwiftShader boot,
// and iteration 5 kept the aftersign job red on that surface.
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
//   3. The "kind" run also reloads the same slot after the durable
//      write (choose-return-tone now forceSave()s — #1234) and
//      asserts BOTH `player.returnReason === "kind"` on the restored
//      snapshot AND that `#line` still carries the kind tone's
//      verbatim reply — without that #line check the guard-skip in
//      `armReturningSessionBootLine` (Soren PR #1238 review) has no
//      served-page proof.

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

      const slot = `io-continue-${tone}-${Date.now()}`;
      await playToToneFork(page, slot);
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

      if (tone === "kind") {
        // Soren PR #1238 review — durable-save proof, folded into the
        // "kind" run so it shares this test's cold-start (see file
        // header). The tone tap triggered an async forceSave() (#1234);
        // wait for it to land, reload the SAME slot, then assert BOTH
        // (a) the restored snapshot carries the persisted tone, AND
        // (b) `#line` still speaks the kind tone's verbatim reply
        // (without that check the persisted-tone assertion passes even
        // when the #957 boot override clobbers `#line` with the
        // returning-recognition copy — the guard-skip in
        // `armReturningSessionBootLine` is exactly what keeps (b)
        // true).
        //
        // ASSERT-only `window.__game` reads (BRIEF 2026-08-15):
        // forceSave stamps `save.lastLoadProof.source`, null on the
        // fresh session until the authoritative write completes.
        await expect
          .poll(
            () =>
              page.evaluate(
                () =>
                  (window as unknown as {
                    __game?: {
                      save?: { lastLoadProof?: { source: string | null } };
                    };
                  }).__game?.save?.lastLoadProof?.source ?? null,
              ),
            { timeout: WAIT_MS },
          )
          .not.toBeNull();

        // Reload the SAME slot — the query string survives page.reload
        // — and assert both proofs.
        await page.reload({ waitUntil: "load" });
        await waitForBeat(page, "return-tone-choice");

        const persistedTone = await page.evaluate(
          () =>
            (window as unknown as {
              __game?: { player?: { returnReason?: string | null } };
            }).__game?.player?.returnReason ?? null,
        );
        expect(persistedTone).toBe("kind");

        await expect(lineNode).toHaveText(REPLY_BY_TONE.kind, {
          timeout: WAIT_MS,
        });
      }
    });
  }
});
