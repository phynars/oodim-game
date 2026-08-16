import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_TOUCH_FEEL,
  assertAftersignTapChoiceFeel,
  measureAftersignTapChoiceFeel,
} from "./tapChoiceFeel";

describe("AFTERSIGN tap choice feel", () => {
  it("accepts touch choices at the minimum mobile target size", () => {
    const result = measureAftersignTapChoiceFeel({
      width: AFTERSIGN_TOUCH_FEEL.minimumTargetPx,
      height: AFTERSIGN_TOUCH_FEEL.minimumTargetPx,
    });

    expect(result).toEqual({
      ok: true,
      widthPx: AFTERSIGN_TOUCH_FEEL.minimumTargetPx,
      heightPx: AFTERSIGN_TOUCH_FEEL.minimumTargetPx,
      minimumTargetPx: AFTERSIGN_TOUCH_FEEL.minimumTargetPx,
      shortfallPx: 0,
    });
  });

  it("reports the shortfall when a rendered choice is too small to tap reliably", () => {
    const result = measureAftersignTapChoiceFeel({ width: 42, height: 48 });

    expect(result.ok).toBe(false);
    expect(result.shortfallPx).toBe(2);
  });

  it("throws a concrete frame-time failure for undersized tap choices", () => {
    expect(() =>
      assertAftersignTapChoiceFeel({ width: 40, height: 44 }),
    ).toThrow(
      "AFTERSIGN tap choice target is 40x44px; minimum is 44px on both axes",
    );
  });
});
