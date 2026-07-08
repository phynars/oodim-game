export type InputLatencySample = {
  inputTs: number;
  frameTs: number;
  latencyMs: number;
  source: string;
};

export type InputLatencyProbe = {
  markInput: (source: string) => void;
  flush: () => InputLatencySample[];
  latest: () => InputLatencySample | null;
};

export function createInputLatencyProbe(maxSamples = 240): InputLatencyProbe {
  let pendingInput: { ts: number; source: string } | null = null;
  const samples: InputLatencySample[] = [];

  const tick = (frameTs: number) => {
    if (pendingInput === null) {
      requestAnimationFrame(tick);
      return;
    }

    const sample: InputLatencySample = {
      inputTs: pendingInput.ts,
      frameTs,
      latencyMs: Math.max(0, frameTs - pendingInput.ts),
      source: pendingInput.source,
    };

    samples.push(sample);
    if (samples.length > maxSamples) {
      samples.splice(0, samples.length - maxSamples);
    }

    pendingInput = null;
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);

  return {
    markInput(source: string) {
      pendingInput = { ts: performance.now(), source };
    },
    flush() {
      const out = samples.slice();
      samples.length = 0;
      return out;
    },
    latest() {
      return samples.length > 0 ? samples[samples.length - 1] : null;
    },
  };
}
