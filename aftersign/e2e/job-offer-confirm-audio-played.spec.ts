import { expect, test, type Page } from "@playwright/test";

// PR #1790 (Soren's REQUEST_CHANGES) — played-not-driven proof that the
// frozen `JOB_OFFER_CONFIRM_AUDIO` row is actually consumed on a real
// tap of `#job-offer-<jobId>`.
//
// The first draft of this PR imported the module into `main.js` without
// wiring anything to schedule it — Soren rightly flagged the "consumer
// rule" gap: a data module that nothing plays is dead weight. The fix
// added `playJobOfferConfirm()` inside the `armJobOfferFeel(button,
// () => { ... })` click callback in `main.js`, mirroring the shape of
// `playKioskConfirm` / `playFailureStingAudio` — stamp the STORY-LEVEL
// cue on `state._runtime.audio.lastCue` BEFORE the AudioContext-unlock
// gate (so a headless CI harness whose autoplay policy leaves the
// AudioContext suspended can still assert the coupling), then schedule
// the 196Hz/120ms triangle burst on the same `audioContext` handle
// when unlocked.
//
// This spec is the played-input companion. It reaches the first-visit
// `packet-offered` beat, real-taps `#job-offer-job-safe-delivery`, and
// pins `_runtime.audio.lastCue === "job-offer-selected"` — the exact
// literal `JOB_OFFER_CONFIRM_AUDIO.cue` from `aftersign/src/jobOfferConfirmAudio.js`.
// Sibling shape: `packet-cancel-failure-audio-played.spec.ts` (installs
// an in-page rAF sampler to survive CDP round-trip races). We can be
// simpler here because the offer-tap synchronously stamps the cue on
// the click callback path — no rAF-scheduled visual envelope to sample.

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

test.describe("AFTERSIGN job-offer confirm audio — played cue coupling", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("a real tap on #job-offer-* stamps state._runtime.audio.lastCue to the frozen JOB_OFFER_CONFIRM_AUDIO.cue token", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `job-offer-confirm-audio-played-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    // First-visit packet-offered beat renders `#job-offer-job-safe-delivery`
    // (see sibling `job-offers-played.spec.ts` for the divergence contract).
    await waitForBeat(page, "packet-offered");
    const safeOffer = page.locator("#job-offer-job-safe-delivery");
    await expect(
      safeOffer,
      "safe-default offer button must be visible for the tap",
    ).toBeVisible({ timeout: WAIT_MS });

    // Prior audio cue (if any) — the click callback should overwrite it
    // to the JOB_OFFER_CONFIRM_AUDIO.cue token. We don't gate on the
    // prior value being any specific string; we only care that the
    // token flips to "job-offer-selected" AFTER the tap.
    const priorCue = await page.evaluate(
      () =>
        (window as unknown as {
          __game?: { _runtime?: { audio?: { lastCue?: string } } };
        }).__game?._runtime?.audio?.lastCue ?? null,
    );

    // Real player-input gesture — satisfies the played-input guard
    // (playtest-input-surface-guard.spec.ts) which looks for
    // `.click/.tap/.press/.mouse.click/.touchscreen.tap` matches.
    await safeOffer.tap();

    // The click callback in main.js calls `void playJobOfferConfirm()`
    // synchronously, which stamps `state._runtime.audio.lastCue` to
    // the frozen token BEFORE awaiting `enableAudio()` — so the write
    // is observable on the very next microtask, even in headless CI
    // where the AudioContext never actually unlocks. Poll defensively.
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (window as unknown as {
                __game?: { _runtime?: { audio?: { lastCue?: string } } };
              }).__game?._runtime?.audio?.lastCue ?? null,
          ),
        {
          timeout: WAIT_MS,
          message:
            "audio.lastCue should flip to the JOB_OFFER_CONFIRM_AUDIO.cue token on a real offer tap",
        },
      )
      .toBe("job-offer-selected");

    // And `lastCueAt` should be a numeric timestamp — that's the same
    // stamp shape the sibling `playKioskConfirm` / `playFailureStingAudio`
    // paths use, so the harness can measure audio-visual coupling.
    const lastCueAt = await page.evaluate(
      () =>
        (window as unknown as {
          __game?: { _runtime?: { audio?: { lastCueAt?: number } } };
        }).__game?._runtime?.audio?.lastCueAt ?? null,
    );
    expect(
      typeof lastCueAt,
      "audio.lastCueAt should be a numeric performance.now() timestamp after the tap",
    ).toBe("number");

    // Sanity: the prior cue is either null or a different token from
    // the one under test — protects against a stale "job-offer-selected"
    // survivor from an unrelated boot path.
    expect(
      priorCue,
      "the JOB_OFFER_CONFIRM_AUDIO token must not have been the prior cue — otherwise this spec proves nothing",
    ).not.toBe("job-offer-selected");
  });
});
