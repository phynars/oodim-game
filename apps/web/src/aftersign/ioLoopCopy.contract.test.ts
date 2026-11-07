import { describe, expect, it } from "vitest";

import { getAftersignIoLoopCopy } from "./ioLoopCopy";
import type { AftersignPacketOutcome, AftersignVerticalSliceState } from "./verticalSliceRuntimeState";

function stateFor(packetOutcome: AftersignPacketOutcome | null): AftersignVerticalSliceState {
  return { packetOutcome } as AftersignVerticalSliceState;
}

describe("getAftersignIoLoopCopy", () => {
  it.each<AftersignPacketOutcome | null>([null, "sealed", "opened"])(
    "returns a frozen bundle for %s",
    (packetOutcome) => {
      const copy = getAftersignIoLoopCopy(stateFor(packetOutcome));

      const authoritative = ioOfferCopyFor(packetOutcome);

      expect(Object.isFrozen(copy)).toBe(true);
      // Pin the adapter to the single authoritative module: any drift between
      // the apps/web surface and aftersign/src/ioLoopCopy.js fails here.
      expect(copy).toEqual({
        safeJobLabel: authoritative.safeJobLabel,
        returnLine: authoritative.returnLine,
      });
      expect(copy.safeJobLabel.trim()).not.toBe("");
      expect(copy.returnLine.trim()).not.toBe("");
    },
  );

  it("gives each packet outcome its own safe-job label and return line", () => {
    const bundles = ([null, "sealed", "opened"] as const).map((outcome) =>
      getAftersignIoLoopCopy(stateFor(outcome)),
    );

    expect(new Set(bundles.map((b) => b.safeJobLabel)).size).toBe(3);
    expect(new Set(bundles.map((b) => b.returnLine)).size).toBe(3);
  });

  it("keeps the heading in the same authoritative bundle as the job copy", () => {
    for (const outcome of [null, "sealed", "opened"] as const) {
      expect(ioOfferHeading(outcome)).toBe(ioOfferCopyFor(outcome).heading);
    }
  });
});
