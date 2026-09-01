export type AftersignJobRiskTone = "safe" | "risky" | "consequence";

export interface AftersignJobOfferActionFeel {
  readonly durationMs: number;
  readonly liftPx: number;
  readonly pressScale: number;
  readonly glowAlpha: number;
  readonly borderPulsePx: number;
  readonly easing: string;
  readonly audioCue: "soft-confirm" | "risk-chime" | "debt-thrum";
}

export const AFTERSIGN_JOB_OFFER_ACTION_FEEL: Record<AftersignJobRiskTone, AftersignJobOfferActionFeel> = {
  safe: {
    durationMs: 220,
    liftPx: 4,
    pressScale: 0.985,
    glowAlpha: 0.18,
    borderPulsePx: 1,
    easing: "cubic-bezier(.2,.8,.2,1)",
    audioCue: "soft-confirm",
  },
  risky: {
    durationMs: 280,
    liftPx: 6,
    pressScale: 0.975,
    glowAlpha: 0.26,
    borderPulsePx: 2,
    easing: "cubic-bezier(.16,1,.3,1)",
    audioCue: "risk-chime",
  },
  consequence: {
    durationMs: 340,
    liftPx: 5,
    pressScale: 0.98,
    glowAlpha: 0.32,
    borderPulsePx: 3,
    easing: "cubic-bezier(.34,1.56,.64,1)",
    audioCue: "debt-thrum",
  },
};

export interface AftersignJobOfferActionFeelAttributes {
  readonly "data-aftersign-job-risk": AftersignJobRiskTone;
  readonly "data-aftersign-feel-duration-ms": string;
  readonly "data-aftersign-feel-lift-px": string;
  readonly "data-aftersign-feel-press-scale": string;
  readonly "data-aftersign-feel-glow-alpha": string;
  readonly "data-aftersign-feel-border-pulse-px": string;
  readonly "data-aftersign-feel-easing": string;
  readonly "data-aftersign-feel-audio-cue": AftersignJobOfferActionFeel["audioCue"];
}

export function resolveAftersignJobOfferActionFeel(
  risk: AftersignJobRiskTone,
): AftersignJobOfferActionFeel {
  return AFTERSIGN_JOB_OFFER_ACTION_FEEL[risk];
}

export function getAftersignJobOfferActionFeelAttributes(
  risk: AftersignJobRiskTone,
): AftersignJobOfferActionFeelAttributes {
  const feel = resolveAftersignJobOfferActionFeel(risk);

  return {
    "data-aftersign-job-risk": risk,
    "data-aftersign-feel-duration-ms": String(feel.durationMs),
    "data-aftersign-feel-lift-px": String(feel.liftPx),
    "data-aftersign-feel-press-scale": String(feel.pressScale),
    "data-aftersign-feel-glow-alpha": String(feel.glowAlpha),
    "data-aftersign-feel-border-pulse-px": String(feel.borderPulsePx),
    "data-aftersign-feel-easing": feel.easing,
    "data-aftersign-feel-audio-cue": feel.audioCue,
  };
}
