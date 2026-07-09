export type FailureStingPhase = "impact" | "recoil" | "settle" | "done";

export interface FailureStingFrame {
  elapsedMs: number;
  phase: FailureStingPhase;
  cameraShakePx: number;
  cameraYawDeg: number;
  vignetteAlpha: number;
  chromaPx: number;
  lowPassHz: number;
  heartbeatGain: number;
  promptNudgePx: number;
}

export interface FailureStingCue {
  atMs: number;
  kind: "audio" | "visual" | "haptic";
  id: string;
  value: number;
}

export interface FailureStingContract {
  durationMs: number;
  impactMs: number;
  recoilMs: number;
  settleMs: number;
  maxShakePx: number;
  maxYawDeg: number;
  maxVignetteAlpha: number;
  maxChromaPx: number;
  minLowPassHz: number;
  maxPromptNudgePx: number;
  cues: FailureStingCue[];
}

export const FAILURE_STING_CONTRACT: FailureStingContract = {
  durationMs: 640,
  impactMs: 80,
  recoilMs: 260,
  settleMs: 640,
  maxShakePx: 7,
  maxYawDeg: 1.4,
  maxVignetteAlpha: 0.42,
  maxChromaPx: 2.5,
  minLowPassHz: 720,
  maxPromptNudgePx: 18,
  cues: [
    { atMs: 0, kind: "audio", id: "failure-thud", value: 0.86 },
    { atMs: 16, kind: "haptic", id: "soft-bump", value: 0.38 },
    { atMs: 72, kind: "visual", id: "prompt-rebound", value: 1 },
    { atMs: 180, kind: "audio", id: "breath-return", value: 0.32 },
  ],
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);
const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const k = clamp01(t) - 1;
  return 1 + c3 * k * k * k + c1 * k * k;
};

const dampedKick = (elapsedMs: number, durationMs: number): number => {
  const t = clamp01(elapsedMs / durationMs);
  return Math.sin(t * Math.PI * 2.7) * Math.pow(1 - t, 2.15);
};

export function sampleFailureSting(
  elapsedMs: number,
  contract: FailureStingContract = FAILURE_STING_CONTRACT,
): FailureStingFrame {
  const t = clamp01(elapsedMs / contract.durationMs);
  const impactT = clamp01(elapsedMs / contract.impactMs);
  const recoilT = clamp01((elapsedMs - contract.impactMs) / (contract.recoilMs - contract.impactMs));
  const settleT = clamp01((elapsedMs - contract.recoilMs) / (contract.settleMs - contract.recoilMs));
  const kick = dampedKick(elapsedMs, contract.durationMs);
  const recoil = 1 - easeOutCubic(recoilT);
  const settle = 1 - easeOutCubic(settleT);

  const phase: FailureStingPhase =
    elapsedMs >= contract.durationMs
      ? "done"
      : elapsedMs < contract.impactMs
        ? "impact"
        : elapsedMs < contract.recoilMs
          ? "recoil"
          : "settle";

  return {
    elapsedMs,
    phase,
    cameraShakePx: phase === "done" ? 0 : contract.maxShakePx * Math.abs(kick),
    cameraYawDeg: phase === "done" ? 0 : contract.maxYawDeg * kick,
    vignetteAlpha:
      phase === "done"
        ? 0
        : contract.maxVignetteAlpha * Math.max(1 - easeOutCubic(t), 0.18 * settle),
    chromaPx: phase === "done" ? 0 : contract.maxChromaPx * Math.max(1 - easeOutCubic(impactT), 0.25 * recoil),
    lowPassHz:
      phase === "done"
        ? 22050
        : contract.minLowPassHz + (22050 - contract.minLowPassHz) * easeOutCubic(t),
    heartbeatGain: phase === "done" ? 0 : 0.52 * Math.max(1 - easeOutCubic(t), 0.12 * settle),
    promptNudgePx:
      phase === "done"
        ? 0
        : contract.maxPromptNudgePx * (1 - easeOutBack(recoilT)) * (1 - settleT),
  };
}

export function cuesDueBetween(
  previousElapsedMs: number,
  nextElapsedMs: number,
  contract: FailureStingContract = FAILURE_STING_CONTRACT,
): FailureStingCue[] {
  return contract.cues.filter((cue) => cue.atMs > previousElapsedMs && cue.atMs <= nextElapsedMs);
}

export function runFailureStingSelfCheck(): void {
  const start = sampleFailureSting(0);
  const impact = sampleFailureSting(64);
  const recoil = sampleFailureSting(180);
  const done = sampleFailureSting(640);

  if (start.phase !== "impact" || start.vignetteAlpha < 0.4) {
    throw new Error("failure sting must begin with a strong impact vignette");
  }

  if (impact.cameraShakePx > FAILURE_STING_CONTRACT.maxShakePx || Math.abs(impact.cameraYawDeg) > FAILURE_STING_CONTRACT.maxYawDeg) {
    throw new Error("failure sting camera impulse exceeded contract bounds");
  }

  if (recoil.phase !== "recoil" || recoil.lowPassHz <= impact.lowPassHz) {
    throw new Error("failure sting recoil must restore audio brightness over time");
  }

  if (done.phase !== "done" || done.cameraShakePx !== 0 || done.heartbeatGain !== 0 || done.lowPassHz !== 22050) {
    throw new Error("failure sting must fully settle by 640ms");
  }

  const cues = cuesDueBetween(-1, 80).map((cue) => cue.id);
  if (cues.join(",") !== "failure-thud,soft-bump,prompt-rebound") {
    throw new Error("failure sting cues must stay frame-addressable and ordered");
  }
}
