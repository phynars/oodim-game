export type PacketIntentAction = "hold" | "drag" | "press" | "release";

export interface PacketIntentSample {
  readonly action: PacketIntentAction;
  readonly timeMs: number;
  readonly x: number;
  readonly y: number;
}

export interface PacketIntentThresholds {
  readonly preserveHoldMs: number;
  readonly openHoldMs: number;
  readonly openDragPx: number;
  readonly cancelDriftPx: number;
}

export interface PacketIntentResult {
  readonly intent: "preserve" | "open" | "cancel";
  readonly elapsedMs: number;
  readonly dragPx: number;
  readonly reason: string;
}

export const DEFAULT_PACKET_INTENT_THRESHOLDS: PacketIntentThresholds = {
  preserveHoldMs: 180,
  openHoldMs: 420,
  openDragPx: 42,
  cancelDriftPx: 96,
};

function distance(a: PacketIntentSample, b: PacketIntentSample): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

export function evaluatePacketIntent(
  samples: readonly PacketIntentSample[],
  thresholds: PacketIntentThresholds = DEFAULT_PACKET_INTENT_THRESHOLDS,
): PacketIntentResult {
  if (samples.length === 0) {
    return { intent: "cancel", elapsedMs: 0, dragPx: 0, reason: "no input" };
  }

  const first = samples[0];
  const last = samples[samples.length - 1];
  const elapsedMs = Math.max(0, last.timeMs - first.timeMs);
  const dragPx = distance(first, last);
  const released = last.action === "release";

  if (!released) {
    return { intent: "cancel", elapsedMs, dragPx, reason: "gesture still active" };
  }

  if (dragPx >= thresholds.cancelDriftPx) {
    return { intent: "cancel", elapsedMs, dragPx, reason: "finger drifted outside packet focus" };
  }

  if (elapsedMs >= thresholds.openHoldMs && dragPx >= thresholds.openDragPx) {
    return { intent: "open", elapsedMs, dragPx, reason: "long hold plus deliberate seal pull" };
  }

  if (elapsedMs >= thresholds.preserveHoldMs && dragPx < thresholds.openDragPx) {
    return { intent: "preserve", elapsedMs, dragPx, reason: "deliberate hold without breaking seal" };
  }

  return { intent: "cancel", elapsedMs, dragPx, reason: "gesture below commitment threshold" };
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function sample(action: PacketIntentAction, timeMs: number, x: number, y: number): PacketIntentSample {
  return { action, timeMs, x, y };
}

export function checkPacketIntentRequiresDeliberateSealPull(): void {
  const result = evaluatePacketIntent([
    sample("press", 0, 120, 200),
    sample("hold", 240, 122, 202),
    sample("release", 460, 168, 203),
  ]);

  assert(result.intent === "open", `expected open intent, got ${result.intent}`);
  assert(result.elapsedMs === 460, `expected 460ms elapsed, got ${result.elapsedMs}`);
  assert(result.dragPx >= DEFAULT_PACKET_INTENT_THRESHOLDS.openDragPx, "expected drag past seal-pull threshold");
}

export function checkPacketIntentPreservesOnSteadyHold(): void {
  const result = evaluatePacketIntent([
    sample("press", 0, 120, 200),
    sample("hold", 120, 121, 201),
    sample("release", 210, 122, 202),
  ]);

  assert(result.intent === "preserve", `expected preserve intent, got ${result.intent}`);
  assert(result.elapsedMs === 210, `expected 210ms elapsed, got ${result.elapsedMs}`);
  assert(result.dragPx < DEFAULT_PACKET_INTENT_THRESHOLDS.openDragPx, "expected no accidental seal pull");
}

export function checkPacketIntentCancelsFastTapsAndDrift(): void {
  const fastTap = evaluatePacketIntent([
    sample("press", 0, 120, 200),
    sample("release", 90, 121, 201),
  ]);
  const drift = evaluatePacketIntent([
    sample("press", 0, 120, 200),
    sample("hold", 300, 180, 240),
    sample("release", 460, 230, 260),
  ]);

  assert(fastTap.intent === "cancel", `expected fast tap cancel, got ${fastTap.intent}`);
  assert(drift.intent === "cancel", `expected drift cancel, got ${drift.intent}`);
}

export function runPacketIntentChecks(): void {
  checkPacketIntentRequiresDeliberateSealPull();
  checkPacketIntentPreservesOnSteadyHold();
  checkPacketIntentCancelsFastTapsAndDrift();
}
