import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_JOB_TAKE_FEEL,
  resolveAftersignJobTakeFeel,
} from "./aftersignJobTakeFeel.js";

describe("AFTERSIGN_JOB_TAKE_FEEL", () => {
  it("pins the take-job tactile envelope to a short tap-scale-glow pop", () => {
    expect(AFTERSIGN_JOB_TAKE_FEEL).toMatchObject({
      kind: "aftersign-job-take",
      durationMs: 420,
      holdMs: 96,
      travelPx: 14,
      scaleFrom: 0.97,
      scalePeak: 1.025,
      settleScale: 1,
      glowPeakOpacity: 0.72,
      glowSettleOpacity: 0,
      shadowLiftPx: 6,
      easing: {
        press: "cubic-bezier(0.2, 0.9, 0.25, 1)",
        release: "cubic-bezier(0.16, 1, 0.3, 1)",
        glow: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      audio: {
        cue: "job-tag-catch",
        startMs: 18,
        peakMs: 96,
      },
    });
  });

  it("resolves a branch-specific action id with route and risk copy", () => {
    expect(
      resolveAftersignJobTakeFeel({
        actionId: "take-job-orra-name-risk",
        route: "Cross behind the shuttered pharmacy before the bells count twice.",
        risk: "Short route. Unlit. Better pay because Io trusts your hands.",
      }),
    ).toMatchObject({
      actionId: "take-job-orra-name-risk",
      ariaLabel: "Accepted orra name risk",
      route: "Cross behind the shuttered pharmacy before the bells count twice.",
      risk: "Short route. Unlit. Better pay because Io trusts your hands.",
    });
  });

  it("falls back to a deterministic unknown-job label for malformed input", () => {
    expect(resolveAftersignJobTakeFeel({ actionId: "" })).toMatchObject({
      actionId: "take-job-unknown",
      ariaLabel: "Accepted unknown",
      route: "",
      risk: "",
    });
  });
});
