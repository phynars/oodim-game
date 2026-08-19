import { describe, expect, it } from "vitest";

import {
  PHONE_TAP_TARGET_MIN_GAP_PX,
  measureTapTargetAdjacency,
} from "./mobileTapTargetFeel";

describe("AFTERSIGN mobile tap target adjacency", () => {
  it("passes when spaced buttons meet the minimum gap", () => {
    const report = measureTapTargetAdjacency([
      { id: "packet-fragile", x: 16, y: 680, width: 96, height: 48 },
      { id: "packet-quiet", x: 124, y: 680, width: 96, height: 48 },
      { id: "packet-public", x: 232, y: 680, width: 96, height: 48 },
    ]);

    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.pairCount).toBe(3);
    expect(report.minGapPx).toBe(PHONE_TAP_TARGET_MIN_GAP_PX);
  });

  it("flags overlapping buttons with the overlap kind", () => {
    const report = measureTapTargetAdjacency([
      { id: "confirm", x: 16, y: 720, width: 64, height: 48 },
      { id: "cancel", x: 32, y: 732, width: 64, height: 48 },
    ]);

    expect(report.ok).toBe(false);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0].kind).toBe("overlap");
    expect(report.issues[0].ids).toEqual(["confirm", "cancel"]);
    expect(report.issues[0].gapPx).toBe(0);
  });

  it("flags too-close but non-overlapping buttons", () => {
    // 2px horizontal gap — well under the 8px minimum.
    const report = measureTapTargetAdjacency([
      { id: "tone-soft", x: 16, y: 720, width: 64, height: 48 },
      { id: "tone-blunt", x: 82, y: 720, width: 64, height: 48 },
    ]);

    expect(report.ok).toBe(false);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0].kind).toBe("too-close");
    expect(report.issues[0].gapPx).toBe(2);
  });

  it("does not re-check per-target size (that contract lives in tapChoiceFeel)", () => {
    // A 36x44 target is undersized on width, but this module's
    // job is pairwise adjacency — the size shortfall is reported
    // by measureAftersignTapChoiceFeel, not here. With only one
    // target there are zero pairs, so the report is vacuously ok.
    const report = measureTapTargetAdjacency([
      { id: "tone-sharp", x: 16, y: 720, width: 36, height: 44 },
    ]);

    expect(report.ok).toBe(true);
    expect(report.pairCount).toBe(0);
    expect(report.issues).toEqual([]);
  });

  it("honors a custom minimum gap", () => {
    const report = measureTapTargetAdjacency(
      [
        { id: "a", x: 0, y: 0, width: 48, height: 48 },
        { id: "b", x: 60, y: 0, width: 48, height: 48 },
      ],
      16,
    );

    // 12px gap < 16px override → flagged.
    expect(report.ok).toBe(false);
    expect(report.issues[0].kind).toBe("too-close");
    expect(report.issues[0].gapPx).toBe(12);
    expect(report.minGapPx).toBe(16);
  });
});
