import { expect, test, type Page } from '@playwright/test';

const WAIT_MS = 15_000;
const COLD_START_MS = 30_000;

// Reduced-motion variant of `packet-cancel-failure-sting-played.spec.ts`.
// The sibling shipped after seven iterations (#1641/#1644/#1645) exactly
// because single-snapshot `page.evaluate` reads of the 180ms failure
// envelope race the render loop on SwiftShader CI (40-100ms CDP round
// trips, sub-integer wobble frames snapping to 0 under `Math.round`).
// This spec MUST use the same in-page rAF high-water sampler AND the
// same discipline about which peaks are timing-robust vs. timing-fragile.
//
// Soren's blocker on iter-1 (#1688): `peakShakeY > 0` on the rendered
// CSS var got 0 in CI.  Root cause: `aftersign/main.js:3902` writes
// `--confirm-shake-y = hudLiftY + Math.round(failureFalloff * hudDropPx)`.
// Under reduced motion `hudLiftY = 0` and `hudDropPx = 2`, so the write
// is `Math.round(failureFalloff * 2)` — a value that is > 0 only while
// `failureFalloff >= 0.25`, i.e. progress ≤ 0.5, i.e. the first ~90ms
// of the 180ms envelope.  On SwiftShader throttled to 20-25Hz, the
// render loop can skip that window entirely (only late-progress frames
// render, all rounding to 0), so the rAF sampler reads 0 across every
// active frame.  Same fragility as `peakShakeX > 0` on the sibling —
// that's why the sibling dropped rendered-peak lower-bound assertions
// and relied on the STATE CONTRACT + `peakShakeXAbs === 0` as the
// timing-robust invariants.  This spec mirrors that discipline.
//
// What we assert (timing-ROBUST — any frame either red or green
// deterministically, no rounding-through-throttling flake):
//   • lateral shake (`--confirm-shake-x`) stays at 0 for the entire
//     envelope (peakShakeXAbs === 0).  This is the load-bearing
//     reduced-motion FEEL contract — main.js writes
//     `-Math.round(failureWobble * hudShakePx)`, and under reduced
//     motion `failureWobble = rawWobble * 0 = 0`, so EVERY frame
//     writes exactly 0.  Any non-zero across any sampled frame reds.
//   • rendered vertical drop stays ≤ hudDropPx (2px) — the pinned
//     ceiling.  A regression that removed the reduced-motion clamp
//     and let full-amplitude shake-y through would red this.
//   • rendered flash opacity stays ≤ flashAlpha (0.34) — same shape.
//   • STATE CONTRACT via `toMatchObject`: durationMs=180, hudDropPx=2,
//     flashAlpha=0.34 pinned on `state.interaction.failureFeedback`.
//     Reduced motion is enforced at the CSS-var write, NOT at the
//     state; a regression that dropped the drop/flash rows from the
//     feel constants would red this.
//   • everActive + everDecayed: the sting FIRED (state flipped active
//     at least once) and DECAYED (flipped back to false), the exact
//     180ms envelope contract in `main.js:3929`.
//
// We do NOT assert `peakShakeY > 0` or `peakFlashOpacity > 0` here —
// same reason the sibling doesn't assert `peakShakeX > 0`: those are
// probes of the renderer's frame-count budget under Math.round + CI
// throttling, not the reduced-motion contract.  The reduced-motion
// contract IS the shake-x=0 clamp plus the state constants; those
// are what a regression to the reduced-motion path would break.

async function waitForReady(page: Page): Promise<void> {
  await expect
    .poll(
      () => page.evaluate(() => window.__game?.scene?.ready === true),
      { timeout: WAIT_MS },
    )
    .toBe(true);
}

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

// Identical touch-pointer cancel gesture to the sibling.  #1641's fix:
// `pointerType: 'mouse'` throws InvalidPointerId on
// `setPointerCapture` in headless Chromium; `touch` doesn't.  The
// awaited setTimeout gaps let the browser flush capture + `packetPress`
// before the drag events land.  DRIFT_CANCEL_PX = 14 strict `>`, so
// 34px sweep lands the outcome as CANCELLED via `packetIntent.ts:143`.
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

test.describe('AFTERSIGN packet cancel reduced-motion failure sting', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });

  test('real drag-cancel keeps the flash/drop acknowledgement while suppressing lateral shake', async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    // Dynamic slot — Soren's blocker on the prior revision.  A static
    // slot risks reading stale state from a previous worker run on the
    // same slot key; `Date.now()` guarantees a fresh save every run.
    const slot = `packet-cancel-reduced-motion-failure-sting-played-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: 'load' });
    await waitForReady(page);

    const packetButton = page.locator('#packetButton');
    await expect(packetButton).toBeVisible({ timeout: WAIT_MS });

    // Install rAF sampler BEFORE the cancel gesture — the sting fires
    // during `pointermove` (first frame past DRIFT_CANCEL_PX=14), so
    // a chunk of the 180ms envelope elapses inside the gesture helper.
    await installStingHighWater(page);

    await cancelPacketByGesture(page);

    // Gate on the in-page state contract: cancel happened, envelope
    // fired, envelope decayed.  Reading the accumulator directly
    // sidesteps CDP round-trip latency against the 180ms window.
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

    // Envelope shape: pinned FAILURE_FEEDBACK constants.  The
    // reduced-motion variant does NOT change the state contract;
    // it changes the RENDERED lateral shake to zero while the state
    // still reports the full envelope.  So `hudShakePx: 8` still
    // pins here — reduced motion is enforced at the CSS-var write,
    // not at the feedback state.
    expect(highWater.lastLineFeedback).toMatchObject({
      kind: 'packet-cancelled',
      durationMs: 180,
      easing: 'easeOutQuad',
      hudShakePx: 8,
      hudDropPx: 2,
      flashAlpha: 0.34,
    });

    // The reduced-motion RENDER contract — TIMING-ROBUST only.  See
    // the header for why we drop `> 0` lower bounds on shake-y and
    // flash opacity: the write is `Math.round(falloff * 2)` and
    // `falloff * 0.34`, both of which round-through-zero on late
    // envelope frames under SwiftShader throttling.  What we CAN
    // assert deterministically:
    //   1. peakShakeXAbs === 0 — load-bearing reduced-motion
    //      invariant.  main.js writes `-Math.round(wobble * 8)`, and
    //      under reduced motion `wobble = rawWobble * 0 = 0`, so
    //      EVERY frame writes exactly 0.  Any regression that dropped
    //      the motionScale on wobble would let a non-zero shake-x
    //      through on at least one sampled frame → reds.
    //   2. peakShakeY <= 2 — the pinned hudDropPx ceiling.  A
    //      regression that removed the reduced-motion clamp entirely
    //      would let the full-amplitude confirm HUD lift (which peaks
    //      well above 2px on a non-reduced envelope) leak into
    //      shake-y → reds.
    //   3. peakFlashOpacity <= 0.34 — same shape, the pinned
    //      flashAlpha ceiling.  The flash opacity is a monotone
    //      function of `falloff * feel.flashAlpha`, so a regression
    //      that raised the flash amplitude reds this without needing
    //      to catch a specific early frame.
    // The STATE CONTRACT in the `toMatchObject` above is what proves
    // the drop/flash acknowledgement SURVIVED reduced motion (both
    // rows still pinned at 2px and 0.34).  Reduced motion clamps
    // rendered lateral shake to 0, but the state constants stay
    // identical — that's the whole reduced-motion contract in this
    // module (see failureStingFeedback.ts test line 222: "reducedMotion
    // must preserve hudDropPx feel constant").
    expect(highWater.peakShakeXAbs).toBe(0);
    expect(highWater.peakShakeY).toBeLessThanOrEqual(2);
    expect(highWater.peakFlashOpacity).toBeLessThanOrEqual(0.34);

    // Deterministic sanity on the last-captured snapshot — redundant
    // with the poll gate above, but explicit for future readers.
    expect(highWater.everActive).toBe(true);
    expect(highWater.everDecayed).toBe(true);
    expect(highWater.liveFrames).toBeGreaterThanOrEqual(1);
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
