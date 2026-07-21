import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_IO_FIRST_SCENE_DIALOGUE,
  getAftersignIoFirstSceneLine,
} from "./ioFirstSceneDialogue";

describe("Aftersign Io first-scene dialogue", () => {
  it("keeps every slice line short enough to play in-scene", () => {
    expect(AFTERSIGN_IO_FIRST_SCENE_DIALOGUE).toHaveLength(6);

    for (const line of AFTERSIGN_IO_FIRST_SCENE_DIALOGUE) {
      expect(line.text.length).toBeLessThanOrEqual(96);
    }
  });

  it("frames the packet fork as a concrete trust cost", () => {
    expect(getAftersignIoFirstSceneLine("sealedPacketChoice").text).toContain(
      "seal",
    );
    expect(getAftersignIoFirstSceneLine("openedPacketChoice").text).toContain(
      "learn another",
    );
    expect(getAftersignIoFirstSceneLine("handoffSealed").text).toContain(
      "closed",
    );
    expect(getAftersignIoFirstSceneLine("handoffOpened").text).toContain(
      "cost",
    );
  });
});
