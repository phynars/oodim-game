export type AftersignNextJobOfferFeelFrame = {
  elapsedMs: number;
  progress: number;
  phase: "idle" | "wake" | "settle" | "hold";
  cameraPushMeters: number;
  cameraYawDegrees: number;
  cardLiftPx: number;
  cardScale: number;
  tagGlowAlpha: number;
  bloomGain: number;
  vignetteAlpha: number;
  audioDuckDb: number;
  hapticMs: number;
};

export type AftersignNextJobOfferFeel = {
  durationMs: number;
  wakeMs: number;
  settleMs: number;
  cameraPushMeters: number;
  cameraYawDegrees: number;
  cardLiftPx: number;
  cardOverscale: number;
  tagGlowAlpha: number;
  bloomGain: number;
  vignetteAlpha: number;
  audioDuckDb: number;
  hapticMs: number;
};

export type AftersignNextJobOfferFeelOptions = {
  elapsedMs: number;
  reducedMotion?: boolean;
  feel?: AftersignNextJobOfferFeel;
};

export const AFTERSIGN_NEXT_JOB_OFFER_FEEL: AftersignNextJobOfferFeel = {
  durationMs: 640,
  wakeMs: 180,
  settleMs: 360,
  cameraPushMeters: 0.1,
  cameraYawDegrees: 1.2,
  cardLiftPx: 9,
  cardOverscale: 0.026,
  tagGlowAlpha: 0.28,
  bloomGain: 0.16,
  vignetteAlpha: 0.12,
  audioDuckDb: -4,
  hapticMs: 12,
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);

const easeOutBackSoft = (t: number): number => {
  const clamped = clamp01(t);
  const c1 = 1.35;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(clamped - 1, 3) + c1 * Math.pow(clamped - 1, 2);
};

const easeInOutQuad = (t: number): number => {
  const clamped = clamp01(t);
  return clamped < 0.5 ? 2 * clamped * clamped : 1 - Math.pow(-2 * clamped + 2, 2) / 2;
};

export const getAftersignNextJobOfferFeel = ({
  elapsedMs,
  reducedMotion = false,
  feel = AFTERSIGN_NEXT_JOB_OFFER_FEEL,
}: AftersignNextJobOfferFeelOptions): AftersignNextJobOfferFeelFrame => {
  const safeElapsed = Math.max(0, elapsedMs);
  const progress = clamp01(safeElapsed / feel.durationMs);
  const wakeProgress = clamp01(safeElapsed / feel.wakeMs);
  const settleProgress = clamp01((safeElapsed - feel.wakeMs) / feel.settleMs);
  const holdProgress = clamp01((safeElapsed - feel.wakeMs - feel.settleMs) / Math.max(1, feel.durationMs - feel.wakeMs - feel.settleMs));

  const phase: AftersignNextJobOfferFeelFrame["phase"] =
    safeElapsed <= 0
      ? "idle"
      : safeElapsed < feel.wakeMs
        ? "wake"
        : safeElapsed < feel.wakeMs + feel.settleMs
          ? "settle"
          : "hold";

  const wake = easeOutBackSoft(wakeProgress);
  const settle = 1 - easeInOutQuad(settleProgress);
  const tail = 1 - easeOutCubic(holdProgress);
  // Idle is TRULY dormant — nothing has fired yet, so no motion or
  // glow leaks into the frame. Prior draft used the else-branch
  // (`tail * 0.18`) which — with holdProgress=0 → tail=1 — bled
  // 18% of the base amplitude into `t=0`, contradicting the phase
  // label. Explicit idle→0 keeps the contract honest.
  const isIdle = phase === "idle";
  const visualEnvelope = isIdle
    ? 0
    : phase === "wake"
      ? wake
      : phase === "settle"
        ? settle
        : tail * 0.18;
  const glowEnvelope = isIdle
    ? 0
    : phase === "wake"
      ? easeOutCubic(wakeProgress)
      : phase === "settle"
        ? settle
        : tail * 0.42;

  if (reducedMotion) {
    return {
      elapsedMs: safeElapsed,
      progress,
      phase,
      cameraPushMeters: 0,
      cameraYawDegrees: 0,
      cardLiftPx: 0,
      cardScale: 1,
      tagGlowAlpha: feel.tagGlowAlpha * glowEnvelope,
      bloomGain: feel.bloomGain * 0.45 * glowEnvelope,
      vignetteAlpha: feel.vignetteAlpha * 0.5 * glowEnvelope,
      audioDuckDb: phase === "idle" ? 0 : feel.audioDuckDb * glowEnvelope,
      hapticMs: 0,
    };
  }

  return {
    elapsedMs: safeElapsed,
    progress,
    phase,
    cameraPushMeters: feel.cameraPushMeters * visualEnvelope,
    cameraYawDegrees: feel.cameraYawDegrees * visualEnvelope,
    cardLiftPx: feel.cardLiftPx * visualEnvelope,
    cardScale: 1 + feel.cardOverscale * visualEnvelope,
    tagGlowAlpha: feel.tagGlowAlpha * glowEnvelope,
    bloomGain: feel.bloomGain * glowEnvelope,
    vignetteAlpha: feel.vignetteAlpha * glowEnvelope,
    audioDuckDb: phase === "idle" ? 0 : feel.audioDuckDb * glowEnvelope,
    hapticMs: phase === "wake" && wakeProgress < 0.08 ? feel.hapticMs : 0,
  };
};
