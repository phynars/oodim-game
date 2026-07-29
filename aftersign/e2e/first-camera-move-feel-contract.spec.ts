import { test, expect } from "@playwright/test";
import { runFirstCameraMoveChecks } from "../src/feel/firstCameraMove.test";

// CI-gate for the first camera move feel contract.
//
// This stays in the pure lane: no browser boot, no Worker, no SwiftShader.
// The vertical slice can wire the same authored samples into the opening
// surface later; this spec keeps the first 1.4s of camera motion measurable.

test.describe("AFTERSIGN first camera move feel contract", () => {
  test("runFirstCameraMoveChecks executes authored motion, AV, and mobile-budget invariants without throwing", () => {
    expect(() => runFirstCameraMoveChecks()).not.toThrow();
  });
});
