import { describe, expect, it } from "vitest";

import {
  composeAftersignIoReturnBeat,
  getAftersignIoRouteReturnLine,
} from "./ioFirstSceneDialogue";
import { createAftersignVerticalSliceState } from "./verticalSliceRuntimeState";

describe("Io's route-return production dialogue contract", () => {
  it("selects the authored skipped-route line for the visible 'I ran early' choice", () => {
    const state = createAftersignVerticalSliceState();
    state.packetOutcome = "sealed";

    expect(getAftersignIoRouteReturnLine(false)).toMatchObject({
      id: "skippedReturn",
      text: "You skipped my route. Instinct carried you once. It will not learn the next stair.",
      memoryKey: "skipped_route",
    });
    expect(composeAftersignIoReturnBeat(state, { listenedToRoute: false }).routeLine.id).toBe(
      "skippedReturn",
    );
  });
});
