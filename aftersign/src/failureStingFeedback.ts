// Envelope math for the failure-sting juice slice. Authored as .ts
// (not .js) so aftersign/tsconfig.json — `include: ["src"]`, no
// `allowJs` — can resolve the specifier under the blocking
// `typecheck:aftersign` gate. The sibling `.test.ts` and the
// consumer `main.js` both import this via a `.ts` specifier (Node's
// --experimental-strip-types accepts .ts paths directly; tsc under
// moduleResolution:"Bundler" + allowImportingTsExtensions accepts
// them at typecheck; vite's dev/preview + rollup build resolve them
// via esbuild), matching the four other `.ts` modules that main.js
// already consumes (orraRuntimeLane.ts, recognitionFeedbackBridge.ts,
// playerMovementFeel.ts, ioRecognitionDialogue.ts).
//
// State-vs-render contract (see failureStingFeedback.test.ts and
// main.js:1986,2009):
//   * The RENDER path reads scaled amplitudes (flashAlpha, vignette,
//     wobble-driven kicks) off THIS envelope every frame.
//   * The STATE surface (state.interaction.failureFeedback) mirrors
//     ONLY {active, remainingMs} off this envelope; the feel
//     constants (flashAlpha=0.34, durationMs=180, …) stay pinned
//     on state so the e2e's `.toBe(0.34)` assertion holds every
//     frame, not just at t=0.

export type FailureStingFeel = {
  readonly durationMs: number;
  readonly easing: string;
  readonly cameraKickDeg: number;
  readonly cameraKickWorldX: number;
  readonly hudShakePx: number;
  readonly hudDropPx: number;
  readonly flashAlpha: number;
  readonly vignetteAlpha: number;
  readonly wobbleCycles: number;
  readonly recoveryScale: number;
};

export const DEFAULT_FAILURE_STING_FEEL: FailureStingFeel = {
  durationMs: 180,
  easing: "easeOutQuad",
  cameraKickDeg: 0.9,
  cameraKickWorldX: 0.038,
  hudShakePx: 8,
  hudDropPx: 2,
  flashAlpha: 0.34,
  vignetteAlpha: 0.18,
  wobbleCycles: 5,
  recoveryScale: 0.985,
};

export type FailureStingEnvelope = {
  durationMs: number;
  easing: string;
  active: boolean;
  progress: number;
  remainingMs: number;
  falloff: number;
  wobble: number;
  cameraKickDeg: number;
  cameraKickWorldX: number;
  hudShakePx: number;
  hudDropPx: number;
  flashAlpha: number;
  vignetteAlpha: number;
  recoveryScale: number;
  cameraKickWorldXCurrent: number;
  cameraYawDegreesCurrent: number;
  hudShakeX: number;
  hudDropY: number;
};

export type FailureStingEnvelopeOptions = {
  readonly reducedMotion?: boolean;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const quantizeFrameMs = (elapsedMs: number, frameMs = 1000 / 60): number => {
  if (!Number.isFinite(elapsedMs)) {
    return elapsedMs;
  }

  // Sample at the frame boundary the renderer has actually reached, not
  // the nearest future frame. Rounding made a 180ms sting report progress=1
  // around 171.7ms, stealing the last visible frame from the failure pop.
  return Math.max(0, Math.floor(elapsedMs / frameMs) * frameMs);
};

export const failureStingEnvelopeAt = (
  elapsedMs: number,
  feel: FailureStingFeel = DEFAULT_FAILURE_STING_FEEL,
  options: FailureStingEnvelopeOptions = {},
): FailureStingEnvelope => {
  const durationMs = Math.max(1, feel.durationMs);
  const finite = Number.isFinite(elapsedMs);
  // Two clocks intentionally: the SAMPLE clock is floor-quantized so the
  // renderer reads the last-reached 60Hz frame (preserving the final
  // visible pop around ~179ms of a 180ms sting instead of snapping it
  // to progress=1 one frame early). The ENVELOPE-END clock is the raw
  // elapsedMs — `active` and the progress clamp gate on it so t=durationMs
  // still lands active=false / progress=1 / falloff=0 exactly, matching
  // the e2e contract (`.toBe(0.34)` on state, flashAlpha=0 on render).
  const sampledElapsedMs = quantizeFrameMs(elapsedMs);
  const rawProgress = finite ? clamp01(elapsedMs / durationMs) : 1;
  const sampledProgress = finite ? clamp01(sampledElapsedMs / durationMs) : 1;
  // Use the raw clamp at the boundary so falloff collapses to 0 exactly
  // at t=durationMs; otherwise use the sampled progress so mid-window
  // frames sit on real 60Hz frame boundaries.
  const progress = rawProgress >= 1 ? 1 : sampledProgress;
  const curve = 1 - ((1 - progress) ** 2);
  const falloff = 1 - curve;
  const rawWobble = falloff * Math.sin(progress * Math.PI * feel.wobbleCycles);
  const active = finite && rawProgress < 1;

  // Reduced motion keeps the acknowledgement flash and HUD drop — the
  // player still gets a crisp failure response — but removes the lateral
  // camera/HUD shake that can feel nauseating on a phone. Main's default
  // call path omits this option, so the shipped non-reduced envelope stays
  // byte-for-byte identical: 180ms, 0.038m kick, 0.9deg yaw, 8px shake.
  const motionScale = options.reducedMotion ? 0 : 1;
  const wobble = rawWobble * motionScale;
  const cameraKickWorldX = feel.cameraKickWorldX * motionScale;
  const cameraKickDeg = feel.cameraKickDeg * motionScale;
  const hudShakePx = feel.hudShakePx * motionScale;

  return {
    durationMs: feel.durationMs,
    easing: feel.easing,
    active,
    progress,
    remainingMs: active ? Math.max(0, Math.round(durationMs - sampledElapsedMs)) : 0,
    falloff,
    wobble,
    cameraKickDeg,
    cameraKickWorldX,
    hudShakePx,
    hudDropPx: feel.hudDropPx,
    flashAlpha: falloff * feel.flashAlpha,
    vignetteAlpha: falloff * feel.vignetteAlpha,
    recoveryScale: 1 - ((1 - feel.recoveryScale) * falloff),
    cameraKickWorldXCurrent: -wobble * feel.cameraKickWorldX,
    cameraYawDegreesCurrent: -wobble * feel.cameraKickDeg,
    hudShakeX: -wobble * feel.hudShakePx,
    hudDropY: falloff * feel.hudDropPx,
  };
};
