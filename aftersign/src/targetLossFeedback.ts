export const TARGET_LOSS_FEEDBACK = Object.freeze({
  durationMs: 100,
  promptFade: 'linear',
  reticleScale: 1,
  reticleOffsetX: 0,
  reticleOffsetY: 0,
});

export type TargetLossFeedback = {
  active: boolean;
  promptOpacity: number;
  reticleScale: number;
  reticleOffsetX: number;
  reticleOffsetY: number;
};

/**
 * Target loss must clear the affordance in the frame that no target exists:
 * the prompt fades over 100ms, while the reticle immediately returns to its
 * neutral transform so a previous target cannot leave visual residue.
 */
export function targetLossFeedbackAt(elapsedMs: number): TargetLossFeedback {
  const progress = Math.min(1, Math.max(0, elapsedMs / TARGET_LOSS_FEEDBACK.durationMs));

  return {
    active: progress < 1,
    promptOpacity: 1 - progress,
    reticleScale: TARGET_LOSS_FEEDBACK.reticleScale,
    reticleOffsetX: TARGET_LOSS_FEEDBACK.reticleOffsetX,
    reticleOffsetY: TARGET_LOSS_FEEDBACK.reticleOffsetY,
  };
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

export function checkTargetLossFeedback(): void {
  const firstFrame = targetLossFeedbackAt(0);
  assertEqual(firstFrame.active, true, 'target loss begins active');
  assertEqual(firstFrame.promptOpacity, 1, 'target-loss prompt begins fully visible');
  assertEqual(firstFrame.reticleScale, 1, 'target loss resets reticle scale on the first frame');
  assertEqual(firstFrame.reticleOffsetX, 0, 'target loss resets reticle X offset on the first frame');
  assertEqual(firstFrame.reticleOffsetY, 0, 'target loss resets reticle Y offset on the first frame');

  const lastLiveFrame = targetLossFeedbackAt(99);
  assertEqual(lastLiveFrame.active, true, 'prompt remains live until its 100ms envelope ends');
  assertEqual(lastLiveFrame.promptOpacity, 0.01, 'prompt fades linearly through the final live frame');

  const settled = targetLossFeedbackAt(100);
  assertEqual(settled.active, false, 'target loss settles exactly at 100ms');
  assertEqual(settled.promptOpacity, 0, 'settled target loss leaves no stale prompt');
  assertEqual(settled.reticleScale, 1, 'settled target loss retains neutral reticle scale');
  assertEqual(settled.reticleOffsetX, 0, 'settled target loss retains neutral reticle X offset');
  assertEqual(settled.reticleOffsetY, 0, 'settled target loss retains neutral reticle Y offset');
}

export function runTargetLossFeedbackChecks(): void {
  checkTargetLossFeedback();
}
