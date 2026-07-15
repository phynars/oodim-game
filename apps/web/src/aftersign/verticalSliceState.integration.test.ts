// Integration coverage for the AFTERSIGN vertical-slice save/reload memory
// contract (ported from PR #671, corrected to the REAL beat shape).
//
// The prior attempt asserted `.outcome` / `.line` fields that do not exist on
// AftersignIoMemoryBeat, and gated on a `local-only-save` break mode that is
// not wired into this pure-state contract. This test asserts what the contract
// actually promises: the packet outcome (`sealed` vs `opened`) survives the
// save→restore round-trip and diverges in Io's sampled memory beat, and Io's
// recognition state derives from remembered acquaintance, not from the save.

import { describe, expect, it } from "vitest";

import {
  createAftersignVerticalSliceSave,
  createAftersignVerticalSliceState,
  meetIoForAftersignSlice,
  recordAftersignPacketChoice,
  restoreAftersignVerticalSliceState,
  sampleAftersignIoMemoryBeat,
  type AftersignPacketOutcome,
} from "./verticalSliceState";

function playThroughReload(outcome: AftersignPacketOutcome) {
  // First session: receive packet, choose, meet Io, save.
  const chosen = recordAftersignPacketChoice(
    createAftersignVerticalSliceState(),
    outcome,
  );
  const met = meetIoForAftersignSlice(chosen);
  const save = createAftersignVerticalSliceSave(met);

  // Reload: restore from save, return to Io.
  const restored = restoreAftersignVerticalSliceState(save);
  return meetIoForAftersignSlice(restored);
}

describe("verticalSliceState save/reload integration", () => {
  it("preserves the sealed outcome across save and reload", () => {
    const returned = playThroughReload("sealed");
    const beat = sampleAftersignIoMemoryBeat(returned);

    expect(beat).toEqual({
      scene: "io-return",
      recognizesPlayer: true,
      packetOutcome: "sealed",
    });
  });

  it("preserves the opened outcome across save and reload", () => {
    const returned = playThroughReload("opened");
    const beat = sampleAftersignIoMemoryBeat(returned);

    expect(beat).toEqual({
      scene: "io-return",
      recognizesPlayer: true,
      packetOutcome: "opened",
    });
  });

  it("diverges Io's memory beat between sealed and opened playthroughs", () => {
    const sealedBeat = sampleAftersignIoMemoryBeat(playThroughReload("sealed"));
    const openedBeat = sampleAftersignIoMemoryBeat(playThroughReload("opened"));

    expect(sealedBeat.packetOutcome).toBe("sealed");
    expect(openedBeat.packetOutcome).toBe("opened");
    expect(sealedBeat.packetOutcome).not.toBe(openedBeat.packetOutcome);
  });

  it("does not grant recognition on a fresh reload before re-meeting Io", () => {
    const chosen = recordAftersignPacketChoice(
      createAftersignVerticalSliceState(),
      "sealed",
    );
    const met = meetIoForAftersignSlice(chosen);
    const restored = restoreAftersignVerticalSliceState(
      createAftersignVerticalSliceSave(met),
    );

    // Restored state starts back at the kiosk without recognition; the
    // acquaintance flag persists, so recognition returns on the next meeting.
    expect(restored.scene).toBe("kiosk");
    expect(restored.ioRecognizesPlayer).toBe(false);
    expect(restored.ioHasMetPlayer).toBe(true);

    const beat = sampleAftersignIoMemoryBeat(restored);
    expect(beat.recognizesPlayer).toBe(false);
    expect(beat.packetOutcome).toBe("sealed");
  });
});
