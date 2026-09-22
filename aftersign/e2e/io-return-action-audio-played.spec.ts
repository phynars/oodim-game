import { expect, test, type Page } from "@playwright/test";

// PR #1885 (Soren's REQUEST_CHANGES) — played-not-driven proof that the
// `attachIoReturnActionFeedback` press envelope + coupled cue actually
// fire on a REAL tap of one of the three Io return-action buttons
// (`#acknowledgeRouteButton` / `#skipRouteButton` / `#deliverButton`)
// at the `io-return-recognition` beat.
//
// The first draft of this PR only tested the module by dispatching
// `new Event("pointerdown")` on a detached `document.createElement`
// button — synthetic input, never the real tap boundary. Soren rightly
// flagged the AI001 gap (mock-only verification): the repo's own bar
// for the `state._runtime.audio.lastCue` contract is a real-tap e2e
// (see sibling `job-offer-confirm-audio-played.spec.ts`). This spec
// meets that bar.
//
// REACHABILITY — copied from `m-continue-phone-tap-playtest.spec.ts`:
// boot lands on `packet-offered`, one `#deliverButton` tap advances to
// `io-return-recognition` where all three return-action buttons flip
// to the tone options and receive the tactile feedback wiring
// (aftersign/main.js re-render loop, `attachIoReturnActionFeedback`
// installed for each button, cleaning up prior listeners first).
//
// PROOF SHAPE — two pinned invariants at the real tap boundary:
//   1. `button.dataset.ioReturnActionFeedback === "released"` after
//      `pointerup` (the press envelope actually reached the shipped
//      DOM element, not a detached one).
//   2. `state._runtime.audio.lastCue === "io-return-action"` after the
//      28ms coupling delay (`IO_RETURN_ACTION_FEEL.couplingDelayMs`) —
//      this is the exact contract `job-offer-confirm-audio-played.spec.ts`
//      established for the `_runtime.audio.lastCue` slot.
//
// The audio callback stamps `lastCue` inside a `setTimeout(...,
// couplingDelayMs)`, so we use `expect.poll` — same defensive polling
// shape the sibling job-offer spec uses, but here the write is
// genuinely async (setTimeout) rather than a stale-CDP guard.

type FlagshipSnapshot = {
  scene?: {
    beat?: string;
  };
};

declare global {
  interface Window {
    __game?: {
      version?: number;
      getSnapshot?: () => FlagshipSnapshot;
      _runtime?: {
        audio?: {
          lastCue?: string;
          lastCueAt?: number;
        };
      };
    };
  }
}

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;
const COLD_START_MS = 30_000;

async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
}

async function snapshot(page: Page): Promise<FlagshipSnapshot> {
  await waitForGame(page);
  return page.evaluate(() => window.__game!.getSnapshot!());
}

async function waitForBeat(page: Page, beat: string): Promise<FlagshipSnapshot> {
  await expect
    .poll(async () => (await snapshot(page)).scene?.beat, { timeout: WAIT_MS })
    .toBe(beat);
  return snapshot(page);
}

test.describe("AFTERSIGN io-return-action audio — played cue coupling", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a real tap on #acknowledgeRouteButton at io-return-recognition stamps state._runtime.audio.lastCue to 'io-return-action' and marks the button dataset released", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    // Unique slot per run — same isolation reason as
    // `m-continue-phone-tap-playtest.spec.ts`: server-authoritative
    // save-slot key must be cold so we actually boot at
    // `packet-offered` rather than resuming a sibling's mid-story beat.
    const slot = `io-return-action-audio-played-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForGame(page);

    // Boot: `packet-offered`. Only `#deliverButton` is enabled.
    const boot = await snapshot(page);
    expect(boot.scene?.beat).toBe("packet-offered");

    const deliver = page.locator("#deliverButton");
    await expect(deliver).toBeVisible();
    await expect(deliver).toBeEnabled();
    await deliver.tap();

    // Advance to `io-return-recognition` — all three action buttons
    // are now visible + enabled + tone-labeled, and the re-render loop
    // has just installed `attachIoReturnActionFeedback` on each one
    // (aftersign/main.js: cleanup + reattach for the three-button
    // return-action strip).
    const recognition = await waitForBeat(page, "io-return-recognition");
    expect(recognition.scene?.beat).toBe("io-return-recognition");

    const acknowledge = page.locator("#acknowledgeRouteButton");
    await expect(acknowledge).toBeVisible();
    await expect(acknowledge).toBeEnabled();
    await expect(acknowledge).toContainText(/kind return/i);

    // Sanity: the cue slot is NOT already "io-return-action" — otherwise
    // this spec proves nothing on flip. It may be null or a different
    // cue from an earlier beat.
    const priorCue = await page.evaluate(
      () => window.__game?._runtime?.audio?.lastCue ?? null,
    );
    expect(
      priorCue,
      "the 'io-return-action' cue must not have been stamped before the return-action tap — otherwise this spec proves nothing",
    ).not.toBe("io-return-action");

    // REAL player-input gesture — satisfies the played-input guard
    // (`playtest-input-surface-guard.spec.ts`), mirrors the mobile-tap
    // shape used by `job-offer-confirm-audio-played.spec.ts`. The
    // `.tap()` synthesizes both `pointerdown` and `pointerup` on the
    // shipped DOM node, driving the press envelope through the real
    // listener bundle `attachIoReturnActionFeedback` installed.
    await acknowledge.tap();

    // Press-envelope pin: on `pointerup` the module writes
    // `dataset.ioReturnActionFeedback = "released"` synchronously. If
    // the module had failed to attach to the real button, this dataset
    // slot would remain `undefined` — no other code path writes to it.
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (
                document.querySelector(
                  "#acknowledgeRouteButton",
                ) as HTMLElement | null
              )?.dataset.ioReturnActionFeedback ?? null,
          ),
        {
          timeout: WAIT_MS,
          message:
            "attachIoReturnActionFeedback must stamp dataset.ioReturnActionFeedback on a real tap of the shipped button — not just a detached test node",
        },
      )
      .toBe("released");

    // Coupled-cue pin: 28ms after `pointerup`
    // (`IO_RETURN_ACTION_FEEL.couplingDelayMs`) the audio callback
    // writes `state._runtime.audio.lastCue = "io-return-action"`. This
    // is the exact same contract shape `job-offer-confirm-audio-played`
    // established for the `_runtime.audio.lastCue` slot — a real tap
    // must flip the token, and the flip must survive whatever race
    // exists between CDP polling and the microtask boundary.
    //
    // Note: the beat also advances on click, so the DOM may re-render
    // out from under us. The audio callback runs from the coupling
    // setTimeout which was armed BEFORE the click handler advanced
    // the beat, so the write still lands on `state._runtime.audio`.
    await expect
      .poll(
        () => page.evaluate(() => window.__game?._runtime?.audio?.lastCue ?? null),
        {
          timeout: WAIT_MS,
          message:
            "audio.lastCue should flip to 'io-return-action' on a real tap of one of the three Io return-action buttons",
        },
      )
      .toBe("io-return-action");

    // And `lastCueAt` should be a numeric performance.now() stamp —
    // same shape the sibling `playKioskConfirm` / `playJobOfferConfirm`
    // paths use, so the harness can measure audio-visual coupling.
    const lastCueAt = await page.evaluate(
      () => window.__game?._runtime?.audio?.lastCueAt ?? null,
    );
    expect(
      typeof lastCueAt,
      "audio.lastCueAt should be a numeric performance.now() timestamp after the return-action tap",
    ).toBe("number");
  });
});
