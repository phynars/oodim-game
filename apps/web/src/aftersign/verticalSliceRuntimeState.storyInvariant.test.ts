import { describe, expect, it } from "vitest";
import {
  createAftersignVerticalSliceState,
  meetIoForAftersignSlice,
  meetOrraForAftersignSlice,
  recordAftersignNextJobRequest,
  recordAftersignOrraAction,
  recordAftersignPacketChoice,
  recordAftersignReturnToneChoice,
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

  // M-CONTINUE-E1 (issue #1198) axes. These transitions are HARNESS-ONLY
  // consumers today: the choice-handler wiring that binds them to
  // `choose-return-tone` / `ask-for-next-job` lives on issue #1196 and
  // has not landed. Exercising the pure transitions + guard here locks
  // the contract (default = false, forward-only flip, out-of-order
  // guard throws) so the #1196 wiring session can rely on it instead of
  // discovering the shape by reading the source.
  describe("return-tone and next-job axes (M-CONTINUE-E1)", () => {
    it("initializes returnToneChosen and nextJobRequested to false", () => {
      const state = createAftersignVerticalSliceState();

      expect(state.returnToneChosen).toBe(false);
      expect(state.nextJobRequested).toBe(false);
    });

    it("flips returnToneChosen true when the return-tone choice is recorded", () => {
      const state = createAftersignVerticalSliceState();

      const next = recordAftersignReturnToneChoice(state);

      expect(next.returnToneChosen).toBe(true);
      expect(next.nextJobRequested).toBe(false);
      // Purity: input state is not mutated.
      expect(state.returnToneChosen).toBe(false);
    });

    it("flips nextJobRequested true only after returnToneChosen is true", () => {
      let state = createAftersignVerticalSliceState();
      state = recordAftersignReturnToneChoice(state);

      const next = recordAftersignNextJobRequest(state);

      expect(next.returnToneChosen).toBe(true);
      expect(next.nextJobRequested).toBe(true);
    });

    it("throws when a next-job request is recorded before the return-tone choice", () => {
      const state = createAftersignVerticalSliceState();

      expect(() => recordAftersignNextJobRequest(state)).toThrow(
        /return tone has not been chosen/i,
      );
    });

    it("throws when returnToneChosen is undefined (pre-axis state literal)", () => {
      // Simulates a state constructed before this axis existed — durable-save
      // restores, older test literals — where `returnToneChosen` is absent.
      // Readers must treat `undefined` as false, so the guard must still fire.
      const legacyState = {
        ...createAftersignVerticalSliceState(),
        returnToneChosen: undefined,
      };

      expect(() => recordAftersignNextJobRequest(legacyState)).toThrow(
        /return tone has not been chosen/i,
      );
    });
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
