import {
  createAftersignVerticalSliceSave,
  createAftersignVerticalSliceState,
  meetIoForAftersignSlice,
  recordAftersignPacketChoice,
  restoreAftersignVerticalSliceState,
  sampleAftersignIoMemoryBeat,
  type AftersignPacketOutcome,
} from "./verticalSliceState";

describe("AFTERSIGN save→reload Io memory integration", () => {
  const runOutcome = (outcome: AftersignPacketOutcome) => {
    const chosen = recordAftersignPacketChoice(
      createAftersignVerticalSliceState(),
      outcome,
    );
    const met = meetIoForAftersignSlice(chosen);
    const saved = createAftersignVerticalSliceSave(met);
    const restored = restoreAftersignVerticalSliceState(saved);
    const returned = meetIoForAftersignSlice(restored);

    return sampleAftersignIoMemoryBeat(returned);
  };

  it("returns distinct, outcome-correct Io lines for sealed vs opened after reload", () => {
    const sealedBeat = runOutcome("sealed");
    const openedBeat = runOutcome("opened");

    expect(sealedBeat.outcome).toBe("sealed");
    expect(openedBeat.outcome).toBe("opened");
    expect(sealedBeat.line).not.toEqual(openedBeat.line);
  });

  it("fails loudly when break mode forces wrong-io-line", () => {
    const original = process.env.FLAGSHIP_BREAK_MODE;
    process.env.FLAGSHIP_BREAK_MODE = "wrong-io-line";

    try {
      const sealedBeat = runOutcome("sealed");
      const openedBeat = runOutcome("opened");

      expect(sealedBeat.outcome).toBe("sealed");
      expect(openedBeat.outcome).toBe("opened");
      expect(sealedBeat.line).not.toEqual(openedBeat.line);
    } finally {
      process.env.FLAGSHIP_BREAK_MODE = original;
    }
  });

  it("fails loudly when break mode drops memory", () => {
    const original = process.env.FLAGSHIP_BREAK_MODE;
    process.env.FLAGSHIP_BREAK_MODE = "drop-memory";

    try {
      const sealedBeat = runOutcome("sealed");
      const openedBeat = runOutcome("opened");

      expect(sealedBeat.outcome).toBe("sealed");
      expect(openedBeat.outcome).toBe("opened");
      expect(sealedBeat.line).not.toEqual(openedBeat.line);
    } finally {
      process.env.FLAGSHIP_BREAK_MODE = original;
    }
  });

  it("fails loudly when break mode local-only-save loses state", () => {
    const original = process.env.FLAGSHIP_BREAK_MODE;
    process.env.FLAGSHIP_BREAK_MODE = "local-only-save";

    try {
      const sealedBeat = runOutcome("sealed");
      const openedBeat = runOutcome("opened");

      expect(sealedBeat.outcome).toBe("sealed");
      expect(openedBeat.outcome).toBe("opened");
      expect(sealedBeat.line).not.toEqual(openedBeat.line);
    } finally {
      process.env.FLAGSHIP_BREAK_MODE = original;
    }
  });
});
