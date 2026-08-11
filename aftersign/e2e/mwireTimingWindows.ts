import type { Page } from "@playwright/test";

import type { FlagshipGameSurface } from "../../e2e-shared/flagshipStoryStateContract";

export type RecognitionDomFeedbackSnapshot = {
  active: boolean;
  signGlowPx: number;
  hapticScale: number;
};

// The delivery-feel window (`hapticScale > 1` AND `signGlowPx > 0`
// AND feedback.active) is a ~54ms slice of the io-return-recognition
// beat (elapsedMs≈128–182 for sealed, ≈165–237 for opened —
// aftersign/recognition-beat-feedback.js:65-70 / :99-104). At CI speed
// on SwiftShader, rAF can starve long enough that Playwright's default
// `waitForFunction` (polls every 100ms; even `polling:16` was too
// coarse — see io-recognition-return-visual-feel.spec.ts:290-313 for
// the identical fix on the 260ms particle-burst window) samples the
// state OUTSIDE the slice on every poll and times out on a healthy
// build.
//
// The proven pattern from the impact-burst spec, generalized here:
// (1) INSTALL an rAF high-water SAMPLER on window — separate evaluate
// that returns immediately; the sampler keeps running on browser rAF
// AFTER the evaluate resolves. (2) Dispatch the runtime call that
// opens the window (`deliverPacket`) in a second evaluate. (3) PUMP
// frames from Playwright's side in a while-loop where EACH iteration
// is its own evaluate awaiting ONE rAF — matching the sibling
// io-recognition-return-visual-feel.spec.ts:305-316. Prior attempts
// that ran the whole arm+dispatch+pump sequence INSIDE one big
// page.evaluate blocked the node<->page bridge and empirically
// starved rAF past the 54ms hapticScale window; the sibling's
// small-evaluate pump proved that pattern lets rAF fire reliably on
// SwiftShader.

type FeelHighWater = {
  captured: boolean;
  active: boolean;
  signGlowPx: number;
  hapticScale: number;
  // Diagnostics surfaced in the failure message so a red CI reports
  // the TRUE reason (rAF never fired vs. window missed vs. beat never
  // stamped) instead of a generic "never captured".
  ticks: number;
  activeSeen: boolean;
  maxHapticScale: number;
  maxSignGlowPx: number;
};

declare global {
  interface Window {
    __mwireFeelHighWater?: FeelHighWater;
  }
}

// Install an rAF high-water sampler on the page that captures the
// first frame satisfying (active && signGlowPx > 0 && hapticScale > 1)
// AND tracks maxima for diagnostics. Returns immediately — the
// sampler keeps running on browser rAF after this evaluate resolves.
async function installFeelHighWaterSampler(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as Window & { __mwireFeelHighWater?: FeelHighWater };
    w.__mwireFeelHighWater = {
      captured: false,
      active: false,
      signGlowPx: 0,
      hapticScale: 0,
      ticks: 0,
      activeSeen: false,
      maxHapticScale: 0,
      maxSignGlowPx: 0,
    };
    type Feedback = {
      active?: boolean;
      signGlowPx?: number;
      hapticScale?: number;
    };
    type FeelHighWater = {
      captured: boolean;
      active: boolean;
      signGlowPx: number;
      hapticScale: number;
      ticks: number;
      activeSeen: boolean;
      maxHapticScale: number;
      maxSignGlowPx: number;
    };
    const sampleTick = () => {
      const hw = (window as Window & { __mwireFeelHighWater?: FeelHighWater }).__mwireFeelHighWater;
      if (!hw) return; // teardown
      hw.ticks += 1;
      const game = window.__game as
        | (FlagshipGameSurface & { interaction?: { recognitionDomFeedback?: Feedback } })
        | undefined;
      const fb = game?.interaction?.recognitionDomFeedback;
      if (fb) {
        const active = fb.active === true;
        const signGlowPx = fb.signGlowPx ?? 0;
        const hapticScale = fb.hapticScale ?? 0;
        if (active) hw.activeSeen = true;
        if (hapticScale > hw.maxHapticScale) hw.maxHapticScale = hapticScale;
        if (signGlowPx > hw.maxSignGlowPx) hw.maxSignGlowPx = signGlowPx;
        if (!hw.captured && active && signGlowPx > 0 && hapticScale > 1) {
          hw.captured = true;
          hw.active = active;
          hw.signGlowPx = signGlowPx;
          hw.hapticScale = hapticScale;
        }
      }
      requestAnimationFrame(sampleTick);
    };
    requestAnimationFrame(sampleTick);
  });
}

async function teardownFeelHighWaterSampler(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as Window & { __mwireFeelHighWater?: FeelHighWater };
    delete w.__mwireFeelHighWater;
  });
}

// Public entrypoint. The caller MUST have already navigated to the
// packet-offered beat and chosen the outcome (keep-sealed / open-packet)
// via clickChoiceViaDom / holdChoiceViaDom — this function only handles
// the deliver step and the feel-window capture.
//
// Flow:
//   1. Install rAF high-water sampler on window (runs on browser rAF).
//   2. Dispatch `input.choose("deliver-packet")` in its own evaluate —
//      this stamps `memoryRecognitionBeatStartedAt = performance.now()`
//      synchronously (aftersign/main.js:1625), opening the DOM-feedback
//      window. The choose promise resolves once the runtime finishes
//      one microtask worth of state mutation; the sampler is already
//      armed on rAF and will observe the very next frame.
//   3. PUMP frames from Playwright — each iteration is its own tiny
//      evaluate awaiting one rAF. This mirrors
//      io-recognition-return-visual-feel.spec.ts:305-316 exactly. The
//      small-evaluate cadence is what lets rAF actually fire on
//      SwiftShader; a single long-lived evaluate blocked the frame
//      loop in earlier attempts.
//   4. Read + teardown.
export async function armAndCaptureMwireRecognitionFeel(
  page: Page,
  timeout: number,
): Promise<RecognitionDomFeedbackSnapshot> {
  await installFeelHighWaterSampler(page);

  // Dispatch deliver FIRE-AND-FORGET in its own evaluate. Runtime
  // deliverPacket() stamps memoryRecognitionBeatStartedAt =
  // performance.now() SYNCHRONOUSLY (aftersign/main.js:1625) — so by
  // the time input.choose's synchronous prefix returns, the feel
  // window's clock has already started. We do NOT await the choose()
  // promise to full resolution because it can hold the node<->page
  // bridge past the 54ms hapticScale window on SwiftShader, starving
  // the sampler of rAF frames INSIDE that window (identical failure
  // mode to the impact-burst spec's advance() await — see comment in
  // io-recognition-return-visual-feel.spec.ts around line 330).
  const dispatched = await page.evaluate(() => {
    const game = window.__game as
      | (FlagshipGameSurface & {
          input?: { choose?: (id: string) => void | Promise<void> };
        })
      | undefined;
    if (!game?.input?.choose) return false;
    // void: intentionally do not await — see rationale above.
    void game.input.choose("deliver-packet");
    return true;
  });

  if (!dispatched) {
    await teardownFeelHighWaterSampler(page);
    throw new Error(
      "armAndCaptureMwireRecognitionFeel: window.__game.input.choose was not available at delivery time",
    );
  }

  // Pump rAF frames from Playwright's side. Each iteration is ONE
  // evaluate that BOTH awaits a rAF AND reads the high-water — the
  // exact shape as the sibling impact-burst spec's while loop
  // (io-recognition-return-visual-feel.spec.ts:305-316). Splitting
  // the rAF-await and the read into two evaluates per iteration
  // re-introduces ~10-30ms of node<->page round-trip per tick, which
  // on SwiftShader is enough to starve rAF past the 54ms hapticScale
  // window — that was the observed defect on PR #1129's earlier
  // iterations. Fusing them keeps the pump cadence at one bridge hop
  // per frame.
  const deadline = Date.now() + timeout;
  let observed: FeelHighWater = {
    captured: false,
    active: false,
    signGlowPx: 0,
    hapticScale: 0,
    ticks: 0,
    activeSeen: false,
    maxHapticScale: 0,
    maxSignGlowPx: 0,
  };
  while (Date.now() < deadline && !observed.captured) {
    observed = await page.evaluate(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const hw = (window as Window & { __mwireFeelHighWater?: FeelHighWater }).__mwireFeelHighWater;
      if (!hw) {
        return {
          captured: false,
          active: false,
          signGlowPx: 0,
          hapticScale: 0,
          ticks: 0,
          activeSeen: false,
          maxHapticScale: 0,
          maxSignGlowPx: 0,
        } satisfies FeelHighWater;
      }
      return { ...hw };
    });
  }

  await teardownFeelHighWaterSampler(page);

  if (!observed.captured) {
    throw new Error(
      "armAndCaptureMwireRecognitionFeel: high-water sampler never captured a frame where "
        + "recognitionDomFeedback.active && signGlowPx > 0 && hapticScale > 1. Diagnostics: "
        + `sampler ticks=${observed.ticks}, activeSeen=${observed.activeSeen}, `
        + `maxHapticScale=${observed.maxHapticScale}, maxSignGlowPx=${observed.maxSignGlowPx}. `
        + "If ticks==0 the pump never drove a frame. "
        + "If activeSeen=false the beat clock (memoryRecognitionBeatStartedAt) was never stamped "
        + "(deliverPacket did not fire). "
        + "If maxHapticScale<=1 the runtime tick jumped past the 54ms hapticScale window "
        + "(aftersign/main.js:1970 rAF starvation — the pump did not drive frames fast enough).",
    );
  }

  return {
    active: observed.active,
    signGlowPx: observed.signGlowPx,
    hapticScale: observed.hapticScale,
  };
}

export async function waitForMwireRecognitionBeat(
  page: Page,
  timeout: number,
): Promise<void> {
  await page.waitForFunction(
    () => window.__game?.scene?.beat === "io-return-recognition",
    undefined,
    { timeout },
  );
}
