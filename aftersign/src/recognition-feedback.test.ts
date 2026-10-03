// Pure-logic contract for `aftersign/src/recognition-feedback.ts` — the
// headless recognition-beat feedback model extracted under #2126.
//
// Executed by the plain-Node pure-runner (`aftersign/pure-runner.ts`)
// under `node --experimental-strip-types`, so every relative specifier
// in this subgraph is extension-explicit `.ts`:
//   - this file imports `./recognition-feedback.ts`, which is itself
//     extensionless-relative-import-free (`Math` only).
// Export-only — no top-level invocation — per the pure-runner
// registration checklist in `aftersign/pure-runner.ts`.
//
// Why BOTH files are `.ts`, not `.js`: aftersign/tsconfig.json has no
// `allowJs`; a `.js` leaf under `include: ["src"]` would trip TS7016 in
// the blocking `typecheck:aftersign` lane (Soren's AI008 on the
// packet-choice intent block in `pure-runner.ts` records that exact
// trap). And `pure-runner.ts` imports ONLY `.test.ts` runners by named
// export — vitest is not a dependency of the aftersign pure lane, so a
// `.test.js` + vitest bundle (the first draft of PR #2130) would never
// have executed in CI, leaving the "unit tests cover timing and state
// transitions" criterion in #2126 as an unverified promise. This file
// closes that gap: it IS the registered runner, it DOES run in
// `test:aftersign:pure`.

import {
  RECOGNITION_FEEDBACK_DEFAULTS,
  computeRecognitionFeedbackState,
  detectRecognitionBeat,
  recognitionDomFeedbackMetadata,
  triggerRecognitionAudioCue,
} from "./recognition-feedback.ts";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${String(expected)}, received ${String(actual)}`,
    );
  }
}

function assertDeepEqual<T>(actual: T, expected: T, message: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(`${message}: expected ${b}, received ${a}`);
  }
}

export function checkDetectRecognitionBeat(): void {
  // Beat center lands at durationMs/2 (default 1180/2 = 590). The hit
  // window is ±80ms from center; early/late windows extend to ±180ms;
  // outside the active span `[0, durationMs]` the result is "miss".
  assertEqual(
    detectRecognitionBeat({ beatStartedAtMs: 0, inputAtMs: 590 }).timing,
    "hit",
    "input at beat center classifies as hit",
  );
  assertEqual(
    detectRecognitionBeat({ beatStartedAtMs: 0, inputAtMs: 510 }).timing,
    "hit",
    "input at hit-window edge (center - 80ms) still classifies as hit",
  );
  assertEqual(
    detectRecognitionBeat({ beatStartedAtMs: 0, inputAtMs: 430 }).timing,
    "early",
    "input 160ms before center classifies as early",
  );
  assertEqual(
    detectRecognitionBeat({ beatStartedAtMs: 0, inputAtMs: 750 }).timing,
    "late",
    "input 160ms after center classifies as late",
  );
  assertEqual(
    detectRecognitionBeat({ beatStartedAtMs: 0, inputAtMs: 1181 }).timing,
    "miss",
    "input past the active window classifies as miss",
  );
  assertEqual(
    detectRecognitionBeat({ beatStartedAtMs: 100, inputAtMs: 50 }).timing,
    "miss",
    "input before the beat opens classifies as miss (negative elapsed)",
  );
  // The `active` flag mirrors the span check — true inside [0, durationMs],
  // false outside — so a renderer can decide whether to paint feedback
  // at all without re-doing the arithmetic.
  assertEqual(
    detectRecognitionBeat({ beatStartedAtMs: 0, inputAtMs: 1200 }).active,
    false,
    "active flag matches the span boundary",
  );
}

export function checkComputeRecognitionFeedbackState(): void {
  const hit = computeRecognitionFeedbackState({ timing: "hit", elapsedMs: 590 });
  assertEqual(hit.state, "hit", "hit timing yields hit state");
  assertEqual(hit.acknowledged, true, "hit is acknowledged");
  assertEqual(hit.cue, "recognition-hit", "hit cue token is derivable from state");
  // normalized is `elapsedMs / durationMs` clamped to [0, 1]: 590/1180 = 0.5
  assertEqual(hit.normalized, 0.5, "hit at center yields normalized progress 0.5");

  const miss = computeRecognitionFeedbackState({
    timing: "miss",
    elapsedMs: RECOGNITION_FEEDBACK_DEFAULTS.durationMs,
  });
  assertEqual(miss.state, "miss", "miss timing yields miss state");
  assertEqual(miss.acknowledged, false, "miss is NOT acknowledged");
  assertEqual(miss.cue, "recognition-miss", "miss cue token is derivable from state");
  // Clamp at the upper boundary — the only player-visible crest for a
  // miss is "the window closed", so normalized settles at 1.
  assertEqual(miss.normalized, 1, "miss at the window edge clamps progress to 1");

  // Normalization clamps BELOW zero too — a renderer can safely pass
  // negative elapsed values without producing a sentinel.
  const belowZero = computeRecognitionFeedbackState({
    timing: "miss",
    elapsedMs: -200,
  });
  assertEqual(belowZero.normalized, 0, "normalized clamps to 0 below the window");

  // Early + late carry acknowledgement — the player hit the beat, just
  // not in the center. Downstream feedback can soften without hiding it.
  const early = computeRecognitionFeedbackState({ timing: "early" });
  const late = computeRecognitionFeedbackState({ timing: "late" });
  assertEqual(early.acknowledged, true, "early is acknowledged");
  assertEqual(late.acknowledged, true, "late is acknowledged");
}

export function checkRecognitionDomFeedbackMetadata(): void {
  const feedback = computeRecognitionFeedbackState({ timing: "early", elapsedMs: 300 });
  const metadata = recognitionDomFeedbackMetadata(feedback);
  // Stringified booleans so a caller can hand them straight to
  // `setAttribute` without re-serializing. `progress` is a stringified
  // number for the same reason.
  assertDeepEqual(
    metadata,
    {
      feedback: "early",
      active: "true",
      progress: String(300 / RECOGNITION_FEEDBACK_DEFAULTS.durationMs),
      cue: "recognition-early",
    },
    "DOM metadata echoes the feedback state as attribute-ready strings",
  );
}

export function checkTriggerRecognitionAudioCue(): void {
  const calls: Array<{ cue: string; state: string }> = [];
  const audio = {
    play: (cue: string, feedback: { state: string }) => {
      calls.push({ cue, state: feedback.state });
    },
  };
  const feedback = computeRecognitionFeedbackState({ timing: "late" });
  const dispatched = triggerRecognitionAudioCue(audio, feedback);
  assertEqual(dispatched, true, "dispatch returns true when audio.play is callable");
  assertEqual(calls.length, 1, "dispatch invokes audio.play exactly once");
  assertEqual(calls[0]!.cue, "recognition-late", "cue token matches feedback.cue");
  assertEqual(calls[0]!.state, "late", "feedback object is forwarded intact");

  // Missing / malformed audio argument — the module is DEFENSIVE: a
  // caller that forgets to wire audio should get a quiet false, not a
  // TypeError at the render tick. The caller then decides whether that
  // is a logged misconfiguration or a deliberate no-op (e.g. tests).
  assertEqual(
    triggerRecognitionAudioCue(null, feedback),
    false,
    "null audio handle returns false (no throw)",
  );
  assertEqual(
    triggerRecognitionAudioCue(undefined, feedback),
    false,
    "undefined audio handle returns false (no throw)",
  );
  assertEqual(
    triggerRecognitionAudioCue({}, feedback),
    false,
    "audio handle without a callable play returns false",
  );
}

export function checkDefaultsAreFrozen(): void {
  // The authored windows are shared with any future renderer wire-in;
  // mutating them from a caller would silently drift the classifier.
  // `Object.freeze` is the contract — reds here if someone unfreezes.
  assertEqual(
    Object.isFrozen(RECOGNITION_FEEDBACK_DEFAULTS),
    true,
    "RECOGNITION_FEEDBACK_DEFAULTS is frozen",
  );
}

export function runRecognitionFeedbackModelChecks(): void {
  checkDetectRecognitionBeat();
  checkComputeRecognitionFeedbackState();
  checkRecognitionDomFeedbackMetadata();
  checkTriggerRecognitionAudioCue();
  checkDefaultsAreFrozen();
}
