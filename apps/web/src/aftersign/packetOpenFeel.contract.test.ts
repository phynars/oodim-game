import { describe, expect, it } from "vitest";

import {
  createAftersignVerticalSliceState,
  recordAftersignPacketChoice,
  resolveAftersignPacketConfirmInteraction,
  sampleAftersignPacketConfirmInteractionEnvelope,
} from "./verticalSliceState";

describe("Aftersign packet-open feel contract", () => {
  it("locks the packet-open confirm beat to a readable mid-tear impact frame", () => {
    const opened = recordAftersignPacketChoice(
      createAftersignVerticalSliceState(),
      "opened",
    );
    const { kind } = resolveAftersignPacketConfirmInteraction(opened);

    const envelope = sampleAftersignPacketConfirmInteractionEnvelope(kind, 110);

    expect(envelope.kind).toBe("packetOpen");
    if (envelope.kind === "packetOpen") {
      expect(envelope.label).toBe("packet-open");
      expect(envelope.tearProgress).toBeCloseTo(0.5, 5);
      expect(envelope.sealScale).toBeCloseTo(1.04, 5);
      expect(envelope.cameraShakePx).toBeCloseTo(1.5, 5);
      expect(envelope.waxShardOpacity).toBeCloseTo(1 - 110 / 260, 5);
    }
  });
});
