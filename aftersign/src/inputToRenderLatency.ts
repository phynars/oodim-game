// Input-to-render latency primitives for the AFTERSIGN feel harness.
//
// Split of concerns (mirrors aftersign/src/recognitionBeat.ts / .test.ts):
//   - THIS FILE: pure primitives — event/sample/report shapes plus the
//     five composable functions the tick loop and the check bundle
//     both call (create → mark → sample → append → aggregate → check).
//     No test bodies, no top-level side effects.
//   - `./inputToRenderLatency.test.ts`: the `run*Checks()` bundle that
//     exercises the primitives here. Convention across the aftersign
//     `src/**` tree: `.test.ts` OWNS the checks; the sibling module
//     ships production code only. See recognitionBeat.test.ts header
//     for the same rule.

export type InputToRenderEvent = {
  id: string;
  inputAtMs: number;
  renderedAtMs?: number | null;
};

export type InputToRenderLatencyBudget = {
  maxLatencyMs: number;
  targetFrameMs: number;
};

export type InputToRenderLatencySample = {
  id: string;
  latencyMs: number;
  frames: number;
  withinBudget: boolean;
};

export type InputToRenderLatencyReport = {
  budget: InputToRenderLatencyBudget;
  samples: InputToRenderLatencySample[];
  maxLatencyMs: number;
  averageLatencyMs: number;
  allWithinBudget: boolean;
};

export const DEFAULT_INPUT_TO_RENDER_LATENCY_BUDGET: InputToRenderLatencyBudget = {
  maxLatencyMs: 16.7,
  targetFrameMs: 16.7,
};

// Rolling window: how many recent samples the live reporter retains.
// Chosen to cover ~2s at 60fps — long enough to spot a stutter cluster,
// short enough that one bad frame does not latch the report forever.
export const INPUT_TO_RENDER_SAMPLE_WINDOW = 120;

const assertFiniteNumber = (value: number, label: string) => {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
};

const assertBudget = (budget: InputToRenderLatencyBudget) => {
  assertFiniteNumber(budget.maxLatencyMs, "budget.maxLatencyMs");
  assertFiniteNumber(budget.targetFrameMs, "budget.targetFrameMs");
};

export const createInputToRenderEvent = ({
  id,
  inputAtMs,
}: {
  id: string;
  inputAtMs: number;
}): InputToRenderEvent => {
  if (!id) {
    throw new Error("input-to-render event id is required");
  }
  assertFiniteNumber(inputAtMs, "inputAtMs");
  return { id, inputAtMs, renderedAtMs: null };
};

export const markInputRendered = (
  event: InputToRenderEvent,
  renderedAtMs: number,
): InputToRenderEvent => {
  assertFiniteNumber(renderedAtMs, "renderedAtMs");
  if (renderedAtMs < event.inputAtMs) {
    throw new Error("renderedAtMs must not be earlier than inputAtMs");
  }
  return { ...event, renderedAtMs };
};

export const sampleInputToRenderLatency = (
  event: InputToRenderEvent,
  budget: InputToRenderLatencyBudget = DEFAULT_INPUT_TO_RENDER_LATENCY_BUDGET,
): InputToRenderLatencySample => {
  if (event.renderedAtMs === undefined || event.renderedAtMs === null) {
    throw new Error(`input-to-render event ${event.id} has not rendered yet`);
  }
  assertBudget(budget);
  const latencyMs = Number((event.renderedAtMs - event.inputAtMs).toFixed(3));
  return {
    id: event.id,
    latencyMs,
    frames: Number((latencyMs / budget.targetFrameMs).toFixed(3)),
    withinBudget: latencyMs <= budget.maxLatencyMs,
  };
};

// Pure aggregator over already-computed samples.  This is the primitive the
// live tick loop calls each frame: push one sample, aggregate the window.
// Callers that only have events should use `reportInputToRenderLatency`,
// which maps events → samples → this aggregator.
export const aggregateInputToRenderSamples = (
  samples: InputToRenderLatencySample[],
  budget: InputToRenderLatencyBudget = DEFAULT_INPUT_TO_RENDER_LATENCY_BUDGET,
): InputToRenderLatencyReport => {
  if (samples.length === 0) {
    throw new Error("at least one input-to-render sample is required");
  }
  assertBudget(budget);
  let totalLatencyMs = 0;
  let maxLatencyMs = -Infinity;
  let allWithinBudget = true;
  for (const sample of samples) {
    totalLatencyMs += sample.latencyMs;
    if (sample.latencyMs > maxLatencyMs) maxLatencyMs = sample.latencyMs;
    if (!sample.withinBudget) allWithinBudget = false;
  }
  return {
    budget,
    samples,
    maxLatencyMs,
    averageLatencyMs: Number((totalLatencyMs / samples.length).toFixed(3)),
    allWithinBudget,
  };
};

export const reportInputToRenderLatency = (
  events: InputToRenderEvent[],
  budget: InputToRenderLatencyBudget = DEFAULT_INPUT_TO_RENDER_LATENCY_BUDGET,
): InputToRenderLatencyReport => {
  if (events.length === 0) {
    throw new Error("at least one input-to-render event is required");
  }
  const samples = events.map((event) => sampleInputToRenderLatency(event, budget));
  return aggregateInputToRenderSamples(samples, budget);
};

// Append a sample to a rolling window, bounded by `windowSize`.  Returns a
// new array so callers can treat state as immutable; the oldest samples are
// dropped once the window is full.  Freeing the latch is a natural side
// effect: one bad frame ages out after `windowSize` good frames.
export const appendInputToRenderSample = (
  samples: InputToRenderLatencySample[],
  next: InputToRenderLatencySample,
  windowSize: number = INPUT_TO_RENDER_SAMPLE_WINDOW,
): InputToRenderLatencySample[] => {
  if (!Number.isInteger(windowSize) || windowSize <= 0) {
    throw new Error("windowSize must be a positive integer");
  }
  if (samples.length < windowSize) {
    return [...samples, next];
  }
  return [...samples.slice(samples.length - windowSize + 1), next];
};

export const checkInputToRenderLatency = (
  report: InputToRenderLatencyReport,
): InputToRenderLatencyReport => {
  if (!report.allWithinBudget) {
    const offenders = report.samples
      .filter((sample) => !sample.withinBudget)
      .map((sample) => `${sample.id}:${sample.latencyMs}ms`)
      .join(", ");
    throw new Error(
      `input-to-render latency exceeded ${report.budget.maxLatencyMs}ms budget: ${offenders}`,
    );
  }
  return report;
};
