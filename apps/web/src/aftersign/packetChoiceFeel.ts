// AFTERSIGN packet-choice feel helpers.
//
// This module is intentionally deterministic and side-effect free so the
// vertical-slice harness can assert that the first seal decision feels like an
// held intention, not a stray tap or menu toggle.

export type PacketChoice = "preserve" | "open";

export type PacketChoicePointerPhase = "idle" | "pressing" | "committed" | "cancelled";

export interface PacketChoiceTuning {
  /** Minimum hold before either packet choice can commit. */
  holdMs: number;
  /** Pointer travel allowed before the hold cancels. */
  cancelRadiusPx: number;
  /** Preserve intent only commits on the preserve side of the axis. */
  preserveAxisMax: number;
  /** Open intent only commits on the open side of the axis. */
  openAxisMin: number;
}

export interface PacketChoiceStart {
  choice: PacketChoice;
  nowMs: number;
  pointerX: number;
  pointerY: number;
  axis: number;
}

export interface PacketChoiceUpdate {
  nowMs: number;
  pointerX: number;
  pointerY: number;
  axis: number;
}

export interface PacketChoiceSnapshot {
  phase: PacketChoicePointerPhase;
  choice: PacketChoice | null;
  progress: number;
  elapsedMs: number;
  travelPx: number;
  axis: number;
  committedChoice: PacketChoice | null;
}

export const defaultPacketChoiceTuning: PacketChoiceTuning = {
  holdMs: 420,
  cancelRadiusPx: 18,
  preserveAxisMax: -0.35,
  openAxisMin: 0.35,
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const distance = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.hypot(dx, dy);
};

const axisMatchesChoice = (choice: PacketChoice, axis: number, tuning: PacketChoiceTuning): boolean => {
  if (choice === "preserve") return axis <= tuning.preserveAxisMax;
  return axis >= tuning.openAxisMin;
};

const idleSnapshot = (axis = 0): PacketChoiceSnapshot => ({
  phase: "idle",
  choice: null,
  progress: 0,
  elapsedMs: 0,
  travelPx: 0,
  axis,
  committedChoice: null,
});

export class PacketChoiceFeelModel {
  private readonly tuning: PacketChoiceTuning;
  private started: PacketChoiceStart | null = null;
  private snapshotValue: PacketChoiceSnapshot = idleSnapshot();

  constructor(tuning: Partial<PacketChoiceTuning> = {}) {
    this.tuning = { ...defaultPacketChoiceTuning, ...tuning };
  }

  start(start: PacketChoiceStart): PacketChoiceSnapshot {
    this.started = start;
    this.snapshotValue = {
      phase: "pressing",
      choice: start.choice,
      progress: 0,
      elapsedMs: 0,
      travelPx: 0,
      axis: start.axis,
      committedChoice: null,
    };
    return this.snapshotValue;
  }

  update(update: PacketChoiceUpdate): PacketChoiceSnapshot {
    if (!this.started || this.snapshotValue.phase === "committed" || this.snapshotValue.phase === "cancelled") {
      return this.snapshotValue;
    }

    const elapsedMs = Math.max(0, update.nowMs - this.started.nowMs);
    const travelPx = distance(this.started.pointerX, this.started.pointerY, update.pointerX, update.pointerY);
    const progress = clamp01(elapsedMs / this.tuning.holdMs);
    const cancelled = travelPx > this.tuning.cancelRadiusPx || !axisMatchesChoice(this.started.choice, update.axis, this.tuning);

    if (cancelled) {
      this.snapshotValue = {
        phase: "cancelled",
        choice: this.started.choice,
        progress,
        elapsedMs,
        travelPx,
        axis: update.axis,
        committedChoice: null,
      };
      return this.snapshotValue;
    }

    if (progress >= 1) {
      this.snapshotValue = {
        phase: "committed",
        choice: this.started.choice,
        progress: 1,
        elapsedMs,
        travelPx,
        axis: update.axis,
        committedChoice: this.started.choice,
      };
      return this.snapshotValue;
    }

    this.snapshotValue = {
      phase: "pressing",
      choice: this.started.choice,
      progress,
      elapsedMs,
      travelPx,
      axis: update.axis,
      committedChoice: null,
    };
    return this.snapshotValue;
  }

  cancel(axis = this.snapshotValue.axis): PacketChoiceSnapshot {
    const choice = this.started?.choice ?? this.snapshotValue.choice;
    this.snapshotValue = {
      ...this.snapshotValue,
      phase: "cancelled",
      choice,
      axis,
      committedChoice: null,
    };
    return this.snapshotValue;
  }

  reset(axis = 0): PacketChoiceSnapshot {
    this.started = null;
    this.snapshotValue = idleSnapshot(axis);
    return this.snapshotValue;
  }

  snapshot(): PacketChoiceSnapshot {
    return this.snapshotValue;
  }
}

export const createPacketChoiceFeelModel = (tuning?: Partial<PacketChoiceTuning>): PacketChoiceFeelModel =>
  new PacketChoiceFeelModel(tuning);
