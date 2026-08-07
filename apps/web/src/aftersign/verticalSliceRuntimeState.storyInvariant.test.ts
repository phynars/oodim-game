import { describe, expect, it } from "vitest";
import {
  createAftersignVerticalSliceState,
  meetIoForAftersignSlice,
  meetOrraForAftersignSlice,
  recordAftersignOrraAction,
  recordAftersignPacketChoice,
  type AftersignVerticalSliceState,
} from "./verticalSliceRuntimeState";

function applyStateUpdate(
  state: AftersignVerticalSliceState,
  update: AftersignVerticalSliceState | void,
): AftersignVerticalSliceState {
  return update ?? state;
}

describe("Aftersign vertical-slice story/state invariants", () => {
  it("does not recognize Io or Orra before a prior meeting is recorded", () => {
    const state = createAftersignVerticalSliceState();

    expect(state.hasMetIo).toBe(false);
    expect(state.ioRecognizesPlayer).toBe(false);
    expect(state.hasMetOrra).toBe(false);
    expect(state.orraRecognizesPlayer).toBe(false);
  });

  it("lets Io recognize the player only after the first meeting is committed", () => {
    let state = createAftersignVerticalSliceState();

    state = applyStateUpdate(state, meetIoForAftersignSlice(state));

    expect(state.hasMetIo).toBe(true);
    expect(state.ioRecognizesPlayer).toBe(false);

    state = applyStateUpdate(state, meetIoForAftersignSlice(state));

    expect(state.hasMetIo).toBe(true);
    expect(state.ioRecognizesPlayer).toBe(true);
  });

  it("preserves committed packet and Orra story choices while advancing meetings", () => {
    let state = createAftersignVerticalSliceState();

    state = applyStateUpdate(state, meetIoForAftersignSlice(state));
    state = applyStateUpdate(state, recordAftersignPacketChoice(state, "opened"));
    state = applyStateUpdate(state, meetOrraForAftersignSlice(state));
    state = applyStateUpdate(state, recordAftersignOrraAction(state, "answered"));
    state = applyStateUpdate(state, meetOrraForAftersignSlice(state));

    expect(state.packetOutcome).toBe("opened");
    expect(state.orraAction).toBe("answered");
    expect(state.hasMetOrra).toBe(true);
    expect(state.orraRecognizesPlayer).toBe(true);
  });
});
