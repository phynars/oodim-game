// Plain-TS check bundle for aftersign/src/inputToRenderLatency.ts.
//
// Repo convention (see aftersign/src/recognitionBeat.test.ts header,
// aftersign/README.md): `run*Checks()` lives in the sibling `.test.ts`,
// the production module ships primitives only. Registered in
// aftersign/pure-runner.ts and executed by `test:aftersign:pure`.
//
// No top-level invocation — the pure-runner is the single call site;
// a top-level call here would double-execute the bundle at import time.

import {
  aggregateInputToRenderSamples,
  appendInputToRenderSample,
  checkInputToRenderLatency,
  createInputToRenderEvent,
  DEFAULT_INPUT_TO_RENDER_LATENCY_BUDGET,
  INPUT_TO_RENDER_SAMPLE_WINDOW,
  markInputRendered,
  reportInputToRenderLatency,
  sampleInputToRenderLatency,
} from "./inputToRenderLatency.ts";
// `InputToRenderLatencySample` is TYPE-ONLY: `node --experimental-strip-types`
// (used by `test:aftersign:pure`) leaves runtime imports intact, so a bare
// value-import of a type name throws "does not provide an export named X" at
// module link time. `import type` — supported by the erasable-syntax mode —
// is dropped entirely by the stripper, so no runtime lookup is emitted.
import type { InputToRenderLatencySample } from "./inputToRenderLatency.ts";

const sampleFromLatency = (
  id: string,
  inputAtMs: number,
  renderedAtMs: number,
): InputToRenderLatencySample =>
  sampleInputToRenderLatency(
    markInputRendered(
      createInputToRenderEvent({ id, inputAtMs }),
      renderedAtMs,
    ),
  );

const checkPureModule = (): void => {
  // Happy-path: two good frames pass event → report → check.
  const firstFrame = markInputRendered(
    createInputToRenderEvent({ id: "keyboard-forward", inputAtMs: 1000 }),
    1016.2,
  );
  const touchFrame = markInputRendered(
    createInputToRenderEvent({ id: "touch-pad-diagonal", inputAtMs: 2000 }),
    2014.8,
  );
  const report = reportInputToRenderLatency([firstFrame, touchFrame]);
  checkInputToRenderLatency(report);
  if (!report.allWithinBudget) {
    throw new Error("two good frames must be within budget");
  }

  // Slow frame: rejected by checkInputToRenderLatency.
  const slowFrame = markInputRendered(
    createInputToRenderEvent({ id: "slow-frame", inputAtMs: 3000 }),
    3022,
  );
  let rejectedSlowFrame = false;
  try {
    checkInputToRenderLatency(reportInputToRenderLatency([slowFrame]));
  } catch {
    rejectedSlowFrame = true;
  }
  if (!rejectedSlowFrame) {
    throw new Error("input-to-render latency check must reject a frame over budget");
  }
};

const checkSampleDirectAggregator = (): void => {
  // Sample-direct aggregator: same result as event-based path, no round-trip.
  const firstFrame = markInputRendered(
    createInputToRenderEvent({ id: "aggregate-a", inputAtMs: 0 }),
    12,
  );
  const touchFrame = markInputRendered(
    createInputToRenderEvent({ id: "aggregate-b", inputAtMs: 100 }),
    114,
  );
  const eventReport = reportInputToRenderLatency([firstFrame, touchFrame]);
  const sampleA = sampleInputToRenderLatency(firstFrame);
  const sampleB = sampleInputToRenderLatency(touchFrame);
  const aggregated = aggregateInputToRenderSamples([sampleA, sampleB]);
  if (aggregated.samples.length !== 2) {
    throw new Error("aggregateInputToRenderSamples must preserve sample count");
  }
  if (aggregated.maxLatencyMs !== eventReport.maxLatencyMs) {
    throw new Error("aggregateInputToRenderSamples must match event-based max latency");
  }
  if (aggregated.averageLatencyMs !== eventReport.averageLatencyMs) {
    throw new Error("aggregateInputToRenderSamples must match event-based average");
  }
  if (!aggregated.allWithinBudget) {
    throw new Error("aggregated good samples must be within budget");
  }
};

const checkRollingWindow = (): void => {
  // Rolling window: cap enforced, oldest samples drop first.
  let roll: InputToRenderLatencySample[] = [];
  for (let i = 0; i < INPUT_TO_RENDER_SAMPLE_WINDOW + 10; i++) {
    roll = appendInputToRenderSample(
      roll,
      sampleFromLatency(`roll-${i}`, i * 16, i * 16 + 12),
    );
  }
  if (roll.length !== INPUT_TO_RENDER_SAMPLE_WINDOW) {
    throw new Error(
      `rolling window must cap at ${INPUT_TO_RENDER_SAMPLE_WINDOW}, got ${roll.length}`,
    );
  }
  if (roll[0]!.id !== `roll-10`) {
    throw new Error("rolling window must drop oldest samples first");
  }
  if (roll[roll.length - 1]!.id !== `roll-${INPUT_TO_RENDER_SAMPLE_WINDOW + 9}`) {
    throw new Error("rolling window must retain newest sample at tail");
  }
};

const checkLatchRelease = (): void => {
  // Latch release: a bad frame ages out of the window after enough good frames.
  const budget = DEFAULT_INPUT_TO_RENDER_LATENCY_BUDGET;
  let latch: InputToRenderLatencySample[] = [];
  latch = appendInputToRenderSample(
    latch,
    sampleFromLatency("bad-frame", 0, budget.maxLatencyMs + 20),
  );
  if (aggregateInputToRenderSamples(latch).allWithinBudget) {
    throw new Error("a bad frame must fail the aggregated report while it is in-window");
  }
  for (let i = 0; i < INPUT_TO_RENDER_SAMPLE_WINDOW; i++) {
    latch = appendInputToRenderSample(
      latch,
      sampleFromLatency(`good-${i}`, i * 16, i * 16 + 10),
    );
  }
  const latchReport = aggregateInputToRenderSamples(latch);
  if (!latchReport.allWithinBudget) {
    throw new Error("rolling window must release the latch once the bad frame ages out");
  }
  if (latch.length !== INPUT_TO_RENDER_SAMPLE_WINDOW) {
    throw new Error("rolling window must remain capped after latch release");
  }
};

export const runInputToRenderLatencyChecks = (): void => {
  checkPureModule();
  checkSampleDirectAggregator();
  checkRollingWindow();
  checkLatchRelease();
};
