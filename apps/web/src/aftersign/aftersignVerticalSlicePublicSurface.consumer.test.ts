import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_IO_RECOGNITION_FEEL,
  AFTERSIGN_INTERACTION_CONFIRM_FEEL,
  AFTERSIGN_KIOSK_SCENE_FEEL,
  createAftersignVerticalSliceState,
} from "./verticalSliceState";

describe("Aftersign vertical-slice public surface", () => {
  it("keeps the runnable slice state and feel contracts available from one import", () => {
    const state = createAftersignVerticalSliceState();

    expect(state).toEqual(expect.any(Object));
    expect(AFTERSIGN_KIOSK_SCENE_FEEL).toEqual(expect.any(Object));
    expect(AFTERSIGN_IO_RECOGNITION_FEEL).toEqual(expect.any(Object));
    expect(AFTERSIGN_INTERACTION_CONFIRM_FEEL).toEqual(expect.any(Object));
  });
});
