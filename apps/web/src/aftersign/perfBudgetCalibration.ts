export type PerfBudgetCalibrationInput = {
  baselineFrameMs: number;
  measuredFrameMs: number;
  slowRunnerFloor: number;
};

export type PerfBudgetCalibration = {
  speedFactor: number;
  evaluateTimingBudgets: boolean;
  annotation: string | null;
};

export function calibratePerfBudget({
  baselineFrameMs,
  measuredFrameMs,
  slowRunnerFloor,
}: PerfBudgetCalibrationInput): PerfBudgetCalibration {
  if (baselineFrameMs <= 0) {
    throw new Error("baselineFrameMs must be greater than 0");
  }

  if (measuredFrameMs <= 0) {
    throw new Error("measuredFrameMs must be greater than 0");
  }

  if (slowRunnerFloor <= 1) {
    throw new Error("slowRunnerFloor must be greater than 1");
  }

  const speedFactor = measuredFrameMs / baselineFrameMs;
  const evaluateTimingBudgets = speedFactor <= slowRunnerFloor;

  return {
    speedFactor,
    evaluateTimingBudgets,
    annotation: evaluateTimingBudgets
      ? null
      : `runner too slow to judge feel — budgets not evaluated (speed factor ${speedFactor.toFixed(
          2,
        )}x)`,
  };
}

export function shouldEvaluatePerfBudget(
  calibration: PerfBudgetCalibration,
): boolean {
  return calibration.evaluateTimingBudgets;
}
