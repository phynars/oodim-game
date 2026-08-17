// AFTERSIGN feel primitive: input → acknowledgement/render latency budget.
//
// The one-frame promise: from the moment the input surface RECEIVES a tap
// to the moment the game ACKNOWLEDGES/RENDERS it, we spend at most one
// 60 Hz frame (16 ms). Anything longer is a dropped promise the player feels
// as sponge.
//
// This module is a pure model — no DOM, no rAF, no timers — so the harness
// can pin the budget from a plain-TS check without booting the WebGL scene.
// A companion e2e spec can measure real end-to-end latency; this file's job
// is the arithmetic + the boundary contract, typecheck-bound by
// aftersign/src/inputAcknowledgeLatency.test.ts.

export const INPUT_ACKNOWLEDGE_LATENCY = {
  FRAME_BUDGET_MS: 16,
  SYNTHETIC_TAP_ID: 'synthetic-tap',
  SYNTHETIC_POINTER_ID: 'synthetic-pointer',
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

export type PointerInputEvent = {
  id: string;
  receivedAtMs: number;
};

export type PointerRenderSignal = {
  id: string;
  renderedAtMs: number;
};

export type PointerToRenderMeasurement = {
  id: string;
  receivedAtMs: number;
  renderedAtMs: number;
  latencyMs: number;
  frameBudgetMs: number;
  withinOneFrame: boolean;
};

function assertFiniteTimestamp(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(
      `input acknowledge latency check failed: ${label} must be finite`,
    );
  }
}

export function measureInputAcknowledgeLatency(
  event: InputAcknowledgeEvent,
  signal: InputAcknowledgeSignal,
  frameBudgetMs: number = INPUT_ACKNOWLEDGE_LATENCY.FRAME_BUDGET_MS,
): InputAcknowledgeMeasurement {
  assertFiniteTimestamp(event.receivedAtMs, 'event.receivedAtMs');
  assertFiniteTimestamp(signal.acknowledgedAtMs, 'signal.acknowledgedAtMs');
  assertFiniteTimestamp(frameBudgetMs, 'frameBudgetMs');

  if (event.id !== signal.id) {
    throw new Error(
      `input acknowledge latency check failed: mismatched ids (expected ${event.id}, got ${signal.id})`,
    );
  }

  if (frameBudgetMs <= 0) {
    throw new Error(
      'input acknowledge latency check failed: frameBudgetMs must be positive',
    );
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

export function measurePointerToRenderLatency(
  event: PointerInputEvent,
  signal: PointerRenderSignal,
  frameBudgetMs: number = INPUT_ACKNOWLEDGE_LATENCY.FRAME_BUDGET_MS,
): PointerToRenderMeasurement {
  assertFiniteTimestamp(event.receivedAtMs, 'event.receivedAtMs');
  assertFiniteTimestamp(signal.renderedAtMs, 'signal.renderedAtMs');
  assertFiniteTimestamp(frameBudgetMs, 'frameBudgetMs');

  if (event.id !== signal.id) {
    throw new Error(
      `input acknowledge latency check failed: mismatched ids (expected ${event.id}, got ${signal.id})`,
    );
  }

  if (frameBudgetMs <= 0) {
    throw new Error(
      'input acknowledge latency check failed: frameBudgetMs must be positive',
    );
  }

  const latencyMs = signal.renderedAtMs - event.receivedAtMs;
  return {
    id: event.id,
    receivedAtMs: event.receivedAtMs,
    renderedAtMs: signal.renderedAtMs,
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

export type SyntheticPointerRenderOptions = {
  receivedAtMs?: number;
  renderedAtMs?: number;
  frameBudgetMs?: number;
};

export function measureSyntheticTapAcknowledge(
  options: SyntheticTapAcknowledgeOptions = {},
): InputAcknowledgeMeasurement {
  const receivedAtMs = options.receivedAtMs ?? 1_000;
  const acknowledgedAtMs = options.acknowledgedAtMs ?? receivedAtMs;
  const frameBudgetMs =
    options.frameBudgetMs ?? INPUT_ACKNOWLEDGE_LATENCY.FRAME_BUDGET_MS;
  return measureInputAcknowledgeLatency(
    {
      id: INPUT_ACKNOWLEDGE_LATENCY.SYNTHETIC_TAP_ID,
      receivedAtMs,
    },
    {
      id: INPUT_ACKNOWLEDGE_LATENCY.SYNTHETIC_TAP_ID,
      acknowledgedAtMs,
    },
    frameBudgetMs,
  );
}

export function measureSyntheticPointerToRender(
  options: SyntheticPointerRenderOptions = {},
): PointerToRenderMeasurement {
  const receivedAtMs = options.receivedAtMs ?? 1_000;
  const renderedAtMs = options.renderedAtMs ?? receivedAtMs;
  const frameBudgetMs =
    options.frameBudgetMs ?? INPUT_ACKNOWLEDGE_LATENCY.FRAME_BUDGET_MS;
  return measurePointerToRenderLatency(
    {
      id: INPUT_ACKNOWLEDGE_LATENCY.SYNTHETIC_POINTER_ID,
      receivedAtMs,
    },
    {
      id: INPUT_ACKNOWLEDGE_LATENCY.SYNTHETIC_POINTER_ID,
      renderedAtMs,
    },
    frameBudgetMs,
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

export function assertSyntheticPointerRenderedWithinOneFrame(
  options: SyntheticPointerRenderOptions = {},
): PointerToRenderMeasurement {
  const measurement = measureSyntheticPointerToRender(options);
  if (!measurement.withinOneFrame) {
    throw new Error(
      `input acknowledge latency check failed: synthetic pointer rendered in ${measurement.latencyMs}ms, over ${measurement.frameBudgetMs}ms frame budget`,
    );
  }
  return measurement;
}

// --- Assertion harness ------------------------------------------------------
// Matches the plain-TS convention used by aftersign/src/packetIntent.ts and
// aftersign/src/ioFirstSessionPacing.test.ts: a generic `assertEqual<T>` and a
// declared `assert(cond, msg): asserts condition` — NOT arrow functions
// (arrow-const declarations reject `asserts` predicates and kill typecheck).

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`input acknowledge latency check failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `input acknowledge latency check failed: ${message} (expected ${String(expected)}, got ${String(actual)})`,
    );
  }
}

export function runInputAcknowledgeLatencyChecks(): void {
  checkImmediateTapAcknowledgesInsideFrame();
  checkSixteenMillisecondTapIsStillInsideFrame();
  checkLateAcknowledgeFailsOneFrameBudget();
  checkNegativeLatencyFailsBudget();
  checkMismatchedSignalIdThrows();
  checkNonPositiveFrameBudgetThrows();
  checkImmediatePointerRendersInsideFrame();
  checkSixteenMillisecondPointerRenderIsStillInsideFrame();
  checkLatePointerRenderFailsOneFrameBudget();
  checkNegativePointerRenderLatencyFailsBudget();
  checkMismatchedPointerRenderIdThrows();
}

function checkImmediateTapAcknowledgesInsideFrame(): void {
  const measurement = assertSyntheticTapAcknowledgedWithinOneFrame({
    receivedAtMs: 2_000,
    acknowledgedAtMs: 2_000,
  });
  assertEqual(measurement.latencyMs, 0, 'immediate tap latency should be zero');
  assertEqual(
    measurement.withinOneFrame,
    true,
    'immediate tap must fit one frame',
  );
}

function checkSixteenMillisecondTapIsStillInsideFrame(): void {
  const measurement = assertSyntheticTapAcknowledgedWithinOneFrame({
    receivedAtMs: 3_000,
    acknowledgedAtMs: 3_016,
  });
  assertEqual(measurement.latencyMs, 16, '16ms tap latency should be accepted');
  assertEqual(
    measurement.withinOneFrame,
    true,
    '16ms tap must fit one frame',
  );
}

function checkLateAcknowledgeFailsOneFrameBudget(): void {
  let thrown: unknown = null;
  try {
    assertSyntheticTapAcknowledgedWithinOneFrame({
      receivedAtMs: 4_000,
      acknowledgedAtMs: 4_017,
    });
  } catch (err) {
    thrown = err;
  }
  assert(thrown instanceof Error, '17ms tap must throw an Error');
  assert(
    /over 16ms frame budget/.test((thrown as Error).message),
    `17ms tap error message mismatch: got ${(thrown as Error).message}`,
  );
}

function checkNegativeLatencyFailsBudget(): void {
  const measurement = measureSyntheticTapAcknowledge({
    receivedAtMs: 5_000,
    acknowledgedAtMs: 4_999,
  });
  assertEqual(
    measurement.withinOneFrame,
    false,
    'negative latency must not pass',
  );
  assertEqual(measurement.latencyMs, -1, 'negative latency should be -1ms');
}

function checkMismatchedSignalIdThrows(): void {
  let thrown: unknown = null;
  try {
    measureInputAcknowledgeLatency(
      { id: 'tap-a', receivedAtMs: 6_000 },
      { id: 'tap-b', acknowledgedAtMs: 6_001 },
    );
  } catch (err) {
    thrown = err;
  }
  assert(thrown instanceof Error, 'mismatched ids must throw an Error');
  assert(
    /mismatched ids/.test((thrown as Error).message),
    `mismatched-id error message mismatch: got ${(thrown as Error).message}`,
  );
}

function checkNonPositiveFrameBudgetThrows(): void {
  let thrown: unknown = null;
  try {
    measureSyntheticTapAcknowledge({
      receivedAtMs: 7_000,
      acknowledgedAtMs: 7_000,
      frameBudgetMs: 0,
    });
  } catch (err) {
    thrown = err;
  }
  assert(thrown instanceof Error, 'zero frameBudgetMs must throw an Error');
  assert(
    /frameBudgetMs must be positive/.test((thrown as Error).message),
    `frameBudgetMs=0 error message mismatch: got ${(thrown as Error).message}`,
  );
}

function checkImmediatePointerRendersInsideFrame(): void {
  const measurement = assertSyntheticPointerRenderedWithinOneFrame({
    receivedAtMs: 8_000,
    renderedAtMs: 8_000,
  });
  assertEqual(
    measurement.latencyMs,
    0,
    'immediate pointer render latency should be zero',
  );
  assertEqual(
    measurement.withinOneFrame,
    true,
    'immediate pointer render must fit one frame',
  );
}

function checkSixteenMillisecondPointerRenderIsStillInsideFrame(): void {
  const measurement = assertSyntheticPointerRenderedWithinOneFrame({
    receivedAtMs: 9_000,
    renderedAtMs: 9_016,
  });
  assertEqual(
    measurement.latencyMs,
    16,
    '16ms pointer render latency should be accepted',
  );
  assertEqual(
    measurement.withinOneFrame,
    true,
    '16ms pointer render must fit one frame',
  );
}

function checkLatePointerRenderFailsOneFrameBudget(): void {
  let thrown: unknown = null;
  try {
    assertSyntheticPointerRenderedWithinOneFrame({
      receivedAtMs: 10_000,
      renderedAtMs: 10_017,
    });
  } catch (err) {
    thrown = err;
  }
  assert(thrown instanceof Error, '17ms pointer render must throw an Error');
  assert(
    /synthetic pointer rendered in 17ms, over 16ms frame budget/.test(
      (thrown as Error).message,
    ),
    `17ms pointer render error message mismatch: got ${(thrown as Error).message}`,
  );
}

function checkNegativePointerRenderLatencyFailsBudget(): void {
  const measurement = measureSyntheticPointerToRender({
    receivedAtMs: 11_000,
    renderedAtMs: 10_999,
  });
  assertEqual(
    measurement.withinOneFrame,
    false,
    'negative pointer render latency must not pass',
  );
  assertEqual(
    measurement.latencyMs,
    -1,
    'negative pointer render latency should be -1ms',
  );
}

function checkMismatchedPointerRenderIdThrows(): void {
  let thrown: unknown = null;
  try {
    measurePointerToRenderLatency(
      { id: 'pointer-a', receivedAtMs: 12_000 },
      { id: 'pointer-b', renderedAtMs: 12_001 },
    );
  } catch (err) {
    thrown = err;
  }
  assert(thrown instanceof Error, 'mismatched pointer ids must throw an Error');
  assert(
    /mismatched ids/.test((thrown as Error).message),
    `mismatched pointer-id error message mismatch: got ${(thrown as Error).message}`,
  );
}
