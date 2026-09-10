export type PacketIntentPointerPhase = "start" | "move" | "end" | "cancel";

export type PacketIntentDecision = "pending" | "preserve" | "open" | "cancelled";

export interface PacketIntentSample {
  phase: PacketIntentPointerPhase;
  timeMs: number;
  x: number;
  y: number;
}

export interface PacketIntentFeelConfig {
  quickTapMs: number;
  holdToOpenMs: number;
  moveCancelPx: number;
}

export interface PacketIntentState {
  startedAtMs: number;
  startX: number;
  startY: number;
  lastTimeMs: number;
  maxTravelPx: number;
  packetOpened: boolean;
  decision: PacketIntentDecision;
}

export const DEFAULT_PACKET_INTENT_FEEL: PacketIntentFeelConfig = {
  quickTapMs: 180,
  holdToOpenMs: 520,
  moveCancelPx: 14,
};

export function startPacketIntent(
  sample: PacketIntentSample,
  packetOpened = false,
): PacketIntentState {
  return {
    startedAtMs: sample.timeMs,
    startX: sample.x,
    startY: sample.y,
    lastTimeMs: sample.timeMs,
    maxTravelPx: 0,
    packetOpened,
    decision: "pending",
  };
}

export function updatePacketIntent(
  state: PacketIntentState,
  sample: PacketIntentSample,
  config: PacketIntentFeelConfig = DEFAULT_PACKET_INTENT_FEEL,
): PacketIntentState {
  if (state.decision !== "pending") {
    return state;
  }

  const travelPx = Math.hypot(sample.x - state.startX, sample.y - state.startY);
  const maxTravelPx = Math.max(state.maxTravelPx, travelPx);
  const elapsedMs = sample.timeMs - state.startedAtMs;
  const movedTooFar = maxTravelPx > config.moveCancelPx;

  if (sample.phase === "cancel") {
    return { ...state, lastTimeMs: sample.timeMs, maxTravelPx, decision: "cancelled" };
  }

  if (movedTooFar) {
    return { ...state, lastTimeMs: sample.timeMs, maxTravelPx, decision: "cancelled" };
  }

  if (sample.phase === "move") {
    return { ...state, lastTimeMs: sample.timeMs, maxTravelPx };
  }

  if (sample.phase === "end") {
    if (state.packetOpened) {
      return { ...state, lastTimeMs: sample.timeMs, maxTravelPx, decision: "open" };
    }

    if (elapsedMs <= config.quickTapMs) {
      return { ...state, lastTimeMs: sample.timeMs, maxTravelPx, decision: "preserve" };
    }

    if (elapsedMs >= config.holdToOpenMs) {
      return {
        ...state,
        lastTimeMs: sample.timeMs,
        maxTravelPx,
        packetOpened: true,
        decision: "open",
      };
    }
  }

  return { ...state, lastTimeMs: sample.timeMs, maxTravelPx };
}

export function resolvePacketIntent(
  samples: PacketIntentSample[],
  packetOpened = false,
  config: PacketIntentFeelConfig = DEFAULT_PACKET_INTENT_FEEL,
): PacketIntentState {
  if (samples.length === 0 || samples[0]?.phase !== "start") {
    throw new Error("Packet intent needs a start sample before it can resolve.");
  }

  return samples.slice(1).reduce(
    (state, sample) => updatePacketIntent(state, sample, config),
    startPacketIntent(samples[0], packetOpened),
  );
}

function assertPacketIntent(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

export function checkQuickTapPreservesPacket(): void {
  const state = resolvePacketIntent([
    { phase: "start", timeMs: 0, x: 120, y: 240 },
    { phase: "end", timeMs: 96, x: 122, y: 241 },
  ]);

  assertPacketIntent(state.decision === "preserve", "Quick packet tap should preserve the seal.");
  assertPacketIntent(state.packetOpened === false, "Preserve intent must not open the packet.");
}

export function checkStationaryHoldOpensPacket(): void {
  const state = resolvePacketIntent([
    { phase: "start", timeMs: 0, x: 120, y: 240 },
    { phase: "move", timeMs: 260, x: 121, y: 240 },
    { phase: "end", timeMs: 540, x: 121, y: 241 },
  ]);

  assertPacketIntent(state.decision === "open", "Stationary hold should open the packet.");
  assertPacketIntent(state.packetOpened === true, "Open intent must mark the packet opened.");
}

export function checkDraggedHoldCancelsOpenIntent(): void {
  const state = resolvePacketIntent([
    { phase: "start", timeMs: 0, x: 120, y: 240 },
    { phase: "move", timeMs: 220, x: 138, y: 240 },
    { phase: "end", timeMs: 620, x: 138, y: 240 },
  ]);

  assertPacketIntent(state.decision === "cancelled", "Hold with more than 14px travel should cancel opening.");
  assertPacketIntent(state.packetOpened === false, "Cancelled hold must not open the packet.");
}

export function checkOpenedPacketCannotBeResealed(): void {
  const state = resolvePacketIntent(
    [
      { phase: "start", timeMs: 0, x: 120, y: 240 },
      { phase: "end", timeMs: 80, x: 120, y: 240 },
    ],
    true,
  );

  assertPacketIntent(state.decision === "open", "Already-open packet should stay open after a later tap.");
  assertPacketIntent(state.packetOpened === true, "Preserve intent cannot reseal an opened packet.");
}

export function runPacketIntentFeelChecks(): void {
  checkQuickTapPreservesPacket();
  checkStationaryHoldOpensPacket();
  checkDraggedHoldCancelsOpenIntent();
  checkOpenedPacketCannotBeResealed();
}
