// Pure-logic check bundle for failureStingFeedback.ts. Registered in
// aftersign/pure-runner.ts so it executes under `test:aftersign:pure`
// (a chained precondition of `typecheck:aftersign` in package.json).
//
// Why the .ts extension on the import: the sibling module IS a .ts file
// (aftersign/tsconfig.json — `include: ["src"]`, no `allowJs` — refuses
// a .js specifier here because no .js sibling exists to map to). Node's
// --experimental-strip-types accepts .ts paths directly, and tsc under
// moduleResolution:"Bundler" + allowImportingTsExtensions accepts them
// at typecheck, so this specifier resolves deterministically in both
// the pure-runner (Node) and the typecheck pass. This matches the four
// other .ts modules aftersign already ships (orraRuntimeLane.ts,
// recognitionFeedbackBridge.ts, playerMovementFeel.ts,
// ioRecognitionDialogue.ts) — all imported with `.ts` from `.ts`
// siblings and from the plain-JS main.js. Earlier drafts of this
// comment claimed a `.js` specifier because the module was first
// sketched as JS; it landed as .ts to satisfy the typecheck gate,
// but the header comment wasn't refreshed. Fixed now (see PR #1117
// review thread).
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
} from "./failureStingFeedback.ts";

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

  // (7) reducedMotion=true zeroes the LATERAL feel channels — wobble,
  //     cameraKick (yaw+worldX), and hudShake — while preserving the
  //     non-lateral acknowledgement channels (flashAlpha, vignetteAlpha,
  //     hudDropY). Sibling envelopes pin this same split:
  //       feltRecognitionBeat.consumer.test.ts:123
  //       interactionFeelContract.test.ts:62/126/170
  //       durableSave.contract.test.ts:522/581
  //       aftersignConfirmFeel.consumer.test.ts:99
  //     Rationale: on a phone, lateral shake at failure is nauseating;
  //     the flash/vignette/drop still land the "you failed" beat crisply
  //     without motion sickness. The default call path in main.js omits
  //     `options`, so the shipped envelope stays byte-identical to the
  //     non-reduced baseline — this test enforces both halves of that
  //     contract: reducedMotion collapses lateral, and omission does not.
  const reducedPeak = failureStingEnvelopeAt(0, feel, { reducedMotion: true });
  const fullPeak = failureStingEnvelopeAt(0, feel);

  // 7a. Lateral channels must be zeroed under reduced motion.
  assert(reducedPeak.wobble === 0, `reducedMotion must zero wobble (got ${reducedPeak.wobble})`);
  assert(
    reducedPeak.cameraKickDeg === 0,
    `reducedMotion must zero cameraKickDeg (got ${reducedPeak.cameraKickDeg})`,
  );
  assert(
    reducedPeak.cameraKickWorldX === 0,
    `reducedMotion must zero cameraKickWorldX (got ${reducedPeak.cameraKickWorldX})`,
  );
  assert(
    reducedPeak.hudShakePx === 0,
    `reducedMotion must zero hudShakePx (got ${reducedPeak.hudShakePx})`,
  );
  // Derived per-frame kicks (which multiply the feel constants by wobble)
  // must fall out as 0 too — pin them explicitly so a future refactor
  // that stops routing through `wobble` still gets caught.
  assert(
    reducedPeak.cameraKickWorldXCurrent === 0,
    `reducedMotion must zero cameraKickWorldXCurrent (got ${reducedPeak.cameraKickWorldXCurrent})`,
  );
  assert(
    reducedPeak.cameraYawDegreesCurrent === 0,
    `reducedMotion must zero cameraYawDegreesCurrent (got ${reducedPeak.cameraYawDegreesCurrent})`,
  );
  assert(
    reducedPeak.hudShakeX === 0,
    `reducedMotion must zero hudShakeX (got ${reducedPeak.hudShakeX})`,
  );

  // 7b. Non-lateral acknowledgement channels must MATCH the non-reduced
  //     envelope exactly — the player still feels the failure land.
  assertClose(
    reducedPeak.flashAlpha,
    fullPeak.flashAlpha,
    1e-9,
    "reducedMotion must preserve flashAlpha (acknowledgement, not motion)",
  );
  assertClose(
    reducedPeak.vignetteAlpha,
    fullPeak.vignetteAlpha,
    1e-9,
    "reducedMotion must preserve vignetteAlpha",
  );
  assertClose(
    reducedPeak.hudDropY,
    fullPeak.hudDropY,
    1e-9,
    "reducedMotion must preserve hudDropY (vertical drop is not lateral shake)",
  );
  assert(
    reducedPeak.hudDropPx === fullPeak.hudDropPx,
    "reducedMotion must preserve hudDropPx feel constant",
  );

  // 7c. Timing/state channels must NOT be affected — the envelope still
  //     runs for durationMs and reports remainingMs/active identically.
  assert(
    reducedPeak.active === fullPeak.active,
    "reducedMotion must not change active flag at t=0",
  );
  assert(
    reducedPeak.progress === fullPeak.progress,
    "reducedMotion must not change progress",
  );
  assert(
    reducedPeak.remainingMs === fullPeak.remainingMs,
    "reducedMotion must not change remainingMs",
  );
  assert(
    reducedPeak.durationMs === fullPeak.durationMs,
    "reducedMotion must not change durationMs",
  );
  assertClose(
    reducedPeak.falloff,
    fullPeak.falloff,
    1e-9,
    "reducedMotion must not change falloff",
  );
  assertClose(
    reducedPeak.recoveryScale,
    fullPeak.recoveryScale,
    1e-9,
    "reducedMotion must not change recoveryScale",
  );

  // 7d. Byte-identity of the default call path: omitting `options` must
  //     produce the same envelope as `{ reducedMotion: false }`. This is
  //     the guard that keeps the shipped non-reduced envelope unchanged
  //     by this PR — regressions that flip the default would break it.
  const defaultCall = failureStingEnvelopeAt(0, feel);
  const explicitFull = failureStingEnvelopeAt(0, feel, { reducedMotion: false });
  for (const key of Object.keys(defaultCall) as Array<keyof typeof defaultCall>) {
    const a = defaultCall[key];
    const b = explicitFull[key];
    if (typeof a === "number" && typeof b === "number") {
      assertClose(a, b, 1e-12, `default vs {reducedMotion:false} drift on ${String(key)}`);
    } else {
      assert(
        a === b,
        `default vs {reducedMotion:false} drift on ${String(key)} (${String(a)} vs ${String(b)})`,
      );
    }
  }

  // 7e. Mid-window sample — lateral channels stay zeroed across the
  //     whole envelope, not just at t=0. Catches a regression that
  //     applies motionScale only to the peak but lets rawWobble leak
  //     through as t advances.
  for (const ms of [45, 90, 135, 179]) {
    const s = failureStingEnvelopeAt(ms, feel, { reducedMotion: true });
    assert(s.wobble === 0, `reducedMotion mid-window wobble must be 0 (t=${ms}, got ${s.wobble})`);
    assert(
      s.cameraKickWorldXCurrent === 0,
      `reducedMotion mid-window cameraKickWorldXCurrent must be 0 (t=${ms}, got ${s.cameraKickWorldXCurrent})`,
    );
    assert(
      s.hudShakeX === 0,
      `reducedMotion mid-window hudShakeX must be 0 (t=${ms}, got ${s.hudShakeX})`,
    );
  }
};
