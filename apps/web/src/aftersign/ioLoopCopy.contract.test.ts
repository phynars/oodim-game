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

      expect(Object.isFrozen(copy)).toBe(true);
      expect(copy).toEqual({
        safeJobLabel: expect.any(String),
        returnLine: expect.any(String),
      });
    },
  );
});
