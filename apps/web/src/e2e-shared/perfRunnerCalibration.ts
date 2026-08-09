export type PerfRunnerCalibration = {
  elapsedMs: number;
  speedFactor: number;
  tooSlow: boolean;
  annotation: string;
};

export type PerfRunnerCalibrationOptions = {
  floorSpeedFactor: number;
  iterations?: number;
  workload?: () => number;
};

const DEFAULT_ITERATIONS = 400_000;

function defaultWorkload(): number {
  let x = 0;
  for (let i = 0; i < 64; i += 1) {
    x += Math.sqrt(i * 17.13 + x * 0.001);
  }
  return x;
}

export function calibratePerfRunner(
  options: PerfRunnerCalibrationOptions,
): PerfRunnerCalibration {
  const iterations = options.iterations ?? DEFAULT_ITERATIONS;
  const workload = options.workload ?? defaultWorkload;
  const start = performance.now();

  let sink = 0;
  for (let i = 0; i < iterations; i += 1) {
    sink += workload();
  }

  const elapsedMs = performance.now() - start;
  // Prevent dead-code elimination in benchmarks.
  if (!Number.isFinite(sink)) {
    throw new Error("Calibration workload produced a non-finite value");
  }

  const baselineMs = 160;
  const speedFactor = baselineMs / Math.max(elapsedMs, 1);
  const tooSlow = speedFactor < options.floorSpeedFactor;

  return {
    elapsedMs,
    speedFactor,
    tooSlow,
    annotation: tooSlow
      ? `runner too slow to judge feel — budgets not evaluated (speed=${speedFactor.toFixed(3)}x, elapsed=${elapsedMs.toFixed(1)}ms)`
      : `runner calibration healthy (speed=${speedFactor.toFixed(3)}x, elapsed=${elapsedMs.toFixed(1)}ms)`,
  };
}
