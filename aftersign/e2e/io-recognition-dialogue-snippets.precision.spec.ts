import { expect, test } from "@playwright/test";
import { isWithinFrameSampleTolerance } from "../../apps/web/src/aftersign/aftersignE2eDeterminism";

// Regression boundary for the hosted Io recognition failure: 0.179414 is
// still mid-transition for an authored 0.18 terminus. The e2e must therefore
// keep waiting, rather than relaxing its player-visible end-state contract.
test("Io recognition rejects a mid-transition vignette sample", () => {
  expect(isWithinFrameSampleTolerance(0.179414, 0.18)).toBe(false);
  expect(isWithinFrameSampleTolerance(0.18, 0.18)).toBe(true);
});
