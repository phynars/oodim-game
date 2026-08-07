import { describe, expect, it } from "vitest";
import {
  createAftersignVerticalSliceState,
  meetIoForAftersignSlice,
  meetOrraForAftersignSlice,
  recordAftersignOrraAction,
  recordAftersignPacketChoice,
} from "./verticalSliceRuntimeState";

describe("Aftersign vertical-slice story/state invariants", () => {
  it("does not recognize Io or Orra before a prior meeting is recorded", () => {
    const state = createAftersignVerticalSliceState();

    expect(state.ioHasMetPlayer).toBe(false);
    expect(state.ioRecognizesPlayer).toBe(false);
    expect(state.orraHasMetPlayer).toBe(false);
    expect(state.orraRecognizesPlayer).toBe(false);
  });

  it("lets Io recognize the player only after the first meeting is committed", () => {
    let state = createAftersignVerticalSliceState();

    state = meetIoForAftersignSlice(state);

    expect(state.ioHasMetPlayer).toBe(true);
    expect(state.ioRecognizesPlayer).toBe(false);

    state = meetIoForAftersignSlice(state);

    expect(state.ioHasMetPlayer).toBe(true);
    expect(state.ioRecognizesPlayer).toBe(true);
  });

  it("preserves committed packet and Orra story choices while advancing meetings", () => {
    let state = createAftersignVerticalSliceState();

    state = meetIoForAftersignSlice(state);
    state = recordAftersignPacketChoice(state, "opened");
    state = meetOrraForAftersignSlice(state);
    state = recordAftersignOrraAction(state, "answered-saint-orra");
    state = meetOrraForAftersignSlice(state);

    expect(state.packetOutcome).toBe("opened");
    expect(state.orraAction).toBe("answered-saint-orra");
    expect(state.orraHasMetPlayer).toBe(true);
    expect(state.orraRecognizesPlayer).toBe(true);
  });
});
