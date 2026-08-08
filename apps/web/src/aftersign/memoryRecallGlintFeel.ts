/**
 * Sub-envelope layered on top of `MEMORY_RECALL_FEEL` — a short specular
 * shimmer that streaks left→right across the recognized NPC's caption/
 * halo during the recall beat. This is NOT a competing recall envelope
 * (the harness's `recallFeel` is still the canonical beat driver); it's
 * an additional visual pass the renderer composites over the frame the
 * beat already produces.
 *
 * To avoid the "two sources of truth for one beat" drift (#1069 review),
 * the glint's `durationMs` and `cameraYawDegrees` MUST equal the wired
 * `MEMORY_RECALL_FEEL.durationMs` / `.cameraYawDeg`. We inline the
 * numbers here (rather than import from `./memoryRecallFeel`) because
 * `memoryRecallFeel.ts` composes THIS module into its frame — a live
 * import would form a cycle at module init. The invariant is guarded
 * at runtime by the contract test in
 * `memoryRecallGlintFeel.contract.test.ts`, which asserts equality
 * against the imported `MEMORY_RECALL_FEEL` object.
 *
 * The remaining knobs (glint travel, width, opacity, bloom lift, audio
 * duck) are the shimmer's own detail and have no counterpart in
 * `MEMORY_RECALL_FEEL`.
 */
export type AftersignMemoryRecallGlintFeel = {
  readonly durationMs: number;
  readonly glintLeadMs: number;
  readonly glintTravelPx: number;
  readonly glintWidthPx: number;
  readonly maxOpacity: number;
  readonly bloomLift: number;
  readonly audioDuckDb: number;
  readonly audioDuckHoldMs: number;
  readonly cameraDollyCm: number;
  readonly cameraYawDegrees: number;
  readonly easing: "cubic-bezier(.16,1,.3,1)";
};

export type AftersignMemoryRecallGlintEnvelope = {
  readonly progress: number;
  readonly glintProgress: number;
  readonly glintOffsetPx: number;
  readonly glintWidthPx: number;
  readonly opacity: number;
  readonly bloomLift: number;
  readonly audioDuckDb: number;
  readonly cameraDollyCm: number;
  readonly cameraYawDegrees: number;
};

export const AFTERSIGN_MEMORY_RECALL_GLINT_FEEL = {
  // MUST equal MEMORY_RECALL_FEEL.durationMs — invariant guarded in
  // the contract test (see file docblock).
  durationMs: 760,
  glintLeadMs: 120,
  glintTravelPx: 72,
  glintWidthPx: 18,
  maxOpacity: 0.28,
  bloomLift: 0.14,
  audioDuckDb: -3,
  audioDuckHoldMs: 180,
  cameraDollyCm: 6,
  // MUST equal MEMORY_RECALL_FEEL.cameraYawDeg — the glint does not
  // add its own yaw budget on top; it inherits the beat's ceiling.
  cameraYawDegrees: 1.6,
  easing: "cubic-bezier(.16,1,.3,1)",
} as const satisfies AftersignMemoryRecallGlintFeel;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const easeOutExpoSoft = (t: number): number => {
  const clamped = clamp01(t);
  return clamped === 1 ? 1 : 1 - Math.pow(2, -8 * clamped);
};

const triangle = (t: number): number => {
  const clamped = clamp01(t);
  return 1 - Math.abs(clamped * 2 - 1);
};

export function resolveAftersignMemoryRecallGlintEnvelope(
  elapsedMs: number,
  feel: AftersignMemoryRecallGlintFeel = AFTERSIGN_MEMORY_RECALL_GLINT_FEEL,
): AftersignMemoryRecallGlintEnvelope {
  const progress = clamp01(elapsedMs / feel.durationMs);
  const glintProgress = clamp01(
    (elapsedMs - feel.glintLeadMs) / (feel.durationMs - feel.glintLeadMs),
  );
  const easedProgress = easeOutExpoSoft(progress);
  const easedGlintProgress = easeOutExpoSoft(glintProgress);
  const pulse = triangle(glintProgress);
  const duckProgress = clamp01(elapsedMs / feel.audioDuckHoldMs);

  return {
    progress,
    glintProgress,
    glintOffsetPx: Math.round((easedGlintProgress - 0.5) * feel.glintTravelPx),
    glintWidthPx: feel.glintWidthPx,
    opacity: Number((feel.maxOpacity * pulse).toFixed(3)),
    bloomLift: Number((feel.bloomLift * pulse).toFixed(3)),
    audioDuckDb: Number((feel.audioDuckDb * (1 - duckProgress)).toFixed(3)),
    cameraDollyCm: Number((feel.cameraDollyCm * (1 - easedProgress)).toFixed(3)),
    cameraYawDegrees: Number((feel.cameraYawDegrees * (1 - easedProgress)).toFixed(3)),
  };
}
