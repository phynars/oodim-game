export const AFTERSIGN_JOB_TAKE_FEEL = Object.freeze({
  kind: "aftersign-job-take",
  durationMs: 420,
  holdMs: 96,
  travelPx: 14,
  scaleFrom: 0.97,
  scalePeak: 1.025,
  settleScale: 1,
  glowPeakOpacity: 0.72,
  glowSettleOpacity: 0,
  shadowLiftPx: 6,
  easing: {
    press: "cubic-bezier(0.2, 0.9, 0.25, 1)",
    release: "cubic-bezier(0.16, 1, 0.3, 1)",
    glow: "cubic-bezier(0.22, 1, 0.36, 1)",
  },
  audio: {
    cue: "job-tag-catch",
    startMs: 18,
    peakMs: 96,
  },
});

export function resolveAftersignJobTakeFeel({ actionId, route, risk } = {}) {
  const safeActionId = typeof actionId === "string" && actionId.length > 0
    ? actionId
    : "take-job-unknown";
  return {
    ...AFTERSIGN_JOB_TAKE_FEEL,
    actionId: safeActionId,
    ariaLabel: `Accepted ${safeActionId.replace(/^take-job-/, "").replaceAll("-", " ")}`,
    route: typeof route === "string" ? route : "",
    risk: typeof risk === "string" ? risk : "",
  };
}
