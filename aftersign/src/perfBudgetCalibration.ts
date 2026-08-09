// AFTERSIGN perf-budget calibration + calibrated evaluator.
//
// The harness pins a one-frame budget on input acknowledgement
// (`inputAcknowledgeLatency.ts`). A budget in wall-clock milliseconds only
// tells the truth on a machine whose baseline frame time matches the target
// device. CI runners drift: a shared-tenant runner under load can spend 30+
// ms per frame doing nothing while a healthy laptop hits 16. Asserting a
// 16 ms budget on the slow runner turns the harness into a coin flip —
// green when the runner is calm, red when it isn't, for reasons unrelated
// to the game's real latency.
//
// The fix is a two-stage evaluator:
//   1. `calibratePerfBudget` produces a `PerfBudgetCalibration` describing
//      the runner's measured vs baseline frame time and whether timing
//      budgets should be evaluated at all.
//   2. `assertInputAcknowledgeAgainstCalibratedBudget` consumes that
//      calibration when it decides whether to hold a real
//      `measureInputAcknowledgeLatency` sample to its budget. When the
//      runner is too slow to judge feel, the assertion is SKIPPED LOUDLY:
//      the returned measurement carries the calibration's annotation and
//      `withinOneFrame` still reflects the raw arithmetic (so callers can
//      log the sample), but no throw is issued for a busted budget.
//
// This module is pure — no DOM, no timers — and lives next to
// `inputAcknowledgeLatency.ts` on purpose: they ship together, they're
// typechecked together under `typecheck:aftersign`, and the plain-Node
// pure-runner executes both bundles in the same lane.

import {
  INPUT_ACKNOWLEDGE_LATENCY,
  measureInputAcknowledgeLatency,
  type InputAcknowledgeEvent,
  type InputAcknowledgeMeasurement,
  type InputAcknowledgeSignal,
} from "./inputAcknowledgeLatency.ts";

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

// Result of running the calibrated evaluator against a single input-
// acknowledge sample. `evaluated` distinguishes an assertion that RAN
// (either passed or would have thrown on failure) from one that was
// skipped because the runner was too slow to judge feel.
export type CalibratedInputAcknowledgeResult = {
  measurement: InputAcknowledgeMeasurement;
  calibration: PerfBudgetCalibration;
  evaluated: boolean;
  annotation: string | null;
};

// Real consumer of `calibratePerfBudget`. Wraps
// `measureInputAcknowledgeLatency` — the existing perf-budget evaluator —
// with calibration gating:
//
//   - Healthy calibration → the sample is measured AND the one-frame
//     budget is enforced. A latency > frameBudgetMs throws with the same
//     message shape as `assertSyntheticTapAcknowledgedWithinOneFrame`,
//     so this API is a drop-in replacement for callers that want the
//     calibration-aware behaviour.
//   - Slow-runner calibration → the sample is still measured (so the
//     latency is visible in returned data / logs), but the throw is
//     SUPPRESSED. `annotation` surfaces the calibration's reason string
//     so the caller can log a loud skip instead of silently swallowing.
export function assertInputAcknowledgeAgainstCalibratedBudget(
  event: InputAcknowledgeEvent,
  signal: InputAcknowledgeSignal,
  calibration: PerfBudgetCalibration,
  frameBudgetMs: number = INPUT_ACKNOWLEDGE_LATENCY.FRAME_BUDGET_MS,
): CalibratedInputAcknowledgeResult {
  const measurement = measureInputAcknowledgeLatency(
    event,
    signal,
    frameBudgetMs,
  );

  if (!calibration.evaluateTimingBudgets) {
    return {
      measurement,
      calibration,
      evaluated: false,
      annotation: calibration.annotation,
    };
  }

  if (!measurement.withinOneFrame) {
    throw new Error(
      `input acknowledge latency check failed: tap acknowledged in ${measurement.latencyMs}ms, over ${measurement.frameBudgetMs}ms frame budget`,
    );
  }

  return {
    measurement,
    calibration,
    evaluated: true,
    annotation: null,
  };
}
