export type PacketSealState = "sealed" | "opened";

export type PacketIntentPhase = "idle" | "pressing" | "committed" | "cancelled";

export interface PacketIntentTuning {
  /** Minimum deliberate hold before the seal can break. */
  readonly openHoldMs: number;
  /** Movement beyond this cancels the hold so navigation swipes do not open the packet. */
  readonly cancelDragPx: number;
  /** Preserve action is allowed immediately; opening requires intent. */
  readonly preserveTapMaxMs: number;
}

export interface PacketIntentState {
  readonly seal: PacketSealState;
  readonly phase: PacketIntentPhase;
  readonly heldMs: number;
  readonly dragPx: number;
  readonly previewArmed: boolean;
  readonly decision: "none" | "preserve" | "open";
}

export interface PacketIntentEvent {
  readonly kind: "press" | "move" | "release" | "tick" | "preserve";
  readonly dtMs?: number;
  readonly dragPx?: number;
}

export const DEFAULT_PACKET_INTENT_TUNING: PacketIntentTuning = {
  openHoldMs: 360,
  cancelDragPx: 18,
  preserveTapMaxMs: 160,
};

export function createPacketIntentState(seal: PacketSealState = "sealed"): PacketIntentState {
  return {
    seal,
    phase: "idle",
    heldMs: 0,
    dragPx: 0,
    previewArmed: false,
    decision: "none",
  };
}

export function reducePacketIntent(
  state: PacketIntentState,
  event: PacketIntentEvent,
  tuning: PacketIntentTuning = DEFAULT_PACKET_INTENT_TUNING,
): PacketIntentState {
  if (state.phase === "committed" || state.phase === "cancelled" || state.seal === "opened") {
    return state;
  }

  if (event.kind === "preserve") {
    return {
      ...state,
      phase: "committed",
      decision: "preserve",
    };
  }

  if (event.kind === "press") {
    return {
      ...state,
      phase: "pressing",
      heldMs: 0,
      dragPx: 0,
      previewArmed: false,
      decision: "none",
    };
  }

  if (state.phase !== "pressing") {
    return state;
  }

  if (event.kind === "move") {
    const dragPx = Math.max(state.dragPx, event.dragPx ?? 0);
    if (dragPx > tuning.cancelDragPx) {
      return {
        ...state,
        phase: "cancelled",
        dragPx,
        previewArmed: false,
      };
    }

    return {
      ...state,
      dragPx,
    };
  }

  if (event.kind === "tick") {
    const heldMs = state.heldMs + Math.max(0, event.dtMs ?? 0);
    return {
      ...state,
      heldMs,
      previewArmed: heldMs >= tuning.openHoldMs,
    };
  }

  if (event.kind === "release") {
    if (state.heldMs >= tuning.openHoldMs && state.dragPx <= tuning.cancelDragPx) {
      return {
        ...state,
        seal: "opened",
        phase: "committed",
        previewArmed: true,
        decision: "open",
      };
    }

    return {
      ...state,
      phase: state.heldMs <= tuning.preserveTapMaxMs ? "idle" : "cancelled",
      previewArmed: false,
    };
  }

  return state;
}

export function applyPacketIntentEvents(
  events: readonly PacketIntentEvent[],
  initialState: PacketIntentState = createPacketIntentState(),
  tuning: PacketIntentTuning = DEFAULT_PACKET_INTENT_TUNING,
): PacketIntentState {
  return events.reduce((state, event) => reducePacketIntent(state, event, tuning), initialState);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

export function checkPacketIntentFeel(): void {
  const accidentalTap = applyPacketIntentEvents([
    { kind: "press" },
    { kind: "tick", dtMs: 80 },
    { kind: "release" },
  ]);
  assert(accidentalTap.seal === "sealed", "a short tap must not open the packet");
  assert(accidentalTap.decision === "none", "a short tap must not commit the packet choice");

  const navigationSwipe = applyPacketIntentEvents([
    { kind: "press" },
    { kind: "tick", dtMs: 240 },
    { kind: "move", dragPx: 24 },
    { kind: "tick", dtMs: 240 },
    { kind: "release" },
  ]);
  assert(navigationSwipe.seal === "sealed", "a dragged touch must not open the packet");
  assert(navigationSwipe.phase === "cancelled", "dragging past the threshold must cancel opening intent");

  const deliberateOpen = applyPacketIntentEvents([
    { kind: "press" },
    { kind: "tick", dtMs: 180 },
    { kind: "tick", dtMs: 180 },
    { kind: "release" },
  ]);
  assert(deliberateOpen.seal === "opened", "a full deliberate hold must open the packet");
  assert(deliberateOpen.decision === "open", "a full deliberate hold must commit the open choice");
  assert(deliberateOpen.previewArmed, "the open preview must arm before commit");

  const deliberatePreserve = applyPacketIntentEvents([{ kind: "preserve" }]);
  assert(deliberatePreserve.seal === "sealed", "preserving must keep the packet sealed");
  assert(deliberatePreserve.decision === "preserve", "preserving must commit an explicit preserve choice");
}

export function runPacketIntentFeelChecks(): void {
  checkPacketIntentFeel();
}
