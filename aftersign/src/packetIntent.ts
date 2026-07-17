export type PacketIntentChoice = "sealed" | "opened";

export type PacketIntentPhase =
  | "idle"
  | "pressing"
  | "committed-sealed"
  | "committed-opened"
  | "cancelled";

export interface PacketIntentConfig {
  /** Milliseconds the player must hold before the seal can break. */
  openHoldMs: number;
  /** Milliseconds under this threshold is treated as an inspect/touch, not a choice. */
  tapGraceMs: number;
  /** Minimum normalized drag distance away from the seal that cancels a pending open. */
  cancelDistance: number;
}

export interface PacketIntentState {
  phase: PacketIntentPhase;
  pressStartedAtMs: number | null;
  heldMs: number;
  progress: number;
  choice: PacketIntentChoice | null;
}

export interface PacketIntentSample {
  nowMs: number;
  isPressed: boolean;
  dragDistance: number;
}

export const DEFAULT_PACKET_INTENT_CONFIG: PacketIntentConfig = {
  openHoldMs: 420,
  tapGraceMs: 140,
  cancelDistance: 0.28,
};

export function createPacketIntentState(): PacketIntentState {
  return {
    phase: "idle",
    pressStartedAtMs: null,
    heldMs: 0,
    progress: 0,
    choice: null,
  };
}

export function updatePacketIntent(
  state: PacketIntentState,
  sample: PacketIntentSample,
  config: PacketIntentConfig = DEFAULT_PACKET_INTENT_CONFIG,
): PacketIntentState {
  if (state.choice) {
    return { ...state };
  }

  if (!sample.isPressed) {
    if (state.phase !== "pressing" || state.pressStartedAtMs === null) {
      return createPacketIntentState();
    }

    const heldMs = Math.max(0, sample.nowMs - state.pressStartedAtMs);

    if (heldMs >= config.openHoldMs) {
      return {
        phase: "committed-opened",
        pressStartedAtMs: state.pressStartedAtMs,
        heldMs,
        progress: 1,
        choice: "opened",
      };
    }

    return {
      phase: heldMs <= config.tapGraceMs ? "idle" : "cancelled",
      pressStartedAtMs: null,
      heldMs: 0,
      progress: 0,
      choice: null,
    };
  }

  const pressStartedAtMs =
    state.phase === "pressing" && state.pressStartedAtMs !== null
      ? state.pressStartedAtMs
      : sample.nowMs;
  const heldMs = Math.max(0, sample.nowMs - pressStartedAtMs);

  if (sample.dragDistance >= config.cancelDistance) {
    return {
      phase: "cancelled",
      pressStartedAtMs: null,
      heldMs: 0,
      progress: 0,
      choice: null,
    };
  }

  return {
    phase: "pressing",
    pressStartedAtMs,
    heldMs,
    progress: clamp01(heldMs / config.openHoldMs),
    choice: null,
  };
}

export function commitSealedDelivery(state: PacketIntentState): PacketIntentState {
  if (state.choice === "opened") {
    return { ...state };
  }

  return {
    phase: "committed-sealed",
    pressStartedAtMs: null,
    heldMs: 0,
    progress: 0,
    choice: "sealed",
  };
}

export function runPacketIntentChecks(): void {
  checkTapDoesNotOpenPacket();
  checkHoldRequiresDeliberateDuration();
  checkDragCancelsPendingOpen();
  checkSealedCommitCannotOverwriteOpenedChoice();
}

function checkTapDoesNotOpenPacket(): void {
  let state = createPacketIntentState();
  state = updatePacketIntent(state, { nowMs: 0, isPressed: true, dragDistance: 0 });
  state = updatePacketIntent(state, { nowMs: 90, isPressed: false, dragDistance: 0 });

  assert(state.choice === null, "short tap must inspect, not choose opened");
  assert(state.phase === "idle", "short tap should return to idle without a committed choice");
}

function checkHoldRequiresDeliberateDuration(): void {
  let state = createPacketIntentState();
  state = updatePacketIntent(state, { nowMs: 1000, isPressed: true, dragDistance: 0 });
  state = updatePacketIntent(state, { nowMs: 1260, isPressed: true, dragDistance: 0 });

  assert(state.choice === null, "partial hold must not open before the hold threshold");
  assert(
    state.progress > 0.6 && state.progress < 0.7,
    "partial hold should expose readable progress before committing",
  );

  state = updatePacketIntent(state, { nowMs: 1420, isPressed: false, dragDistance: 0 });
  assert(state.choice === "opened", "release after the hold threshold should commit opened");
  assert(state.phase === "committed-opened", "opened packet should publish committed-opened phase");
}

function checkDragCancelsPendingOpen(): void {
  let state = createPacketIntentState();
  state = updatePacketIntent(state, { nowMs: 0, isPressed: true, dragDistance: 0 });
  state = updatePacketIntent(state, { nowMs: 220, isPressed: true, dragDistance: 0.31 });

  assert(state.choice === null, "dragging away must not accidentally open the packet");
  assert(state.phase === "cancelled", "dragging away should cancel the pending open");
}

function checkSealedCommitCannotOverwriteOpenedChoice(): void {
  let state = createPacketIntentState();
  state = updatePacketIntent(state, { nowMs: 0, isPressed: true, dragDistance: 0 });
  state = updatePacketIntent(state, { nowMs: 430, isPressed: false, dragDistance: 0 });
  state = commitSealedDelivery(state);

  assert(state.choice === "opened", "sealed delivery must not overwrite an opened packet choice");
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`packet intent check failed: ${message}`);
  }
}
