import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_IO_FIRST_SCENE_DIALOGUE,
  composeAftersignIoReturnBeat,
  getAftersignIoFirstSceneLine,
  getAftersignIoPacketReturnLine,
  getAftersignIoRouteReturnLine,
} from "./ioFirstSceneDialogue";
import {
  createAftersignVerticalSliceState,
  meetIoForAftersignSlice,
  recordAftersignPacketChoice,
} from "./verticalSliceRuntimeState";

describe("Aftersign Io first-scene dialogue", () => {
  it("keeps every slice line short enough to play in-scene", () => {
    expect(AFTERSIGN_IO_FIRST_SCENE_DIALOGUE).toHaveLength(7);

    for (const line of AFTERSIGN_IO_FIRST_SCENE_DIALOGUE) {
      expect(line.text.length).toBeLessThanOrEqual(96);
    }
  });

  it("frames the packet fork as a concrete trust cost", () => {
    expect(getAftersignIoFirstSceneLine("packetOffer").text).toContain(
      "Sealed",
    );
    expect(getAftersignIoFirstSceneLine("sealedReturn").text).toContain(
      "unbroken",
    );
    expect(getAftersignIoFirstSceneLine("openedReturn").text).toContain(
      "did not",
    );
  });

  it("pins packet return lines to the recognition-contract memory keys", () => {
    expect(getAftersignIoPacketReturnLine("sealed")).toMatchObject({
      id: "sealedReturn",
      memoryKey: "io_return_packet_sealed",
    });
    expect(getAftersignIoPacketReturnLine("opened")).toMatchObject({
      id: "openedReturn",
      memoryKey: "io_return_packet_opened",
    });
  });

  it("pins route return lines to the route memory keys", () => {
    expect(getAftersignIoRouteReturnLine(true).memoryKey).toBe(
      "listened_to_route",
    );
    expect(getAftersignIoRouteReturnLine(false).memoryKey).toBe(
      "skipped_route",
    );
  });

  it("composes Io's return beat from the live vertical-slice state", () => {
    const sealed = meetIoForAftersignSlice(
      recordAftersignPacketChoice(
        createAftersignVerticalSliceState(),
        "sealed",
      ),
    );
    const beat = composeAftersignIoReturnBeat(sealed, {
      listenedToRoute: true,
    });
    expect(beat.packetLine.memoryKey).toBe("io_return_packet_sealed");
    expect(beat.routeLine.memoryKey).toBe("listened_to_route");
  });

  it("refuses to compose a return beat before the packet fork commits", () => {
    const state = createAftersignVerticalSliceState();
    expect(() =>
      composeAftersignIoReturnBeat(state, { listenedToRoute: false }),
    ).toThrow(/packetOutcome is not committed/);
  });
});
