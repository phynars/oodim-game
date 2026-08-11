import type { Page } from "@playwright/test";

import type { FlagshipGameSurface } from "../../e2e-shared/flagshipStoryStateContract";

export type RecognitionDomFeedbackSnapshot = {
  active: boolean;
  signGlowPx: number;
  hapticScale: number;
};

type FeelHighWater = {
  captured: boolean;
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
// The proven pattern (from the impact-burst spec): install an in-page
// SAMPLER that captures the high-water snapshot the instant a frame
// satisfies the predicate, then ACTIVELY PUMP rAF frames from the test
// harness until the high-water flag flips true. The sampler runs on
// the runtime's own rAF cadence (see main.js render loop calling
// `syncRecognitionDomFeedback` on line 1985 and republishing state
// each tick), so every ~16ms it gets a fresh read — the window cannot
// be missed unless the beat genuinely didn't fire.

export async function armMwireRecognitionFeelWindow(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as Window & {
      __mwireFeelHighWater?: FeelHighWater;
      __mwireFeelSamplerStop?: () => void;
    };
    w.__mwireFeelHighWater = {
      captured: false,
      active: false,
      signGlowPx: 0,
      hapticScale: 0,
    };

    let stopped = false;
    const tick = () => {
      if (stopped) return;
      const game = window.__game as
        | (FlagshipGameSurface & {
            interaction?: {
              recognitionDomFeedback?: {
                active?: boolean;
                signGlowPx?: number;
                hapticScale?: number;
              };
            };
          })
        | undefined;
      const feedback = game?.interaction?.recognitionDomFeedback;
      if (feedback) {
        const active = feedback.active === true;
        const signGlowPx = feedback.signGlowPx ?? 0;
        const hapticScale = feedback.hapticScale ?? 0;
        if (!w.__mwireFeelHighWater!.captured && active && signGlowPx > 0 && hapticScale > 1) {
          w.__mwireFeelHighWater = {
            captured: true,
            active,
            signGlowPx,
            hapticScale,
          };
        }
      }
      requestAnimationFrame(tick);
    };
    w.__mwireFeelSamplerStop = () => {
      stopped = true;
    };
    requestAnimationFrame(tick);
  });
}

export async function waitForMwireRecognitionFeelWindow(
  page: Page,
  timeout: number,
): Promise<RecognitionDomFeedbackSnapshot> {
  const deadline = Date.now() + timeout;
  let observed: FeelHighWater = {
    captured: false,
    active: false,
    signGlowPx: 0,
    hapticScale: 0,
  };

  while (Date.now() < deadline) {
    const sample = await page.evaluate(
      async () =>
        new Promise<FeelHighWater>((resolve) => {
          requestAnimationFrame(() => {
            const w = window as Window & {
              __mwireFeelHighWater?: FeelHighWater;
            };
            resolve(
              w.__mwireFeelHighWater ?? {
                captured: false,
                active: false,
                signGlowPx: 0,
                hapticScale: 0,
              },
            );
          });
        }),
    );
    if (sample.captured) {
      observed = sample;
      break;
    }
  }

  if (!observed.captured) {
    throw new Error(
      "waitForMwireRecognitionFeelWindow: high-water sampler never captured a frame where "
      + "recognitionDomFeedback.active && signGlowPx > 0 && hapticScale > 1. Either the "
      + "sampler was not armed before deliverPacket ran, or the beat did not fire on the "
      + "served page.",
    );
  }

  await page.evaluate(() => {
    const w = window as Window & { __mwireFeelSamplerStop?: () => void };
    w.__mwireFeelSamplerStop?.();
  });

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
