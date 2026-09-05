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

type CancelSnapshot = {
  lastAction: string | null;
  feedback: {
    active: boolean;
    kind: string;
    durationMs: number;
    easing: string;
    hudShakePx: number;
    hudDropPx: number;
    flashAlpha: number;
  } | null;
  hudShakeX: number;
  hudShakeY: number;
  flashOpacity: number;
};

// Soren's #1641 REQUEST_CHANGES (atomicity): read `lastAction` and the
// failureFeedback envelope + live style probes in ONE `page.evaluate`
// round-trip.  The 180ms rAF decay on `failureFeedback.active` and
// `flashOpacity` means splitting the read into two round-trips
// (`expect.poll(lastAction === 'packet-cancelled')` followed by a
// separate `page.evaluate` for the envelope) can land the second read
// AFTER the sting settles — `active: false`, `flashOpacity: 0`, red.
// One `page.evaluate` per poll pass keeps the snapshot atomic; we
// re-poll until `lastAction === 'packet-cancelled'` AND the sting is
// still live, then assert on the returned snapshot directly.
//
// Soren's #1641 iter-4 REQUEST_CHANGES (shake probe times to zero):
// `--confirm-shake-x` is written every render frame as
// `${confirmEnvelope.hudShakeX - Math.round(failureWobble * hudShakePx)}px`
// (aftersign/main.js:3820). `failureWobble = falloff * sin(progress *
// π * wobbleCycles)` with `wobbleCycles=5` — a sine that crosses ZERO
// at progress=0, 0.2, 0.4, 0.6, 0.8, 1.0 (six times across the 180ms
// window).  Plus the `Math.round` snaps any `|failureWobble * 8| <
// 0.5` frame to 0.  So a single-snapshot read is not a reliable probe
// of "the shake shipped": the sting IS shaking, but the CSS var reads
// 0 at any zero-crossing or subthreshold frame.
//
// Fix: instead of asserting on ONE snapshot's `hudShakeX`, accumulate
// the PEAK |hudShakeX| observed across every poll pass while the sting
// is live, then assert on the peak.  The peak necessarily rides the
// oscillation crests (|falloff * sin| ≈ 1 * hudShakePx=8 near
// progress≈0.1) and stays non-zero through Math.round.  This matches
// Soren's second option: "retime the shake probe" — we now sample it
// across the whole live window rather than at a single moment.
async function readCancelSnapshot(page: Page): Promise<CancelSnapshot> {
  return page.evaluate((): CancelSnapshot => {
    const game = window.__game;
    const root = document.documentElement;
    const sting = document.querySelector<HTMLElement>('.failure-sting');
    const style = getComputedStyle(root);
    return {
      lastAction: game?.interaction?.lastAction ?? null,
      feedback: game?.interaction?.failureFeedback ?? null,
      hudShakeX: Number(style.getPropertyValue('--confirm-shake-x').replace('px', '').trim() || '0'),
      hudShakeY: Number(style.getPropertyValue('--confirm-shake-y').replace('px', '').trim() || '0'),
      flashOpacity: sting ? Number(getComputedStyle(sting).opacity) : 0,
    };
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

    await cancelPacketByGesture(page);

    // Atomic poll: keep reading a single-round-trip snapshot until the
    // gesture has resolved as `packet-cancelled` AND the sting is
    // still live.  Because both fields come from the same evaluate,
    // there is no way the 180ms rAF decay can settle `active` between
    // the two reads — the prior split-read version could red exactly
    // that way (see readCancelSnapshot header).
    //
    // We ALSO track the peak |hudShakeX| and peak flashOpacity across
    // every poll pass — see readCancelSnapshot's header comment for
    // why the shake probe cannot be asserted on a single snapshot
    // (sin() zero-crossings + Math.round quantization).  The gate
    // still fires when the FIRST pass sees lastAction+active+flash;
    // the peaks give the assertion block real amplitude to check.
    // Soren's #1641 iter-6 REQUEST_CHANGES (peak still reads 0):
    // The previous version accumulated `peakShakeXAbs` INSIDE the
    // `expect.poll` predicate — but `expect.poll` resolves on the
    // first frame the predicate returns `true`, which is the FIRST
    // frame where `lastAction === 'packet-cancelled' && active &&
    // flashOpacity > 0`.  That first passing frame is progress≈0,
    // where `sin(0)=0` → `hudShakeX=0` → `peakShakeXAbs=0`, and
    // then the poll STOPS.  A "peak" was never accumulated across
    // the live window; it was a single-frame read dressed as a
    // peak.  Fix: split the wait into TWO phases —
    //   (1) an `expect.poll` gate that resolves as soon as we see
    //       the first live-sting frame + stamps `snapshot` (so the
    //       `toMatchObject` assertion has a live moment to pin to);
    //   (2) a dedicated peak-sampling loop that keeps sampling for
    //       the rest of the ~180ms live window at short intervals,
    //       accumulating `peakShakeXAbs` and `peakFlashOpacity`
    //       across ALL frames.  The crest near progress≈0.1 lands
    //       inside this loop, so the peak necessarily stamps
    //       non-zero (|falloff * sin(0.1π * 5)| = |0.9 * sin(π/2)|
    //       ≈ 0.9 → hudShakeX ≈ Math.round(0.9 * 8) = 7).
    let snapshot: CancelSnapshot | null = null;
    let peakShakeXAbs = 0;
    let peakFlashOpacity = 0;

    // Phase 1: gate — resolve on the first live-sting frame.
    await expect
      .poll(
        async () => {
          const next = await readCancelSnapshot(page);
          if (
            next.lastAction === 'packet-cancelled' &&
            next.feedback?.active === true &&
            next.flashOpacity > 0
          ) {
            snapshot = next;
            const shakeXAbs = Math.abs(next.hudShakeX);
            if (shakeXAbs > peakShakeXAbs) peakShakeXAbs = shakeXAbs;
            if (next.flashOpacity > peakFlashOpacity) {
              peakFlashOpacity = next.flashOpacity;
            }
            return true;
          }
          return false;
        },
        { timeout: WAIT_MS, intervals: [16, 32, 64] },
      )
      .toBe(true);

    // TS: snapshot is set by the poll above (poll cannot resolve `true`
    // without a snapshot with `feedback.active === true`).
    if (!snapshot) throw new Error('cancel snapshot never captured');
    const captured: CancelSnapshot = snapshot;

    // Phase 2: peak-sampling loop.  Sting duration is 180ms; the gate
    // above resolved somewhere in the first ~16-32ms, so we still have
    // ~150ms of live window to sample.  Sample at ~10ms intervals for
    // up to 220ms (safety margin past durationMs) — this catches
    // multiple sine crests within the falloff envelope.  We stop as
    // soon as `active` goes false (sting decayed) OR the budget
    // elapses, whichever comes first.
    const peakSamplingBudgetMs = 220;
    const peakSampleIntervalMs = 10;
    const peakSamplingStart = Date.now();
    while (Date.now() - peakSamplingStart < peakSamplingBudgetMs) {
      const probe = await readCancelSnapshot(page);
      if (probe.feedback?.active !== true) break;
      const shakeXAbs = Math.abs(probe.hudShakeX);
      if (shakeXAbs > peakShakeXAbs) peakShakeXAbs = shakeXAbs;
      if (probe.flashOpacity > peakFlashOpacity) {
        peakFlashOpacity = probe.flashOpacity;
      }
      // Fixed 10ms gap between peak-sampling probes across the ~180ms
      // live-sting window — deliberate wall-clock spacing to catch
      // multiple sine crests within the falloff envelope, not a state
      // wait.  The no-wall-clock-waits guard (e2e-shared/
      // no-wall-clock-waits/check.mjs) only honours a marker on the
      // call line or the line immediately above it, so the `// pacing`
      // marker MUST sit on the call line below — do not move it.
      await page.waitForTimeout(peakSampleIntervalMs); // pacing — sampling cadence across the live sting window
    }

    expect(captured.feedback).toMatchObject({
      active: true,
      kind: 'packet-cancelled',
      durationMs: 180,
      easing: 'easeOutQuad',
      hudShakePx: 8,
      hudDropPx: 2,
      flashAlpha: 0.34,
    });
    // Assert on the PEAK shake accumulated across the live window, not
    // on the snapshot-time value — the sting IS shaking (peak ≈ 8px on
    // the first oscillation crest at progress≈0.1) but the CSS var
    // reads 0 at sine zero-crossings and at sub-integer wobble frames
    // after Math.round.  See readCancelSnapshot header for the math.
    expect(peakShakeXAbs).toBeGreaterThan(0);
    expect(captured.hudShakeY).toBeGreaterThanOrEqual(0);
    expect(captured.flashOpacity).toBeGreaterThan(0);
    expect(peakFlashOpacity).toBeGreaterThan(0);
    expect(peakFlashOpacity).toBeLessThanOrEqual(0.34);

    // Wait for the sting to decay — this proves the 180ms rAF window
    // completes.  Kept as a separate poll because the assertion is
    // now about the OPPOSITE state (settled), so a snapshot-atomic
    // read is neither possible nor needed.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const game = window.__game;
            return game?.interaction?.failureFeedback?.active ?? false;
          }),
        { timeout: 1200 },
      )
      .toBe(false);

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
