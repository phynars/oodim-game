export type PacketChoice = "sealed" | "opened";

export type PacketIntentPhase =
  | "idle"
  | "pressing"
  | "committed"
  | "cancelled";

export type PacketIntentSample = {
  phase: PacketIntentPhase;
  choice: PacketChoice | null;
  progress: number;
  elapsedMs: number;
  remainingMs: number;
  feedback: {
    ringOpacity: number;
    sealGlow: number;
    paperTension: number;
    hapticPulse: boolean;
  };
};

export type PacketIntentOptions = {
  holdMs?: number;
  cancelBelow?: number;
};

const DEFAULT_HOLD_MS = 420;
const DEFAULT_CANCEL_BELOW = 0.34;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number): number {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
}

function resolveHoldMs(options?: PacketIntentOptions): number {
  const holdMs = options?.holdMs ?? DEFAULT_HOLD_MS;
  return Number.isFinite(holdMs) && holdMs > 0 ? holdMs : DEFAULT_HOLD_MS;
}

function resolveCancelBelow(options?: PacketIntentOptions): number {
  const cancelBelow = options?.cancelBelow ?? DEFAULT_CANCEL_BELOW;
  return clamp01(cancelBelow);
}

export function samplePacketIntentHold(
  heldMs: number,
  options?: PacketIntentOptions,
): PacketIntentSample {
  const holdMs = resolveHoldMs(options);
  const elapsedMs = Math.max(0, Number.isFinite(heldMs) ? heldMs : 0);
  const progress = clamp01(elapsedMs / holdMs);
  const eased = smoothstep(progress);
  const committed = progress >= 1;

  return {
    phase: committed ? "committed" : progress > 0 ? "pressing" : "idle",
    choice: committed ? "opened" : null,
    progress,
    elapsedMs,
    remainingMs: Math.max(0, holdMs - elapsedMs),
    feedback: {
      ringOpacity: eased,
      sealGlow: 0.18 + eased * 0.82,
      paperTension: smoothstep(progress * 0.92),
      hapticPulse: committed,
    },
  };
}

export function releasePacketIntentHold(
  heldMs: number,
  options?: PacketIntentOptions,
): PacketIntentSample {
  const sample = samplePacketIntentHold(heldMs, options);
  if (sample.phase === "committed") {
    return sample;
  }

  const cancelBelow = resolveCancelBelow(options);
  const keepIntentional = sample.progress <= cancelBelow;

  return {
    ...sample,
    phase: "cancelled",
    choice: keepIntentional ? "sealed" : null,
    feedback: {
      ...sample.feedback,
      hapticPulse: false,
    },
  };
}

export function assertPacketIntent(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

export function checkPacketIntentModel(): void {
  const start = samplePacketIntentHold(0);
  assertPacketIntent(start.phase === "idle", "packet starts idle");
  assertPacketIntent(start.choice === null, "packet starts without a choice");
  assertPacketIntent(start.feedback.sealGlow > 0, "sealed packet is visible before input");

  const brushing = releasePacketIntentHold(90);
  assertPacketIntent(brushing.phase === "cancelled", "short release cancels the hold");
  assertPacketIntent(brushing.choice === "sealed", "short release intentionally preserves the seal");
  assertPacketIntent(!brushing.feedback.hapticPulse, "cancelled hold does not fire commit haptics");

  const uncertain = releasePacketIntentHold(230);
  assertPacketIntent(uncertain.phase === "cancelled", "mid release cancels instead of opening by accident");
  assertPacketIntent(uncertain.choice === null, "mid release demands a clearer packet choice");

  const almost = samplePacketIntentHold(419);
  assertPacketIntent(almost.phase === "pressing", "packet does not open before the full hold");
  assertPacketIntent(almost.choice === null, "pre-threshold hold has no opened outcome");
  assertPacketIntent(!almost.feedback.hapticPulse, "pre-threshold hold has no commit pulse");

  const opened = samplePacketIntentHold(420);
  assertPacketIntent(opened.phase === "committed", "full hold commits the packet open");
  assertPacketIntent(opened.choice === "opened", "full hold records opened choice");
  assertPacketIntent(opened.progress === 1, "committed hold reaches full progress");
  assertPacketIntent(opened.remainingMs === 0, "committed hold has no remaining time");
  assertPacketIntent(opened.feedback.hapticPulse, "opened packet fires exactly one commit pulse sample");
}

export function runPacketIntentChecks(): void {
  checkPacketIntentModel();
}
