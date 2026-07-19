export const INPUT_ACKNOWLEDGE_LATENCY = {
  FRAME_BUDGET_MS: 16,
  SYNTHETIC_TAP_ID: "synthetic-tap",
} as const;

export type InputAcknowledgeEvent = {
  id: string;
  receivedAtMs: number;
};

export type InputAcknowledgeSignal = {
  id: string;
  acknowledgedAtMs: number;
};

export type InputAcknowledgeMeasurement = {
  id: string;
  receivedAtMs: number;
  acknowledgedAtMs: number;
  latencyMs: number;
  frameBudgetMs: number;
  withinOneFrame: boolean;
};

function assertFiniteTimestamp(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`input acknowledge latency check failed: ${label} must be finite`);
  }
}

export function measureInputAcknowledgeLatency(
  event: InputAcknowledgeEvent,
  signal: InputAcknowledgeSignal,
  frameBudgetMs = INPUT_ACKNOWLEDGE_LATENCY.FRAME_BUDGET_MS,
): InputAcknowledgeMeasurement {
  assertFiniteTimestamp(event.receivedAtMs, "event.receivedAtMs");
  assertFiniteTimestamp(signal.acknowledgedAtMs, "signal.acknowledgedAtMs");
  assertFiniteTimestamp(frameBudgetMs, "frameBudgetMs");

  if (event.id !== signal.id) {
    throw new Error(
      `input acknowledge latency check failed: mismatched ids (expected ${event.id}, got ${signal.id})`,
    );
  }

  if (frameBudgetMs <= 0) {
    throw new Error("input acknowledge latency check failed: frameBudgetMs must be positive");
  }

  const latencyMs = signal.acknowledgedAtMs - event.receivedAtMs;
  return {
    id: event.id,
    receivedAtMs: event.receivedAtMs,
    acknowledgedAtMs: signal.acknowledgedAtMs,
    latencyMs,
    frameBudgetMs,
    withinOneFrame: latencyMs >= 0 && latencyMs <= frameBudgetMs,
  };
}

export type SyntheticTapAcknowledgeOptions = {
  receivedAtMs?: number;
  acknowledgedAtMs?: number;
  frameBudgetMs?: number;
};

export function measureSyntheticTapAcknowledge(
  options: SyntheticTapAcknowledgeOptions = {},
): InputAcknowledgeMeasurement {
  const receivedAtMs = options.receivedAtMs ?? 1_000;
  const acknowledgedAtMs = options.acknowledgedAtMs ?? receivedAtMs;
  return measureInputAcknowledgeLatency(
    {
      id: INPUT_ACKNOWLEDGE_LATENCY.SYNTHETIC_TAP_ID,
      receivedAtMs,
    },
    {
      id: INPUT_ACKNOWLEDGE_LATENCY.SYNTHETIC_TAP_ID,
      acknowledgedAtMs,
    },
    options.frameBudgetMs ?? INPUT_ACKNOWLEDGE_LATENCY.FRAME_BUDGET_MS,
  );
}

export function assertSyntheticTapAcknowledgedWithinOneFrame(
  options: SyntheticTapAcknowledgeOptions = {},
): InputAcknowledgeMeasurement {
  const measurement = measureSyntheticTapAcknowledge(options);
  if (!measurement.withinOneFrame) {
    throw new Error(
      `input acknowledge latency check failed: synthetic tap acknowledged in ${measurement.latencyMs}ms, over ${measurement.frameBudgetMs}ms frame budget`,
    );
  }
  return measurement;
}

export function runInputAcknowledgeLatencyChecks(): void {
  checkImmediateTapAcknowledgesInsideFrame();
  checkSixteenMillisecondTapIsStillInsideFrame();
  checkLateAcknowledgeFailsOneFrameBudget();
  checkNegativeLatencyFailsBudget();
  checkMismatchedSignalIdThrows();
}

function checkImmediateTapAcknowledgesInsideFrame(): void {
  const measurement = assertSyntheticTapAcknowledgedWithinOneFrame({
    receivedAtMs: 2_000,
    acknowledgedAtMs: 2_000,
  });
  assertEqual(measurement.latencyMs, 0, "immediate tap latency should be zero");
  assertEqual(measurement.withinOneFrame, true, "immediate tap must fit one frame");
}

function checkSixteenMillisecondTapIsStillInsideFrame(): void {
  const measurement = assertSyntheticTapAcknowledgedWithinOneFrame({
    receivedAtMs: 3_000,
    acknowledgedAtMs: 3_016,
  });
  assertEqual(measurement.latencyMs, 16, "16ms tap latency should be accepted");
  assertEqual(measurement.withinOneFrame, true, "16ms tap must fit one frame");
}

function checkLateAcknowledgeFailsOneFrameBudget(): void {
  let failed = false;
  try {
    assertSyntheticTapAcknowledgedWithinOneFrame({
      receivedAtMs: 4_000,
      acknowledgedAtMs: 4_017,
    });
  } catch (error) {
    failed = error instanceof Error && error.message.includes("over 16ms frame budget");
  }
  assertEqual(failed, true, "17ms tap latency must fail the one-frame budget");
}

function checkNegativeLatencyFailsBudget(): void {
  const measurement = measureSyntheticTapAcknowledge({
    receivedAtMs: 5_000,
    acknowledgedAtMs: 4_999,
  });
  assertEqual(measurement.withinOneFrame, false, "negative latency must not pass");
}

function checkMismatchedSignalIdThrows(): void {
  let failed = false;
  try {
    measureInputAcknowledgeLatency(
      { id: "tap-a", receivedAtMs: 6_000 },
      { id: "tap-b", acknowledgedAtMs: 6_001 },
    );
  } catch (error) {
    failed = error instanceof Error && error.message.includes("mismatched ids");
  }
  assertEqual(failed, true, "mismatched acknowledge signal id must fail");
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `input acknowledge latency check failed: ${message} (expected ${String(expected)}, got ${String(actual)})`,
    );
  }
}
