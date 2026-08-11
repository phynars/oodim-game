import type { Page } from "@playwright/test";

import type { FlagshipGameSurface } from "../../e2e-shared/flagshipStoryStateContract";

export type RecognitionDomFeedbackSnapshot = {
  active: boolean;
  signGlowPx: number;
  hapticScale: number;
};

export async function waitForMwireRecognitionFeelWindow(
  page: Page,
  timeout: number,
): Promise<RecognitionDomFeedbackSnapshot> {
  await page.waitForFunction(
    () => {
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
      return (
        feedback?.active === true &&
        (feedback.signGlowPx ?? 0) > 0 &&
        (feedback.hapticScale ?? 0) > 1
      );
    },
    undefined,
    { timeout },
  );

  return page.evaluate(() => {
    const game = window.__game as unknown as {
      interaction?: { recognitionDomFeedback?: RecognitionDomFeedbackSnapshot };
    };
    return game.interaction?.recognitionDomFeedback as RecognitionDomFeedbackSnapshot;
  });
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
