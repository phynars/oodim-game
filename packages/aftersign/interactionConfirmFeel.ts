export type InteractionConfirmStage = "press" | "hold" | "commit" | "settle";

export interface InteractionConfirmKeyframe {
  readonly stage: InteractionConfirmStage;
  readonly atMs: number;
  readonly scale: number;
  readonly liftPx: number;
  readonly glowAlpha: number;
  readonly sound: "none" | "tap-tick" | "confirm-chime";
}

export interface InteractionConfirmFeelContract {
  readonly totalMs: number;
  readonly easing: "cubic-bezier(0.16, 1, 0.3, 1)";
  readonly maxPressScale: number;
  readonly maxLiftPx: number;
  readonly maxGlowAlpha: number;
  readonly keyframes: readonly InteractionConfirmKeyframe[];
}

export const interactionConfirmFeel: InteractionConfirmFeelContract = {
  totalMs: 180,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
  maxPressScale: 0.94,
  maxLiftPx: 6,
  maxGlowAlpha: 0.72,
  keyframes: [
    {
      stage: "press",
      atMs: 0,
      scale: 0.94,
      liftPx: -1,
      glowAlpha: 0.24,
      sound: "tap-tick",
    },
    {
      stage: "hold",
      atMs: 48,
      scale: 0.98,
      liftPx: 2,
      glowAlpha: 0.48,
      sound: "none",
    },
    {
      stage: "commit",
      atMs: 96,
      scale: 1.035,
      liftPx: 6,
      glowAlpha: 0.72,
      sound: "confirm-chime",
    },
    {
      stage: "settle",
      atMs: 180,
      scale: 1,
      liftPx: 0,
      glowAlpha: 0,
      sound: "none",
    },
  ],
};

export function assertInteractionConfirmFeelContract(
  contract: InteractionConfirmFeelContract = interactionConfirmFeel,
): void {
  if (contract.totalMs !== 180) {
    throw new Error(`interaction confirm must settle in 180ms, got ${contract.totalMs}ms`);
  }

  if (contract.easing !== "cubic-bezier(0.16, 1, 0.3, 1)") {
    throw new Error(`interaction confirm easing drifted: ${contract.easing}`);
  }

  const stages = contract.keyframes.map((frame) => frame.stage).join(",");
  if (stages !== "press,hold,commit,settle") {
    throw new Error(`interaction confirm stage order drifted: ${stages}`);
  }

  const commit = contract.keyframes.find((frame) => frame.stage === "commit");
  if (!commit) {
    throw new Error("interaction confirm is missing its commit keyframe");
  }

  if (commit.atMs !== 96 || commit.scale !== 1.035 || commit.liftPx !== 6) {
    throw new Error(
      `interaction confirm commit drifted: ${commit.atMs}ms scale=${commit.scale} lift=${commit.liftPx}px`,
    );
  }

  if (commit.sound !== "confirm-chime" || commit.glowAlpha !== 0.72) {
    throw new Error(
      `interaction confirm audiovisual coupling drifted: sound=${commit.sound} glow=${commit.glowAlpha}`,
    );
  }
}
