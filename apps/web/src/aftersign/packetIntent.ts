// AFTERSIGN packet intent contract.
//
// The first slice choice — open the sealed blue packet or preserve it — must
// feel deliberate. This model keeps accidental taps from breaking the seal:
// tap inspects, hold arms the seal break, release commits only after the hold
// threshold. Keeping the packet sealed is also an explicit commit.

export type PacketSealIntent = "sealed" | "opening" | "opened";

export interface PacketIntentSnapshot {
  readonly state: PacketSealIntent;
  readonly holdMs: number;
  readonly thresholdMs: number;
  readonly canCommitOpen: boolean;
}

export interface PacketIntentModel {
  readonly thresholdMs: number;
  startOpenHold(): PacketIntentSnapshot;
  updateOpenHold(deltaMs: number): PacketIntentSnapshot;
  releaseOpenHold(): PacketIntentSnapshot;
  commitKeepSealed(): PacketIntentSnapshot;
  snapshot(): PacketIntentSnapshot;
}

export interface PacketIntentOptions {
  /**
   * Minimum continuous hold before releasing can break the seal.
   * 320ms is long enough to reject stray taps, short enough to feel responsive.
   */
  readonly openHoldThresholdMs?: number;
}

const DEFAULT_OPEN_HOLD_THRESHOLD_MS = 320;

export function createPacketIntentModel(
  options: PacketIntentOptions = {},
): PacketIntentModel {
  const thresholdMs = Math.max(
    1,
    options.openHoldThresholdMs ?? DEFAULT_OPEN_HOLD_THRESHOLD_MS,
  );

  let state: PacketSealIntent = "sealed";
  let holdMs = 0;

  function toSnapshot(): PacketIntentSnapshot {
    return {
      state,
      holdMs,
      thresholdMs,
      canCommitOpen: state === "opening" && holdMs >= thresholdMs,
    };
  }

  return {
    thresholdMs,

    startOpenHold() {
      if (state !== "opened") {
        state = "opening";
        holdMs = 0;
      }
      return toSnapshot();
    },

    updateOpenHold(deltaMs: number) {
      if (state === "opening") {
        holdMs = Math.min(
          thresholdMs,
          Math.max(0, holdMs + Math.max(0, deltaMs)),
        );
      }
      return toSnapshot();
    },

    releaseOpenHold() {
      if (state === "opening") {
        state = holdMs >= thresholdMs ? "opened" : "sealed";
        holdMs = 0;
      }
      return toSnapshot();
    },

    commitKeepSealed() {
      if (state !== "opened") {
        state = "sealed";
        holdMs = 0;
      }
      return toSnapshot();
    },

    snapshot: toSnapshot,
  };
}
