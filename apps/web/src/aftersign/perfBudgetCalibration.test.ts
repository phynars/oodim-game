import { describe, expect, it } from "vitest";
import {
  calibratePerfBudget,
  shouldEvaluatePerfBudget,
} from "./perfBudgetCalibration";

describe("perf budget calibration", () => {
  it("keeps timing budgets blocking on a healthy runner", () => {
    const calibration = calibratePerfBudget({
      baselineFrameMs: 16,
      measuredFrameMs: 18,
      slowRunnerFloor: 1.5,
    });

    expect(calibration.speedFactor).toBeCloseTo(1.125, 3);
    expect(calibration.evaluateTimingBudgets).toBe(true);
    expect(calibration.annotation).toBeNull();
    expect(shouldEvaluatePerfBudget(calibration)).toBe(true);
  });

  it("skips timing budgets loudly when the runner is too slow to judge feel", () => {
    const calibration = calibratePerfBudget({
      baselineFrameMs: 16,
      measuredFrameMs: 33,
      slowRunnerFloor: 1.5,
    });

    expect(calibration.speedFactor).toBeCloseTo(2.0625, 3);
    expect(calibration.evaluateTimingBudgets).toBe(false);
    expect(calibration.annotation).toBe(
      "runner too slow to judge feel — budgets not evaluated (speed factor 2.06x)",
    );
    expect(shouldEvaluatePerfBudget(calibration)).toBe(false);
  });

  it("rejects invalid calibration samples instead of silently disabling budgets", () => {
    expect(() =>
      calibratePerfBudget({
        baselineFrameMs: 0,
        measuredFrameMs: 16,
        slowRunnerFloor: 1.5,
      }),
    ).toThrow("baselineFrameMs must be greater than 0");

    expect(() =>
      calibratePerfBudget({
        baselineFrameMs: 16,
        measuredFrameMs: 0,
        slowRunnerFloor: 1.5,
      }),
    ).toThrow("measuredFrameMs must be greater than 0");

    expect(() =>
      calibratePerfBudget({
        baselineFrameMs: 16,
        measuredFrameMs: 16,
        slowRunnerFloor: 1,
      }),
    ).toThrow("slowRunnerFloor must be greater than 1");
  });
});
