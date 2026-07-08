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
  /**
   * Cancels the internal rAF loop and marks the probe dead. Idempotent.
   * MUST be called on unmount / HMR teardown — without it, every reload
   * stacks another orphaned rAF loop that survives the module swap.
   * After dispose(): markInput is a no-op, tick will not reschedule,
   * and any in-flight rAF callback bails on entry.
   */
  dispose: () => void;
};

export function createInputLatencyProbe(maxSamples = 240): InputLatencyProbe {
  let pendingInput: { ts: number; source: string } | null = null;
  const samples: InputLatencySample[] = [];
  let rafHandle: number | null = null;
  let disposed = false;

  const tick = (frameTs: number) => {
    // The callback may fire AFTER dispose() if the browser had already
    // committed to invoking it — bail immediately, do not reschedule.
    if (disposed) {
      rafHandle = null;
      return;
    }

    if (pendingInput === null) {
      rafHandle = requestAnimationFrame(tick);
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
    rafHandle = requestAnimationFrame(tick);
  };

  rafHandle = requestAnimationFrame(tick);

  return {
    markInput(source: string) {
      if (disposed) return;
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
    dispose() {
      if (disposed) return;
      disposed = true;
      if (rafHandle !== null) {
        cancelAnimationFrame(rafHandle);
        rafHandle = null;
      }
      pendingInput = null;
    },
  };
}
