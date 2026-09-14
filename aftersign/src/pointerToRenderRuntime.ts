import {
  measurePointerToRenderLatency,
  type PointerToRenderMeasurement,
} from "./inputAcknowledgeLatency.ts";

export type PointerToRenderLatencySample = {
  pointerAtMs: number;
  renderedAtMs: number;
  deltaMs: number;
  frameBudgetMs: number;
  withinBudget: boolean;
};

export type PointerToRenderLatencyReport = {
  samples: PointerToRenderLatencySample[];
  latest?: PointerToRenderLatencySample;
  worst?: PointerToRenderLatencySample;
};

type PointerIntentInput = {
  pointerAtMs: number;
  pointerId: number;
};

type PointerRenderedInput = {
  renderedAtMs: number;
  pointerId: number;
};

const isPointerIntent = (input: unknown): input is PointerIntentInput => {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Partial<PointerIntentInput>;
  return typeof candidate.pointerAtMs === "number" && typeof candidate.pointerId === "number";
};

const isPointerRendered = (input: unknown): input is PointerRenderedInput => {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Partial<PointerRenderedInput>;
  return typeof candidate.renderedAtMs === "number" && typeof candidate.pointerId === "number";
};

export function createPointerToRenderLatencyRuntime(frameBudgetMs = 16.7) {
  const pendingPointerIntents = new Map<number, number>();
  let samples: PointerToRenderLatencySample[] = [];
  let worst: PointerToRenderLatencySample | undefined;

  const fold = (pointerAtMs: number, renderedAtMs: number, pointerId: number) => {
    const measurement: PointerToRenderMeasurement = measurePointerToRenderLatency(
      { id: `pointer-${pointerId}`, receivedAtMs: pointerAtMs },
      { id: `pointer-${pointerId}`, renderedAtMs },
      frameBudgetMs,
    );
    const sample: PointerToRenderLatencySample = {
      pointerAtMs: measurement.receivedAtMs,
      renderedAtMs: measurement.renderedAtMs,
      deltaMs: measurement.latencyMs,
      frameBudgetMs: measurement.frameBudgetMs,
      withinBudget: measurement.withinOneFrame,
    };
    samples.push(sample);
    if (!worst || sample.deltaMs > worst.deltaMs) worst = sample;
    return sample;
  };

  return {
    reset() {
      pendingPointerIntents.clear();
      samples = [];
      worst = undefined;
    },
    markIntent(input: unknown) {
      if (!isPointerIntent(input)) return;
      pendingPointerIntents.set(input.pointerId, input.pointerAtMs);
    },
    markRendered(input: unknown) {
      if (!isPointerRendered(input)) return;
      const pointerAtMs = pendingPointerIntents.get(input.pointerId);
      if (pointerAtMs === undefined) return;
      pendingPointerIntents.delete(input.pointerId);
      return fold(pointerAtMs, input.renderedAtMs, input.pointerId);
    },
    acknowledgeRenderedFrame(renderedAtMs: number) {
      if (pendingPointerIntents.size === 0) return [];
      const pending = Array.from(pendingPointerIntents.entries());
      pendingPointerIntents.clear();
      return pending.map(([pointerId, pointerAtMs]) =>
        fold(pointerAtMs, renderedAtMs, pointerId),
      );
    },
    report(): PointerToRenderLatencyReport {
      const report: PointerToRenderLatencyReport = { samples: samples.slice() };
      const latest = samples.at(-1);
      if (latest) report.latest = latest;
      if (worst) report.worst = worst;
      return report;
    },
  };
}
