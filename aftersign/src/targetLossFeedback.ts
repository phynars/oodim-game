export const TARGET_LOSS_FEEDBACK = Object.freeze({
  durationMs: 100,
  // Opening plateau (#1751): the prompt holds at full opacity for the
  // first `holdMs` after the target-loss edge before the linear fade
  // begins. The fade envelope `1 - elapsedMs/durationMs` peaked at
  // exactly `elapsedMs === 0` — a ZERO-WIDTH crest. The served-page
  // e2e (aftersign/e2e/target-loss-feedback.spec.ts) samples
  // `getComputedStyle(#targetLossPrompt).opacity` across a 3s rAF
  // window and asserts the MAX, but on cold SwiftShader CI the game's
  // render rAF and the spec's sampler rAF race across a single
  // compositor commit: the one frame the value is `1` can fall
  // between two reads, and the observed peak collapses to 0 (the
  // #1751 flake). Giving the peak a real time window — the prompt
  // stays at opacity 1 for `holdMs`, THEN fades linearly to 0 over
  // the remaining `durationMs - holdMs` — makes the full-visibility
  // frame observable regardless of when either rAF wakes up. The
  // total envelope length (`durationMs`) and the settle point are
  // unchanged, so the player-facing "clear the affordance within
  // 100ms" contract holds; only the shape of the first ~quarter of
  // the fade changes (a brief hold instead of an instant decay).
  holdMs: 24,
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
 * the prompt holds at full opacity for `holdMs`, then fades linearly to 0
 * across the remaining envelope (`durationMs - holdMs`), while the reticle
 * immediately returns to its neutral transform so a previous target cannot
 * leave visual residue.
 *
 * The opening hold (#1751) gives the `promptOpacity === 1` peak a real time
 * window instead of a zero-width crest at `elapsedMs === 0`, so a rAF
 * sampler on cold CI can observe full visibility without racing a single
 * compositor commit.
 */
export function targetLossFeedbackAt(elapsedMs: number): TargetLossFeedback {
  const { durationMs, holdMs } = TARGET_LOSS_FEEDBACK;
  // Fade only begins after the opening hold. Denominator is the fade
  // segment length (`durationMs - holdMs`); before `holdMs` the fade
  // progress clamps to 0 (full opacity), at/after `durationMs` it
  // clamps to 1 (fully faded). Guard against a degenerate
  // `holdMs >= durationMs` (would divide by <= 0) by falling back to
  // an instant settle at the hold boundary.
  const fadeSpanMs = durationMs - holdMs;
  const decayProgress =
    fadeSpanMs > 0
      ? Math.min(1, Math.max(0, (elapsedMs - holdMs) / fadeSpanMs))
      : elapsedMs >= holdMs
        ? 1
        : 0;

  return {
    // Active for the whole authored envelope, hold + fade alike — the
    // reticle stays in its target-loss transform until the full
    // `durationMs` has elapsed, then settles.
    active: elapsedMs < durationMs,
    promptOpacity: 1 - decayProgress,
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

  // #1751: the prompt holds at full opacity for the whole opening
  // plateau — the crest is a WINDOW `[0, holdMs]`, not a single point.
  // A sample taken anywhere inside the hold still reads exactly 1.
  const holdEndFrame = targetLossFeedbackAt(TARGET_LOSS_FEEDBACK.holdMs);
  assertEqual(holdEndFrame.active, true, 'prompt is still live at the end of the opening hold');
  assertEqual(
    holdEndFrame.promptOpacity,
    1,
    'prompt stays fully visible across the opening hold plateau',
  );
  const midHoldFrame = targetLossFeedbackAt(TARGET_LOSS_FEEDBACK.holdMs / 2);
  assertEqual(
    midHoldFrame.promptOpacity,
    1,
    'prompt stays fully visible partway through the opening hold',
  );

  // Fade midpoint chosen for exact IEEE-754 representation. The fade
  // segment runs from `holdMs` (24) to `durationMs` (100), a span of
  // 76ms. Its half-fade lands at `holdMs + fadeSpan/2 = 24 + 38 = 62`,
  // where `(62 - 24) / 76 = 38/76 = 0.5` exactly, so `1 - 0.5 = 0.5`
  // survives strict `!==` in `assertEqual` (no binary-fraction drift).
  const midFrame = targetLossFeedbackAt(62);
  assertEqual(midFrame.active, true, 'prompt remains live through the fade segment');
  assertEqual(midFrame.promptOpacity, 0.5, 'prompt fades linearly to half at the fade midpoint');

  const settled = targetLossFeedbackAt(100);
  assertEqual(settled.active, false, 'target loss settles exactly at 100ms');
  assertEqual(settled.promptOpacity, 0, 'settled target loss leaves no stale prompt');
  assertEqual(settled.reticleScale, 1, 'settled target loss retains neutral reticle scale');
  assertEqual(settled.reticleOffsetX, 0, 'settled target loss retains neutral reticle X offset');
  assertEqual(settled.reticleOffsetY, 0, 'settled target loss retains neutral reticle Y offset');

  // Clamps: elapsedMs may be negative (guard window before the
  // transition frame lands) or exceed the duration (target stays
  // lost past the fade tail). The envelope is neutral outside
  // [0, durationMs] — full opacity before t=0 (inside the hold), no
  // residue beyond the settle point.
  assertEqual(
    targetLossFeedbackAt(-50).promptOpacity,
    1,
    'opacity clamps to 1 before t=0',
  );
  assertEqual(
    targetLossFeedbackAt(10_000).promptOpacity,
    0,
    'opacity stays 0 long past the fade tail',
  );
}

export function runTargetLossFeedbackChecks(): void {
  checkTargetLossFeedback();
}
