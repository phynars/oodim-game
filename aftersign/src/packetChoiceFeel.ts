export type PacketChoice = 'preserve' | 'open';

export type PacketChoicePhase = 'idle' | 'pressing' | 'committed' | 'cancelled';

export interface PacketChoiceTuning {
  /** Minimum continuous focused hold before either packet outcome commits. */
  holdMs: number;
  /** Touch drift allowed before the choice cancels as an accidental swipe. */
  cancelRadiusPx: number;
  /** Preserve must stay on this side of the choice axis. */
  preserveAxisMax: number;
  /** Open must stay on this side of the choice axis. */
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
  /**
   * False when the document is hidden / unfocused. Hidden time is excluded
   * from the hold clock so a backgrounded tab cannot spend the player's trust.
   */
  hasFocus?: boolean;
}

export interface PacketChoiceSnapshot {
  phase: PacketChoicePhase;
  choice: PacketChoice | null;
  progress: number;
  elapsedMs: number;
  travelPx: number;
  axis: number;
  committedChoice: PacketChoice | null;
}

export const DEFAULT_PACKET_CHOICE_TUNING: PacketChoiceTuning = {
  holdMs: 420,
  cancelRadiusPx: 18,
  preserveAxisMax: -0.35,
  openAxisMin: 0.35,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

function choiceMatchesAxis(
  choice: PacketChoice,
  axis: number,
  tuning: PacketChoiceTuning,
): boolean {
  return choice === 'preserve'
    ? axis <= tuning.preserveAxisMax
    : axis >= tuning.openAxisMin;
}

function idleSnapshot(axis = 0): PacketChoiceSnapshot {
  return {
    phase: 'idle',
    choice: null,
    progress: 0,
    elapsedMs: 0,
    travelPx: 0,
    axis,
    committedChoice: null,
  };
}

export function createPacketChoiceFeelModel(
  tuningOverrides: Partial<PacketChoiceTuning> = {},
): {
  start(start: PacketChoiceStart): PacketChoiceSnapshot;
  update(update: PacketChoiceUpdate): PacketChoiceSnapshot;
  cancel(axis?: number): PacketChoiceSnapshot;
  reset(axis?: number): PacketChoiceSnapshot;
  snapshot(): PacketChoiceSnapshot;
} {
  const tuning = { ...DEFAULT_PACKET_CHOICE_TUNING, ...tuningOverrides };
  let started: PacketChoiceStart | null = null;
  let current = idleSnapshot();
  let hiddenAtMs: number | null = null;
  let lastAdvanceMs = 0;

  function consumeHiddenInterval(nowMs: number): void {
    if (started === null || hiddenAtMs === null) return;
    const hiddenMs = Math.max(0, nowMs - hiddenAtMs);
    started = {
      ...started,
      nowMs: started.nowMs + hiddenMs,
    };
    hiddenAtMs = null;
  }

  return {
    start(start) {
      started = start;
      hiddenAtMs = null;
      lastAdvanceMs = start.nowMs;
      current = {
        phase: 'pressing',
        choice: start.choice,
        progress: 0,
        elapsedMs: 0,
        travelPx: 0,
        axis: start.axis,
        committedChoice: null,
      };
      return current;
    },

    update(update) {
      if (
        started === null ||
        current.phase === 'committed' ||
        current.phase === 'cancelled'
      ) {
        return current;
      }

      if (update.hasFocus === false) {
        if (hiddenAtMs === null) hiddenAtMs = lastAdvanceMs;
        return current;
      }

      consumeHiddenInterval(update.nowMs);

      const elapsedMs = Math.max(0, update.nowMs - started.nowMs);
      const travelPx = distance(
        started.pointerX,
        started.pointerY,
        update.pointerX,
        update.pointerY,
      );
      const progress = clamp01(elapsedMs / tuning.holdMs);

      if (
        travelPx > tuning.cancelRadiusPx ||
        !choiceMatchesAxis(started.choice, update.axis, tuning)
      ) {
        current = {
          phase: 'cancelled',
          choice: started.choice,
          progress,
          elapsedMs,
          travelPx,
          axis: update.axis,
          committedChoice: null,
        };
        return current;
      }

      if (progress >= 1) {
        current = {
          phase: 'committed',
          choice: started.choice,
          progress: 1,
          elapsedMs,
          travelPx,
          axis: update.axis,
          committedChoice: started.choice,
        };
        return current;
      }

      current = {
        phase: 'pressing',
        choice: started.choice,
        progress,
        elapsedMs,
        travelPx,
        axis: update.axis,
        committedChoice: null,
      };
      lastAdvanceMs = update.nowMs;
      return current;
    },

    cancel(axis = current.axis) {
      current = {
        ...current,
        phase: 'cancelled',
        choice: started?.choice ?? current.choice,
        axis,
        committedChoice: null,
      };
      return current;
    },

    reset(axis = 0) {
      started = null;
      hiddenAtMs = null;
      lastAdvanceMs = 0;
      current = idleSnapshot(axis);
      return current;
    },

    snapshot() {
      return current;
    },
  };
}
