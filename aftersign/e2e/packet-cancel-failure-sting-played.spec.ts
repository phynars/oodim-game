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
    let snapshot: CancelSnapshot | null = null;
    let peakShakeXAbs = 0;
    let peakFlashOpacity = 0;
    await expect
      .poll(
        async () => {
          const next = await readCancelSnapshot(page);
          if (next.feedback?.active === true) {
            const shakeXAbs = Math.abs(next.hudShakeX);
            if (shakeXAbs > peakShakeXAbs) peakShakeXAbs = shakeXAbs;
            if (next.flashOpacity > peakFlashOpacity) {
              peakFlashOpacity = next.flashOpacity;
            }
          }
          // Only stamp `snapshot` once we have a passing frame — that
          // pins the toMatchObject assertion below to a live-sting
          // moment (active === true), the same guarantee the pre-edit
          // gate provided.
          if (
            next.lastAction === 'packet-cancelled' &&
            next.feedback?.active === true &&
            next.flashOpacity > 0
          ) {
            snapshot = next;
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

    // After the sting resolves, the cancelled packet must re-enable the
    // choice beat so the player can recover.  Assert `packet-choice`
    // becomes visible in its RECOVERED state.
    const packetChoice = page.locator('[data-beat-id="packet-choice"]');
    await expect(packetChoice).toBeVisible({ timeout: WAIT_MS });

    // Soren's #1641 REQUEST_CHANGES (lost recovery assertion): the
    // pre-#1641 spec's `packetButton.click()` was load-bearing — it
    // proved the controller wasn't wedged in CANCELLED by showing the
    // click actually ANSWERED with a state change.  Restore that:
    // tap the packet button and assert `interaction.lastAction`
    // transitions away from `packet-cancelled` (into `packet-pressed`,
    // `packet-opened`, or whatever the recovered beat routes to).
    // If the controller were wedged in CANCELLED, the click would be
    // a no-op and `lastAction` would still read `packet-cancelled` —
    // this poll would time out red.  That is the exact wedge signal
    // the earlier revision watched for.
    //
    // Citation note: the played-acceptance boundary is enforced by
    // `apps/web/src/aftersign/harness/playedAcceptanceNoHarnessInput.test.ts`
    // which forbids reads/writes of `window.__game.input.*` in any
    // `*-played.spec.ts` (it does NOT require a specific input
    // primitive to be present — Soren's #1641 called out the earlier
    // header's phantom `playtest-input-surface-guard` reference as
    // fabricated).  This spec complies with the real guard because it
    // drives input via dispatched `PointerEvent`s and a `.click()`,
    // never through `__game.input`.
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
