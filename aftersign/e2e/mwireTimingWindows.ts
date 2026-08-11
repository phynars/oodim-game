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
// (1) install an rAF high-water SAMPLER that captures the first frame
// satisfying the predicate, then (2) dispatch the runtime call that
// opens the window and (3) actively pump rAF frames — ALL INSIDE ONE
// page.evaluate — so the sequence "sampler armed → deliverPacket
// stamps memoryRecognitionBeatStartedAt → runtime tick recomputes
// syncRecognitionDomFeedback → sampler captures" runs inside a single
// browser rAF batch. Doing arm/dispatch/pump across three separate
// page.evaluate calls empirically leaves ~10-30ms of node<->page
// round-trip latency between arm and the first pump-driven rAF, on
// SwiftShader that's enough for rAF to starve past the 54ms window.

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

export async function armAndCaptureMwireRecognitionFeel(
  page: Page,
  timeout: number,
): Promise<RecognitionDomFeedbackSnapshot> {
  const observed = await page.evaluate(async (timeoutMs) => {
    type Feedback = {
      active?: boolean;
      signGlowPx?: number;
      hapticScale?: number;
    };
    type HighWater = {
      captured: boolean;
      active: boolean;
      signGlowPx: number;
      hapticScale: number;
      ticks: number;
      activeSeen: boolean;
      maxHapticScale: number;
      maxSignGlowPx: number;
    };
    const hw: HighWater = {
      captured: false,
      active: false,
      signGlowPx: 0,
      hapticScale: 0,
      ticks: 0,
      activeSeen: false,
      maxHapticScale: 0,
      maxSignGlowPx: 0,
    };

    // Sampler: reads window.__game.interaction.recognitionDomFeedback
    // (published by aftersign/main.js publishState — the runtime tick
    // calls syncRecognitionDomFeedback then publishState each frame,
    // so this surface refreshes at rAF cadence). Runs on browser rAF.
    let stopped = false;
    const sampleTick = () => {
      if (stopped) return;
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

    // Dispatch the deliver on the same tick the sampler was armed.
    // Runtime deliverPacket() stamps memoryRecognitionBeatStartedAt =
    // performance.now() synchronously (aftersign/main.js:1625), so the
    // beat clock is set BEFORE the next rAF fires — the very next
    // runtime tick lands elapsedMs≈16ms (well before the 128ms haptic
    // window opens), and the pump below walks elapsedMs continuously
    // through the 54ms slice.
    const game = window.__game as
      | (FlagshipGameSurface & { input?: { choose?: (id: string) => void | Promise<void> } })
      | undefined;
    if (!game?.input?.choose) {
      stopped = true;
      throw new Error("window.__game.input.choose is not available at delivery time");
    }
    await Promise.resolve(game.input.choose("deliver-packet"));

    // Pump rAF frames from Playwright's side until the sampler captures
    // or the timeout expires. Each awaited rAF drives one runtime tick
    // AND one sampler tick in the same browser frame batch.
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline && !hw.captured) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }

    stopped = true;
    return hw;
  }, timeout);

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
