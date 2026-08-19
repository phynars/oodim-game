import { describe, expect, it } from "vitest";

import {
  createAftersignVerticalSliceState,
  encodeAftersignDurableSave,
} from "../verticalSliceState";
import "./bootWindowGame";

describe.skip("Aftersign tap-confirm harness restore contract", () => {
  it("is covered in windowGameHarnessBoot.test.ts so the pinned aftersign lane runs it", () => {
    expect(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    ).toEqual(expect.any(String));
  });
});
