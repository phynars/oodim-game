export type PacketChoiceIntent = "seal" | "open";
export type PacketChoicePhase = "idle" | "preview" | "committed" | "cancelled";

export interface PacketChoiceCommitConfig {
  frameMs: number;
  previewDelayMs: number;
  commitHoldMs: number;
  cancelGraceMs: number;
  maxVisualLeadMs: number;
}

export interface PacketChoiceCommitSample {
  tMs: number;
  phase: PacketChoicePhase;
  intent: PacketChoiceIntent | null;
  previewAlpha: number;
  commitProgress: number;
  committed: boolean;
  cancelled: boolean;
}

export const DEFAULT_PACKET_CHOICE_COMMIT_CONFIG: PacketChoiceCommitConfig = {
  frameMs: 1000 / 60,
  previewDelayMs: 50,
  commitHoldMs: 180,
  cancelGraceMs: 100,
  maxVisualLeadMs: 50,
};

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function easeOutQuad(value: number): number {
  const clamped = clamp01(value);
  return 1 - (1 - clamped) * (1 - clamped);
}

export interface SamplePacketChoiceCommitOptions {
  intent?: PacketChoiceIntent | null;
  heldMs?: number;
  releasedMs?: number | null;
  config?: PacketChoiceCommitConfig;
}

export function samplePacketChoiceCommitFeel(
  tMs: number,
  options: SamplePacketChoiceCommitOptions = {},
): PacketChoiceCommitSample {
  const config = options.config ?? DEFAULT_PACKET_CHOICE_COMMIT_CONFIG;
  const intent = options.intent ?? null;
  const heldMs = Math.max(0, options.heldMs ?? tMs);
  const releasedMs = options.releasedMs ?? null;

  if (!intent) {
    return {
      tMs,
      phase: "idle",
      intent: null,
      previewAlpha: 0,
      commitProgress: 0,
      committed: false,
      cancelled: false,
    };
  }

  const committed = heldMs >= config.commitHoldMs;
  const cancelled =
    !committed && releasedMs !== null && releasedMs <= config.cancelGraceMs;
  const previewAlpha = easeOutQuad((heldMs - config.previewDelayMs) / config.maxVisualLeadMs);
  const commitProgress = clamp01(heldMs / config.commitHoldMs);

  let phase: PacketChoicePhase = "preview";
  if (committed) {
    phase = "committed";
  } else if (cancelled) {
    phase = "cancelled";
  }

  return {
    tMs,
    phase,
    intent,
    previewAlpha,
    commitProgress,
    committed,
    cancelled,
  };
}

function assertPacketChoice(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function checkPacketChoiceNoFirstFrameCommit(
  config: PacketChoiceCommitConfig = DEFAULT_PACKET_CHOICE_COMMIT_CONFIG,
): void {
  const firstFrame = samplePacketChoiceCommitFeel(config.frameMs, {
    intent: "seal",
    heldMs: config.frameMs,
    config,
  });

  assertPacketChoice(
    firstFrame.phase === "preview",
    "Packet choice must preview, not commit, on the first frame",
  );
  assertPacketChoice(
    !firstFrame.committed,
    "Packet choice must not commit from a single-frame tap",
  );
  assertPacketChoice(
    firstFrame.previewAlpha === 0,
    "Packet choice preview must not visually lead the player's held intent before previewDelayMs",
  );
}

export function checkPacketChoicePreviewBeforeCommit(
  config: PacketChoiceCommitConfig = DEFAULT_PACKET_CHOICE_COMMIT_CONFIG,
): void {
  const preview = samplePacketChoiceCommitFeel(
    config.previewDelayMs + config.maxVisualLeadMs,
    {
      intent: "open",
      heldMs: config.previewDelayMs + config.maxVisualLeadMs,
      config,
    },
  );

  assertPacketChoice(
    preview.phase === "preview",
    "Packet choice must still be previewing before the hold crosses commitHoldMs",
  );
  assertPacketChoice(
    preview.previewAlpha >= 0.95,
    "Packet choice preview must become readable before commit",
  );
  assertPacketChoice(
    preview.commitProgress < 1,
    "Packet choice preview must not imply commitment before commitHoldMs",
  );
}

export function checkPacketChoiceCommitAtHoldBudget(
  config: PacketChoiceCommitConfig = DEFAULT_PACKET_CHOICE_COMMIT_CONFIG,
): void {
  const committed = samplePacketChoiceCommitFeel(config.commitHoldMs, {
    intent: "seal",
    heldMs: config.commitHoldMs,
    config,
  });

  assertPacketChoice(
    committed.phase === "committed",
    "Packet choice must commit exactly when the hold reaches commitHoldMs",
  );
  assertPacketChoice(committed.committed, "Packet choice commit flag must be set at commitHoldMs");
  assertPacketChoice(
    committed.commitProgress === 1,
    "Packet choice commit progress must be complete at commitHoldMs",
  );
}

export function checkPacketChoiceTapCancelGrace(
  config: PacketChoiceCommitConfig = DEFAULT_PACKET_CHOICE_COMMIT_CONFIG,
): void {
  const cancelled = samplePacketChoiceCommitFeel(config.cancelGraceMs, {
    intent: "open",
    heldMs: config.cancelGraceMs,
    releasedMs: config.cancelGraceMs,
    config,
  });

  assertPacketChoice(
    cancelled.phase === "cancelled",
    "Packet choice must cancel a release inside cancelGraceMs",
  );
  assertPacketChoice(!cancelled.committed, "Packet choice cancel grace must not commit");
  assertPacketChoice(cancelled.cancelled, "Packet choice cancel flag must be set during grace release");
}

export function runPacketChoiceCommitFeelChecks(
  config: PacketChoiceCommitConfig = DEFAULT_PACKET_CHOICE_COMMIT_CONFIG,
): void {
  checkPacketChoiceNoFirstFrameCommit(config);
  checkPacketChoicePreviewBeforeCommit(config);
  checkPacketChoiceCommitAtHoldBudget(config);
  checkPacketChoiceTapCancelGrace(config);
}
