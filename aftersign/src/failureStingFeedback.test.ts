// Pure-logic check bundle for failureStingFeedback.js. Registered in
// aftersign/pure-runner.ts so it executes under `test:aftersign:pure`
// (a chained precondition of `typecheck:aftersign` in package.json).
//
// Why the .js extension on the import: the module is authored in plain
// JS (no types to add value; it's a tiny envelope-math surface consumed
// by the plain-JS main.js). Node's --experimental-strip-types leaves
// .js paths alone — it only strips TS syntax from .ts files — so
// importing "./failureStingFeedback.js" from this .ts file resolves
// deterministically in both the pure-runner (Node) and the typecheck
// pass (moduleResolution: "Bundler"), which is the same duality
// documented at the top of packetIntent.test.ts.
//
// Contract pinned here (verbatim mirror of the e2e's assertions on
// `state.interaction.failureFeedback` at packet-hold-threshold.spec.ts:140-144
// — that test drives the CANCELLED gesture through the runtime scene;
// this bundle drives the envelope math directly so a regression fails
// in the deterministic pure lane BEFORE the SwiftShader-backed e2e
// lane has to catch it):
//   1. flashAlpha AT t=0  === DEFAULT_FAILURE_STING_FEEL.flashAlpha (0.34, the peak)
//   2. flashAlpha AT t=durationMs === 0 (envelope has fully decayed)
//   3. active flips false at t >= durationMs (matches the tick fold at
//      main.js:2009 — `failureEnvelope.active` is what mirrors into state)
//   4. remainingMs is monotonic non-increasing across [0, durationMs]
//   5. durationMs on the returned envelope MUST equal feel.durationMs
//      (the e2e pins `.durationMs === 180` via a `toBe`).

import {
  DEFAULT_FAILURE_STING_FEEL,
  failureStingEnvelopeAt,
} from "./failureStingFeedback.js";

const assert = (cond: unknown, msg: string): void => {
  if (!cond) {
    throw new Error(`failureStingFeedback: ${msg}`);
  }
};

const assertClose = (actual: number, expected: number, tolerance: number, msg: string): void => {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(
      `failureStingFeedback: ${msg} — expected ${expected} ±${tolerance}, got ${actual}`,
    );
  }
};

export const runFailureStingFeedbackChecks = (): void => {
  const feel = DEFAULT_FAILURE_STING_FEEL;

  // Sanity: the feel constant a downstream reader keys off (the e2e's
  // `.toBe(0.34)` pin, and main.js's FAILURE_FEEDBACK = DEFAULT_...).
  assert(feel.flashAlpha === 0.34, `DEFAULT_FAILURE_STING_FEEL.flashAlpha drifted from 0.34 (got ${feel.flashAlpha})`);
  assert(feel.durationMs === 180, `DEFAULT_FAILURE_STING_FEEL.durationMs drifted from 180 (got ${feel.durationMs})`);

  // (1) t=0 is the envelope peak. progress=0 → curve=0 → falloff=1 →
  //     flashAlpha = 1 * feel.flashAlpha = 0.34. This is the value the
  //     RENDER path uses off the returned envelope (main.js:1986); it
  //     is NOT the value the STATE surface carries (state keeps the
  //     un-scaled constant so the e2e's `.toBe(0.34)` pin holds every
  //     frame, not just at t=0).
  const t0 = failureStingEnvelopeAt(0, feel);
  assertClose(t0.flashAlpha, feel.flashAlpha, 1e-9, "envelope flashAlpha at t=0 must equal the feel peak");
  assert(t0.active === true, "envelope must be active at t=0");
  assert(t0.remainingMs === feel.durationMs, `envelope remainingMs at t=0 must equal durationMs (got ${t0.remainingMs})`);
  assert(t0.durationMs === feel.durationMs, "envelope durationMs must mirror feel.durationMs");

  // (2) End of window — flashAlpha decays to 0 by t=durationMs.
  const tEnd = failureStingEnvelopeAt(feel.durationMs, feel);
  assertClose(tEnd.flashAlpha, 0, 1e-9, "envelope flashAlpha at t=durationMs must be 0");

  // (3) `active` flips false at (and past) durationMs. This is the
  //     property the tick fold (main.js:2009) mirrors into
  //     state.interaction.failureFeedback.active, so a regression here
  //     would leak a stuck-active sting into the state surface.
  assert(tEnd.active === false, "envelope must be inactive at t=durationMs");
  const tPast = failureStingEnvelopeAt(feel.durationMs + 16, feel);
  assert(tPast.active === false, "envelope must stay inactive past durationMs");
  assert(tPast.remainingMs === 0, `remainingMs past durationMs must be 0 (got ${tPast.remainingMs})`);

  // (4) remainingMs is monotonic non-increasing across the window.
  //     The e2e asserts remainingMs > 0 AND <= durationMs at the moment
  //     of drift-cancel; this stronger monotonicity pin catches a
  //     regression that clamps or wraps mid-window.
  let prevRemaining = t0.remainingMs;
  for (let ms = 0; ms <= feel.durationMs; ms += 16) {
    const sample = failureStingEnvelopeAt(ms, feel);
    assert(
      sample.remainingMs <= prevRemaining,
      `remainingMs must be non-increasing (t=${ms}: prev=${prevRemaining}, curr=${sample.remainingMs})`,
    );
    assert(
      sample.remainingMs >= 0 && sample.remainingMs <= feel.durationMs,
      `remainingMs must stay in [0, ${feel.durationMs}] (t=${ms}: got ${sample.remainingMs})`,
    );
    prevRemaining = sample.remainingMs;
  }

  // (5) durationMs on the return value MUST equal feel.durationMs at
  //     every sample — the e2e's `.durationMs === 180` `toBe` pin
  //     would break if this ever scaled with time.
  for (const ms of [0, 45, 90, 135, 179, 180]) {
    const sample = failureStingEnvelopeAt(ms, feel);
    assert(
      sample.durationMs === feel.durationMs,
      `envelope durationMs must not scale with time (t=${ms}: got ${sample.durationMs})`,
    );
  }

  // (6) Non-finite elapsed times must not throw and must yield an
  //     inactive envelope — the runtime call sites read
  //     `state.interaction.failureStartedAt` which can be null on a
  //     cold boot; the caller in main.js already guards this, but pin
  //     the property so a future refactor that hands NaN through the
  //     envelope produces a defined (inactive) result instead of
  //     spraying NaN across HUD styles.
  const tNaN = failureStingEnvelopeAt(Number.NaN, feel);
  assert(tNaN.active === false, "NaN elapsedMs must yield an inactive envelope");
};
