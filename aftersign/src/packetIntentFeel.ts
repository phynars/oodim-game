export type PacketIntentChoice = "sealed" | "opened";

export interface PacketIntentFeelConfig {
  readonly openHoldMs: number;
  readonly keepTapMaxMs: number;
  readonly cancelDriftMeters: number;
  readonly frameBudgetMs: number;
}

export interface PacketIntentSample {
  readonly heldMs: number;
  readonly driftMeters: number;
}

export interface PacketIntentFeedback {
  readonly choice: PacketIntentChoice;
  readonly progress: number;
  readonly committed: boolean;
  readonly frameBudgetOk: boolean;
}

export const DEFAULT_PACKET_INTENT_FEEL: PacketIntentFeelConfig = {
  openHoldMs: 420,
  keepTapMaxMs: 180,
  cancelDriftMeters: 0.22,
  frameBudgetMs: 16.67,
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export function resolvePacketIntent(
  sample: PacketIntentSample,
  config: PacketIntentFeelConfig = DEFAULT_PACKET_INTENT_FEEL,
): PacketIntentFeedback {
  const progress = clamp01(sample.heldMs / config.openHoldMs);
  const driftCancelled = sample.driftMeters > config.cancelDriftMeters;
  const opened = !driftCancelled && sample.heldMs >= config.openHoldMs;

  return {
    choice: opened ? "opened" : "sealed",
    progress: driftCancelled ? 0 : progress,
    committed: opened || sample.heldMs <= config.keepTapMaxMs,
    frameBudgetOk: config.frameBudgetMs <= 16.67,
  };
}

function assertPacketIntent(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`packet intent feel: ${message}`);
  }
}

export function checkPacketIntentFeel(): void {
  const tap = resolvePacketIntent({ heldMs: 90, driftMeters: 0 });
  assertPacketIntent(tap.choice === "sealed", "quick tap must preserve the packet seal");
  assertPacketIntent(tap.committed, "quick preserve action must commit immediately");
  assertPacketIntent(tap.progress > 0 && tap.progress < 1, "quick tap should expose partial hold feedback");

  const deliberateHold = resolvePacketIntent({ heldMs: DEFAULT_PACKET_INTENT_FEEL.openHoldMs, driftMeters: 0.02 });
  assertPacketIntent(deliberateHold.choice === "opened", "opening must require a completed deliberate hold");
  assertPacketIntent(deliberateHold.progress === 1, "completed hold must reach full feedback progress");

  const driftedHold = resolvePacketIntent({ heldMs: DEFAULT_PACKET_INTENT_FEEL.openHoldMs + 120, driftMeters: 0.5 });
  assertPacketIntent(driftedHold.choice === "sealed", "movement drift must cancel accidental opening");
  assertPacketIntent(driftedHold.progress === 0, "cancelled hold must clear feedback progress");

  assertPacketIntent(tap.frameBudgetOk && deliberateHold.frameBudgetOk && driftedHold.frameBudgetOk, "packet intent model must stay inside one 60Hz frame budget");
}

export function runPacketIntentFeelChecks(): void {
  checkPacketIntentFeel();
}
