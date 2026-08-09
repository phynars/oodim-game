// Plain-TS check bundle for `perfBudgetCalibration.ts`. Executed by the
// `test:aftersign:pure` lane via `aftersign/pure-runner.ts` — the runner
// imports `runPerfBudgetCalibrationChecks` and invokes it under
// `node --experimental-strip-types`. Every relative specifier below is
// `.ts`-extensioned so the runner's extension-resolution contract holds.

import {
  assertInputAcknowledgeAgainstCalibratedBudget,
  calibratePerfBudget,
  shouldEvaluatePerfBudget,
  type PerfBudgetCalibration,
} from "./perfBudgetCalibration.ts";
import {
  INPUT_ACKNOWLEDGE_LATENCY,
  type InputAcknowledgeEvent,
  type InputAcknowledgeSignal,
} from "./inputAcknowledgeLatency.ts";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`perf budget calibration check failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `perf budget calibration check failed: ${message} (expected ${String(
        expected,
      )}, got ${String(actual)})`,
    );
  }
}

function assertClose(
  actual: number,
  expected: number,
  epsilon: number,
  message: string,
): void {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(
      `perf budget calibration check failed: ${message} (expected ${expected} ±${epsilon}, got ${actual})`,
    );
  }
}

export function runPerfBudgetCalibrationChecks(): void {
  checkHealthyRunnerKeepsBudgetsBlocking();
  checkSlowRunnerSkipsBudgetsLoudly();
  checkRejectsInvalidCalibrationSamples();
  checkCalibratedEvaluatorEnforcesBudgetWhenHealthy();
  checkCalibratedEvaluatorThrowsOnOverBudgetWhenHealthy();
  checkCalibratedEvaluatorSkipsBudgetOnSlowRunner();
}

function checkHealthyRunnerKeepsBudgetsBlocking(): void {
  const calibration = calibratePerfBudget({
    baselineFrameMs: 16,
    measuredFrameMs: 18,
    slowRunnerFloor: 1.5,
  });

  assertClose(
    calibration.speedFactor,
    1.125,
    1e-9,
    "18ms/16ms → 1.125x speed factor",
  );
  assertEqual(
    calibration.evaluateTimingBudgets,
    true,
    "healthy runner must keep timing budgets evaluated",
  );
  assertEqual(
    calibration.annotation,
    null,
    "healthy runner must not carry a skip annotation",
  );
  assertEqual(
    shouldEvaluatePerfBudget(calibration),
    true,
    "shouldEvaluatePerfBudget must agree with calibration",
  );
}

function checkSlowRunnerSkipsBudgetsLoudly(): void {
  const calibration = calibratePerfBudget({
    baselineFrameMs: 16,
    measuredFrameMs: 33,
    slowRunnerFloor: 1.5,
  });

  assertClose(
    calibration.speedFactor,
    33 / 16,
    1e-9,
    "33ms/16ms speed factor",
  );
  assertEqual(
    calibration.evaluateTimingBudgets,
    false,
    "runner above slowRunnerFloor must skip timing budgets",
  );
  assertEqual(
    calibration.annotation,
    "runner too slow to judge feel — budgets not evaluated (speed factor 2.06x)",
    "slow runner must surface a loud annotation",
  );
  assertEqual(
    shouldEvaluatePerfBudget(calibration),
    false,
    "shouldEvaluatePerfBudget must agree on slow runner",
  );
}

function checkRejectsInvalidCalibrationSamples(): void {
  expectThrows(
    () =>
      calibratePerfBudget({
        baselineFrameMs: 0,
        measuredFrameMs: 16,
        slowRunnerFloor: 1.5,
      }),
    /baselineFrameMs must be greater than 0/,
    "zero baselineFrameMs must throw",
  );

  expectThrows(
    () =>
      calibratePerfBudget({
        baselineFrameMs: 16,
        measuredFrameMs: 0,
        slowRunnerFloor: 1.5,
      }),
    /measuredFrameMs must be greater than 0/,
    "zero measuredFrameMs must throw",
  );

  expectThrows(
    () =>
      calibratePerfBudget({
        baselineFrameMs: 16,
        measuredFrameMs: 16,
        slowRunnerFloor: 1,
      }),
    /slowRunnerFloor must be greater than 1/,
    "slowRunnerFloor at the trivial floor must throw",
  );
}

// The calibration wiring's point: a real perf-budget evaluator
// (measureInputAcknowledgeLatency) is what the calibration gates. A
// healthy runner keeps the evaluator strict — a within-budget sample
// passes and the assertion is reported as `evaluated: true`.
function checkCalibratedEvaluatorEnforcesBudgetWhenHealthy(): void {
  const healthy: PerfBudgetCalibration = calibratePerfBudget({
    baselineFrameMs: 16,
    measuredFrameMs: 16,
    slowRunnerFloor: 1.5,
  });

  const event: InputAcknowledgeEvent = {
    id: INPUT_ACKNOWLEDGE_LATENCY.SYNTHETIC_TAP_ID,
    receivedAtMs: 1_000,
  };
  const signal: InputAcknowledgeSignal = {
    id: INPUT_ACKNOWLEDGE_LATENCY.SYNTHETIC_TAP_ID,
    acknowledgedAtMs: 1_010,
  };

  const result = assertInputAcknowledgeAgainstCalibratedBudget(
    event,
    signal,
    healthy,
  );

  assertEqual(
    result.evaluated,
    true,
    "healthy runner must evaluate the budget",
  );
  assertEqual(
    result.measurement.latencyMs,
    10,
    "measurement.latencyMs must reflect the sample",
  );
  assertEqual(
    result.measurement.withinOneFrame,
    true,
    "10ms tap on a 16ms budget must be within one frame",
  );
  assertEqual(
    result.annotation,
    null,
    "healthy evaluation must carry no annotation",
  );
}

// The other half of "strict when healthy": a busted budget on a healthy
// runner must throw the same-shape error the sibling
// `assertSyntheticTapAcknowledgedWithinOneFrame` produces, so downstream
// harness code can rely on a single failure mode.
function checkCalibratedEvaluatorThrowsOnOverBudgetWhenHealthy(): void {
  const healthy = calibratePerfBudget({
    baselineFrameMs: 16,
    measuredFrameMs: 16,
    slowRunnerFloor: 1.5,
  });

  expectThrows(
    () =>
      assertInputAcknowledgeAgainstCalibratedBudget(
        {
          id: INPUT_ACKNOWLEDGE_LATENCY.SYNTHETIC_TAP_ID,
          receivedAtMs: 2_000,
        },
        {
          id: INPUT_ACKNOWLEDGE_LATENCY.SYNTHETIC_TAP_ID,
          acknowledgedAtMs: 2_020,
        },
        healthy,
      ),
    /over 16ms frame budget/,
    "20ms tap on a 16ms budget must throw when calibration is healthy",
  );
}

// The core promise: on a slow runner, the SAME over-budget sample that
// would throw above must NOT throw — the calibration gates the assertion.
// The measurement still surfaces the raw latency (so callers can log the
// sample) and the annotation makes the skip audible.
function checkCalibratedEvaluatorSkipsBudgetOnSlowRunner(): void {
  const slow = calibratePerfBudget({
    baselineFrameMs: 16,
    measuredFrameMs: 33,
    slowRunnerFloor: 1.5,
  });

  const event: InputAcknowledgeEvent = {
    id: INPUT_ACKNOWLEDGE_LATENCY.SYNTHETIC_TAP_ID,
    receivedAtMs: 3_000,
  };
  const signal: InputAcknowledgeSignal = {
    id: INPUT_ACKNOWLEDGE_LATENCY.SYNTHETIC_TAP_ID,
    // Deliberately over budget: 20ms > 16ms.
    acknowledgedAtMs: 3_020,
  };

  const result = assertInputAcknowledgeAgainstCalibratedBudget(
    event,
    signal,
    slow,
  );

  assertEqual(
    result.evaluated,
    false,
    "slow runner must skip the budget assertion",
  );
  assertEqual(
    result.measurement.latencyMs,
    20,
    "measurement still reflects the raw latency on skip",
  );
  assertEqual(
    result.measurement.withinOneFrame,
    false,
    "raw arithmetic still marks the sample as over budget on skip",
  );
  assert(
    result.annotation !== null &&
      /runner too slow to judge feel/.test(result.annotation),
    `slow-runner skip must carry the loud annotation, got ${String(
      result.annotation,
    )}`,
  );
}

function expectThrows(
  fn: () => unknown,
  pattern: RegExp,
  label: string,
): void {
  let thrown: unknown = null;
  try {
    fn();
  } catch (err) {
    thrown = err;
  }
  assert(thrown instanceof Error, `${label}: expected an Error`);
  assert(
    pattern.test((thrown as Error).message),
    `${label}: message ${(thrown as Error).message} did not match ${pattern}`,
  );
}
