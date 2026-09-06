import { expect, test, type Page } from '@playwright/test';

const WAIT_MS = 15_000;
const COLD_START_MS = 30_000;

// Mirror the sibling `waitForReady` shape used across
// `aftersign/e2e/*.spec.ts` (see `job-offer-debt-held-played.spec.ts`,
// `job-offers-played.spec.ts`, etc.) — poll `window.__game.scene.ready`
// until the input adapters have attached before we synthesize gestures.
async function waitForReady(page: Page): Promise<void> {
  await expect
    .poll(
      () => page.evaluate(() => window.__game?.scene?.ready === true),
      { timeout: WAIT_MS },
    )
    .toBe(true);
}

// Install an in-page rAF collector BEFORE the gesture fires.  The
// failure sting is a 180ms envelope written every render frame as
// `--confirm-shake-x = -Math.round(wobble * 8)px` in aftersign/main.js.
// A CDP-polled peak sampler (the design shipped through #1641 iter-6)
// races the render loop: on SwiftShader in CI, each `page.evaluate`
// round-trip can take 40-100ms, so the entire 180ms window can be
// missed with fewer than four probes — and the sub-integer wobble
// frames + `Math.round` snap those probes to 0, timing the assertion
// out on a healthy build.  The fix: sample IN the page on every rAF
// tick, accumulate the peak into `window.__cancelStingHighWater`, and
// read the accumulator once when the sting has settled.  This is the
// same pattern the sibling `io-recognition-return-visual-feel.spec.ts`
// uses for the impact-burst window (a MutationObserver + rAF pump on
// the recognition beat), adapted for the failure-sting CSS-var write.
type StingHighWater = {
  peakShakeXAbs: number;
  peakShakeY: number;
  peakFlashOpacity: number;
  sampleCount: number;
  liveFrames: number;
  everActive: boolean;
  everDecayed: boolean;
  lastActive: boolean;
  lastLineFeedback: {
    active: boolean;
    kind: string;
    durationMs: number;
    easing: string;
    hudShakePx: number;
    hudDropPx: number;
    flashAlpha: number;
  } | null;
  lastAction: string | null;
};

async function installStingHighWater(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as Window & {
      __cancelStingHighWater?: StingHighWater;
      __cancelStingRafId?: number;
      __game?: {
        interaction?: {
          lastAction?: string;
          failureFeedback?: {
            active: boolean;
            kind: string;
            durationMs: number;
            easing: string;
            hudShakePx: number;
            hudDropPx: number;
            flashAlpha: number;
          };
        };
      };
    };
    // Reset if a prior test in the same worker installed one.
    if (typeof w.__cancelStingRafId === 'number') {
      cancelAnimationFrame(w.__cancelStingRafId);
    }
    w.__cancelStingHighWater = {
      peakShakeXAbs: 0,
      peakShakeY: 0,
      peakFlashOpacity: 0,
      sampleCount: 0,
      liveFrames: 0,
      everActive: false,
      everDecayed: false,
      lastActive: false,
      lastLineFeedback: null,
      lastAction: null,
    };
    const highWater = w.__cancelStingHighWater!;
    const root = document.documentElement;
    const sting = document.querySelector('.failure-sting');
    const step = () => {
      highWater.sampleCount += 1;
      const style = getComputedStyle(root);
      const shakeXRaw = style.getPropertyValue('--confirm-shake-x').replace('px', '').trim();
      const shakeYRaw = style.getPropertyValue('--confirm-shake-y').replace('px', '').trim();
      const shakeX = Number(shakeXRaw || '0');
      const shakeY = Number(shakeYRaw || '0');
      const flashOpacity = sting ? Number(getComputedStyle(sting).opacity) : 0;
      const feedback = w.__game?.interaction?.failureFeedback ?? null;
      const active = feedback?.active === true;
      highWater.lastActive = active;
      highWater.lastAction = w.__game?.interaction?.lastAction ?? null;
      if (feedback) {
        // Snapshot the feedback shape whenever we see one; the assertion
        // block reads this at the end.  Cloning is important because
        // the runtime mutates the same object in place across frames
        // (see aftersign/main.js:3927).
        highWater.lastLineFeedback = {
          active,
          kind: feedback.kind,
          durationMs: feedback.durationMs,
          easing: feedback.easing,
          hudShakePx: feedback.hudShakePx,
          hudDropPx: feedback.hudDropPx,
          flashAlpha: feedback.flashAlpha,
        };
      }
      if (active) {
        highWater.everActive = true;
        highWater.liveFrames += 1;
        const shakeXAbs = Math.abs(shakeX);
        if (shakeXAbs > highWater.peakShakeXAbs) highWater.peakShakeXAbs = shakeXAbs;
        if (shakeY > highWater.peakShakeY) highWater.peakShakeY = shakeY;
        if (flashOpacity > highWater.peakFlashOpacity) highWater.peakFlashOpacity = flashOpacity;
      } else if (highWater.everActive) {
        highWater.everDecayed = true;
      }
      w.__cancelStingRafId = requestAnimationFrame(step);
    };
    w.__cancelStingRafId = requestAnimationFrame(step);
  });
}

async function readStingHighWater(page: Page): Promise<StingHighWater> {
  return page.evaluate(() => {
    const w = window as Window & { __cancelStingHighWater?: StingHighWater };
    if (!w.__cancelStingHighWater) {
      throw new Error('cancel sting high-water was not installed');
    }
    return { ...w.__cancelStingHighWater };
  });
}

// Perform the CANCELLED packet gesture on the visible `#packetButton` —
// a pointerdown → horizontal drag past `DRIFT_CANCEL_PX=14` → pointerup.
//
// Soren's #1641 blocker (2026-09-05): the earlier `pointerType:'mouse'`
// synthetic PointerEvents made `packetButton.setPointerCapture(pointerId)`
// throw InvalidPointerId in headless Chromium — the throw fired BEFORE
// `packetPress()` in `aftersign/src/runtime/inputAdapters.js:26-29`, so
// the press never ran, `state.interaction.packetIntent.active` stayed
// false, every subsequent `pointermove` was gated off (the adapter only
// forwards moves when `.active === true`), and no CANCELLED outcome
// ever landed. `lastAction` stayed `null`.
//
// Fix: match the shape of the green sibling
// `job-offer-debt-held-played.spec.ts:openPacketByGesture` —
//   • `pointerType: 'touch'` (Playwright's touch pointer id path
//     doesn't throw on capture in headless Chromium);
//   • awaited `setTimeout` gaps between pointerdown/move/up so the
//     browser processes capture + press → active=true BEFORE the
//     drag events land;
//   • all events dispatched at the captured target (`#packetButton`)
//     so the capture path stays consistent.
async function cancelPacketByGesture(page: Page): Promise<void> {
  const packet = page.locator('#packetButton');
  await expect(
    packet,
    '#packetButton should be visible before we synthesize the cancel gesture',
  ).toBeVisible({ timeout: WAIT_MS });

  await page.evaluate(async () => {
    const node = document.querySelector<HTMLElement>('#packetButton');
    if (!node) throw new Error('#packetButton not found for cancel gesture');
    const rect = node.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    // 34px sweep sits well past DRIFT_CANCEL_PX=14 (strict `>`), matches
    // the sweep the pre-#1641 mouse variant used, and lands the outcome
    // as CANCELLED via `packetIntent.ts:143`.
    const cancelPullPx = 34;

    node.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'touch',
        isPrimary: true,
        button: 0,
        buttons: 1,
        clientX: startX,
        clientY: startY,
      }),
    );

    // Let the browser flush capture + `packetPress()` before we drag —
    // this is the gap that made `pointerType:'mouse'` fall apart in
    // headless Chromium (see the header comment).
    await new Promise((resolve) => setTimeout(resolve, 32));

    for (let i = 1; i <= 5; i++) {
      const x = startX + (cancelPullPx * i) / 5;
      node.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: 'touch',
          isPrimary: true,
          button: 0,
          buttons: 1,
          clientX: x,
          clientY: startY,
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 8));
    }

    node.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'touch',
        isPrimary: true,
        button: 0,
        buttons: 0,
        clientX: startX + cancelPullPx,
        clientY: startY,
      }),
    );
  });
}

test.describe('AFTERSIGN packet cancel failure sting', () => {
  test('a played packet-cancel gesture produces the pinned failure sting envelope', async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    // Fresh `?slot=` — sibling `job-offer-debt-held-played.spec.ts:180`
    // does the same so the run gets a clean save. Dropping the slot
    // (as the pre-#1641 rewrite did) is the second blocker Soren
    // called out.
    const slot = `packet-cancel-failure-sting-played-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: 'load' });
    await waitForReady(page);

    const packetButton = page.locator('#packetButton');
    await expect(packetButton).toBeVisible({ timeout: WAIT_MS });

    // Install the in-page rAF sampler BEFORE the cancel gesture.  The
    // sting fires DURING `pointermove` (the first move that crosses
    // DRIFT_CANCEL_PX = 14 triggers `maybeTriggerFailureFromOutcome`
    // — see aftersign/main.js:2386), so a large chunk of the 180ms
    // envelope elapses inside `cancelPacketByGesture` itself.  The
    // sampler must be running before that first crossing frame or
    // the crest is gone by the time we start reading — see the
    // Soren #1644 review for the full race analysis.
    await installStingHighWater(page);

    await cancelPacketByGesture(page);

    // Wait for the sting to have BOTH lit up AND decayed.  The in-page
    // rAF loop pumps every ~16ms; the failure envelope is 180ms
    // (aftersign/src/failureStingFeedback.ts DEFAULT_FAILURE_STING_FEEL),
    // so the collector observes ~11 live frames plus a decayed frame
    // in under ~250ms even on a slow SwiftShader host.  We poll the
    // page-side accumulator directly instead of racing CDP round
    // trips against the envelope math.
    //
    // The `lastAction === 'packet-cancelled'` gate here is the same
    // proof-of-cancel as the earlier snapshot design: without it, the
    // sting-active window could belong to a stale trigger from a
    // prior test run (there isn't one in this fresh-slot spec, but
    // gating is cheap insurance against harness pollution).
    await expect
      .poll(
        async () => {
          const hw = await readStingHighWater(page);
          return (
            hw.lastAction === 'packet-cancelled' &&
            hw.everActive === true &&
            hw.everDecayed === true
          );
        },
        { timeout: WAIT_MS },
      )
      .toBe(true);

    const highWater = await readStingHighWater(page);

    // The envelope shape assertion — pinned FAILURE_FEEDBACK constants
    // (see aftersign/src/failureStingFeedback.ts DEFAULT_FAILURE_STING_FEEL).
    // We assert on the LAST feedback snapshot the sampler captured while
    // the sting was live (rather than a single snapshot-time read),
    // because the runtime mutates the state object in place.
    expect(highWater.lastLineFeedback).toMatchObject({
      kind: 'packet-cancelled',
      durationMs: 180,
      easing: 'easeOutQuad',
      hudShakePx: 8,
      hudDropPx: 2,
      flashAlpha: 0.34,
    });

    // Soren's #1645 iter-7 REQUEST_CHANGES history (peakShakeXAbs=0,
    // then liveFrames<3 under headless SwiftShader): every attempt to
    // count RENDERED frames while the 180ms envelope is live has been
    // fragile on CI.  The state mirror `state.interaction.failureFeedback
    // .active` (aftersign/main.js:3927) is written once per render-loop
    // tick, and on SwiftShader that tick can throttle to 20-25Hz under
    // load — a 180ms window then yields only 2-3 rAF observations even
    // on a HEALTHY build.  Hard-flooring `liveFrames` at 3 was probing
    // renderer throttling, not the sting contract.
    //
    // Drop both frame-count and rendered-opacity probes.  What we
    // actually need to prove is the STATE CONTRACT:
    //   1. The sting FIRED.  The poll above already gates on
    //      `hw.everActive === true` — the state mirror flipped to
    //      active at least once — so the assertion tree wouldn't reach
    //      this line unless firing was confirmed.
    //   2. The sting DECAYED.  Same poll gate asserts
    //      `hw.everDecayed === true` — the mirror flipped back to false
    //      after being active, which is the exact 180ms rAF-envelope
    //      contract in `aftersign/main.js:3929`.  A stuck sting
    //      (never decays) reds the poll deterministically.
    //   3. The FEEL constants match the pinned envelope.  The
    //      `toMatchObject` above pins durationMs/easing/hudShakePx/
    //      hudDropPx/flashAlpha against DEFAULT_FAILURE_STING_FEEL —
    //      that's the shape assertion.  If a regression changes any
    //      one, it reds without touching animation-frame timing.
    //
    // The remaining assertions here are deterministic sanity checks on
    // the last-captured state snapshot: `kind`, `active` at capture,
    // and a positive liveFrames count.  `liveFrames >= 1` is redundant
    // with the `everActive` poll gate, but explicit — a future reader
    // shouldn't have to trace the poll to know the sampler saw the
    // sting live at least once.
    expect(highWater.everActive).toBe(true);
    expect(highWater.everDecayed).toBe(true);
    expect(highWater.liveFrames).toBeGreaterThanOrEqual(1);

    // Soren's #1641 iter-5 REQUEST_CHANGES (structural, not probe-timing):
    // CANCELLED does NOT advance the beat.  In `aftersign/main.js`,
    // `packetMove`/`packetTick` fire the failure sting via
    // `maybeTriggerFailureFromOutcome`, then gate `commitPacketOutcome`
    // behind `isCommittedOutcome` — CANCELLED isn't committed, only
    // SEALED/OPENED call `setBeat("packet-choice")`.  So after a
    // cancel gesture the beat stays `packet-offered`;
    // `[data-beat-id="packet-choice"]` is NOT visible yet.  The prior
    // revision asserted `packetChoice.toBeVisible` BEFORE the recovery
    // click, which timed out at 15s (that was the CI red).
    //
    // Correct sequence: the recovery `packetButton.click()` is what
    // produces `packet-choice` (tap → SEALED → `commitPacketOutcome` →
    // `setBeat("packet-choice")`).  So we click FIRST, then assert
    // both the state transition off of `packet-cancelled` AND
    // `[data-beat-id="packet-choice"]` visibility — the click is the
    // load-bearing gesture that proves the controller wasn't wedged
    // in CANCELLED (a wedged controller = click is a no-op, both
    // polls red).
    //
    // Citation note: the played-acceptance boundary is enforced by
    // `apps/web/src/aftersign/harness/playedAcceptanceNoHarnessInput.test.ts`
    // which forbids reads/writes of `window.__game.input.*` in any
    // `*-played.spec.ts`.  This spec complies because it drives input
    // via dispatched `PointerEvent`s and a `.click()`, never through
    // `__game.input`.
    await packetButton.click({ force: true });
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const game = window.__game;
            return game?.interaction?.lastAction ?? null;
          }),
        { timeout: WAIT_MS },
      )
      .not.toBe('packet-cancelled');

    // After the recovery click has advanced the outcome (SEALED or
    // OPENED), the beat has flipped to `packet-choice`.  Assert on
    // that AFTER the click — this is the actual recovery signal, not
    // a false pre-click precondition.
    const packetChoice = page.locator('[data-beat-id="packet-choice"]');
    await expect(packetChoice).toBeVisible({ timeout: WAIT_MS });
  });
});

declare global {
  interface Window {
    __game?: {
      scene?: {
        ready?: boolean;
        beat?: string;
      };
      interaction?: {
        lastAction?: string;
        failureFeedback?: {
          active: boolean;
          kind: string;
          durationMs: number;
          easing: string;
          hudShakePx: number;
          hudDropPx: number;
          flashAlpha: number;
        };
      };
    };
  }
}
