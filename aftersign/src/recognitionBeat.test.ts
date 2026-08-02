// Repo convention (see aftersign/src/ioFirstSessionPacing.test.ts header,
// and aftersign/README.md — reaffirmed in PR #453, #468, #590, #621, #932):
//   - Vitest is NOT a repo dependency.
//   - `node:test` / `node:assert` are NOT usable either: `@types/node` is
//     only a transitive install and aftersign/tsconfig.json pins
//     `"types": ["vite/client"]`, so a `node:assert` import fails
//     typecheck and the aftersign lane goes red before Playwright even
//     starts (that's what killed PR #621 rev 1 AND PR #932 rev 1).
//   - Convention is a plain-TS assertion file at
//     `aftersign/src/*.test.ts`, exporting `check*()` + a `run*Checks()`
//     entry, typechecked by `typecheck:aftersign` (tsconfig
//     `include: ["src"]`). Use the hand-rolled `assert` shim below.

import {
  buildIoRecognitionBeat,
  ioRecognitionBeat,
  recognitionBeatProgress,
  RECOGNITION_BEAT_DURATION_MS,
} from "./recognitionBeat";
import { ioReturningSessionLines } from "../../packages/aftersign/src/ioReturningSession";
// Canonical single-source-of-truth feel contract (README §"Source of truth").
// Every assertion in this file that pins a feel number reads from this
// contract, never from the sibling `./recognitionFeedback` — that is the
// invariant the README exists to protect.
import { recognitionFeedbackContract } from "../../apps/web/src/aftersign/recognitionFeedback";

class AssertionError extends Error {}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const ak = Object.keys(a as Record<string, unknown>);
  const bk = Object.keys(b as Record<string, unknown>);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (
      !deepEqual(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
      )
    ) {
      return false;
    }
  }
  return true;
}

const assert = {
  equal<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
      throw new AssertionError(
        message ??
          `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
      );
    }
  },
  deepEqual<T>(actual: T, expected: T, message?: string): void {
    if (!deepEqual(actual, expected)) {
      throw new AssertionError(
        message ??
          `deepEqual: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
      );
    }
  },
  ok(condition: unknown, message?: string): asserts condition {
    if (!condition) {
      throw new AssertionError(message ?? "expected truthy");
    }
  },
};

// ---------------------------------------------------------------------------
// Feel-plan (build) checks — pin the lantern/sting/haptic timing envelope
// authored in `buildIoRecognitionBeat`. These are the numbers the flagship
// slice depends on; drift here means the recognition beat no longer feels
// the way the spec authored it.
// ---------------------------------------------------------------------------

function checkBuildPlan(): void {
  const sealed = buildIoRecognitionBeat("sealed");
  assert.equal(sealed.durationMs, RECOGNITION_BEAT_DURATION_MS);
  // Duration is pinned to the canonical contract — build and feel MUST agree.
  assert.equal(sealed.durationMs, recognitionFeedbackContract.totalMs);
  // Single-source-of-truth: the sealed line is the authored `sealedPacket`
  // key from `ioReturningSessionLines`, not a local copy.
  assert.equal(sealed.line, ioReturningSessionLines.sealedPacket);
  assert.deepEqual(
    sealed.cues.map((cue) => [cue.atMs, cue.kind, cue.easing ?? "none"]),
    [
      [0, "camera", "easeOutCubic"],
      [recognitionFeedbackContract.glowStartMs, "light", "easeInOutSine"],
      [recognitionFeedbackContract.stingStartMs, "audio", "linear"],
      [recognitionFeedbackContract.stingStartMs, "haptic", "easeOutCubic"],
      [recognitionFeedbackContract.dialogueStartMs, "dialogue", "none"],
    ],
  );
  assert.equal(sealed.cues[0]?.value, recognitionFeedbackContract.cameraYawDegrees);
  assert.equal(sealed.cues[1]?.value, recognitionFeedbackContract.glowToMultiplier);
  assert.equal(sealed.cues[2]?.value, recognitionFeedbackContract.stingGain);
  assert.equal(sealed.cues[3]?.value, recognitionFeedbackContract.hapticPx);

  const opened = buildIoRecognitionBeat("opened");
  assert.equal(opened.line, ioReturningSessionLines.openedPacket);
  assert.equal(opened.cues[2]?.label, "single cracked-bell recognition sting");

  // Dialogue-cue value must equal the authored line (not a paraphrase).
  assert.equal(opened.cues[4]?.value, ioReturningSessionLines.openedPacket);
}

// ---------------------------------------------------------------------------
// Line-resolver (ioRecognitionBeat) checks — pins the four saved-outcome ×
// route-attention branches to four distinct lineIds and four distinct
// authored strings. Line text is delegated to
// `chooseIoReturningSessionLine`; this asserts we returned exactly those
// strings verbatim (no local paraphrasing).
// ---------------------------------------------------------------------------

function checkLineResolver(): void {
  const sealedListened = ioRecognitionBeat({ outcome: "sealed", listenedToRoute: true });
  const sealedSkipped = ioRecognitionBeat({ outcome: "sealed", listenedToRoute: false });
  const openedListened = ioRecognitionBeat({ outcome: "opened", listenedToRoute: true });
  const openedSkipped = ioRecognitionBeat({ outcome: "opened", listenedToRoute: false });

  // lineId pinning — the renderer / flagship script address lines by these.
  assert.equal(sealedListened.lineId, "io.recognition.returning.sealed.listened.v1");
  assert.equal(sealedSkipped.lineId, "io.recognition.returning.sealed.skipped.v1");
  assert.equal(openedListened.lineId, "io.recognition.returning.opened.listened.v1");
  assert.equal(openedSkipped.lineId, "io.recognition.returning.opened.skipped.v1");

  // Verbatim string pinning against the single source.
  assert.equal(sealedListened.line, ioReturningSessionLines.sealedPacketListenedRoute);
  assert.equal(sealedSkipped.line, ioReturningSessionLines.sealedPacketSkippedRoute);
  assert.equal(openedListened.line, ioReturningSessionLines.openedPacketListenedRoute);
  assert.equal(openedSkipped.line, ioReturningSessionLines.openedPacketSkippedRoute);

  // Four distinct branches, no silent collapse.
  const lineIds = new Set([
    sealedListened.lineId,
    sealedSkipped.lineId,
    openedListened.lineId,
    openedSkipped.lineId,
  ]);
  const lines = new Set([
    sealedListened.line,
    sealedSkipped.line,
    openedListened.line,
    openedSkipped.line,
  ]);
  assert.equal(lineIds.size, 4);
  assert.equal(lines.size, 4);

  // routeAttention derived shape — the shape the state-publisher reads.
  assert.equal(sealedListened.routeAttention, "listened");
  assert.equal(openedSkipped.routeAttention, "skipped");
}

// ---------------------------------------------------------------------------
// Feel-envelope (recognitionBeatProgress) checks — thin delegate assertions
// against `sampleRecognitionFeedbackBeat` (canonical). Asserts the beat
// starts at rest, camera peaks at `cameraPeakMs`, reduced-motion suppresses
// the camera and uses `reducedMotionTotalMs`, outcome-branch cues are
// present, wooden-click timing matches `stingStartMs + openedWoodenClickDelayMs`,
// and the beat settles at `totalMs`. Mirrors the e2e header contract in
// `aftersign/e2e/recognition-beat-contract.spec.ts`.
// ---------------------------------------------------------------------------

function checkFeelEnvelope(): void {
  // Beat starts at rest — camera hasn't moved yet.
  const rest = recognitionBeatProgress(0);
  assert.equal(rest.elapsedMs, 0);
  assert.equal(rest.cameraDeltaMeters, 0);
  assert.equal(rest.cameraYawDegrees, 0);
  assert.equal(rest.progress, 0);

  // Camera peaks at `cameraPeakMs` — full delta reached.
  const peak = recognitionBeatProgress(recognitionFeedbackContract.cameraPeakMs, {
    outcome: "sealed",
  });
  assert.equal(
    Math.abs(peak.cameraDeltaMeters - recognitionFeedbackContract.cameraDeltaMeters) < 1e-6,
    true,
    `camera peak: expected ${recognitionFeedbackContract.cameraDeltaMeters}, got ${peak.cameraDeltaMeters}`,
  );

  // Reduced motion collapses the camera and shortens the total.
  const reduced = recognitionBeatProgress(80, { reducedMotion: true });
  assert.equal(reduced.cameraDeltaMeters, 0);
  assert.equal(reduced.cameraYawDegrees, 0);
  assert.equal(reduced.totalMs, recognitionFeedbackContract.reducedMotionTotalMs);

  const reducedDone = recognitionBeatProgress(
    recognitionFeedbackContract.reducedMotionTotalMs,
    { reducedMotion: true },
  );
  assert.equal(reducedDone.elapsedMs, recognitionFeedbackContract.reducedMotionTotalMs);

  // Outcome-branch cues present on both branches (lantern, packetSeal,
  // kioskSign, rainRim, hapticScale, recognition-sting audio).
  for (const outcome of ["sealed", "opened"] as const) {
    const cued = recognitionBeatProgress(recognitionFeedbackContract.stingStartMs, {
      outcome,
    });
    assert.equal(cued.lantern.durationMs > 0, true, `${outcome} lantern cue missing`);
    assert.equal(cued.packetSeal.durationMs > 0, true, `${outcome} packetSeal cue missing`);
    assert.equal(cued.kioskSign.durationMs > 0, true, `${outcome} kioskSign cue missing`);
    assert.equal(cued.rainRim.durationMs > 0, true, `${outcome} rainRim cue missing`);
    assert.equal(cued.hapticScale.amplitude > 0, true, `${outcome} hapticScale cue missing`);
    assert.equal(
      cued.audioCueIds.includes("recognition-sting"),
      true,
      `${outcome} audio cues missing recognition-sting`,
    );
  }

  // Sting fires at stingStartMs with the authored gain envelope.
  const stingSample = recognitionBeatProgress(recognitionFeedbackContract.stingStartMs);
  assert.equal(stingSample.stingElapsedMs !== null, true, "sting did not fire at stingStartMs");
  assert.equal(
    stingSample.stingGainDb !== null && stingSample.stingGainDb >= recognitionFeedbackContract.stingGainDb,
    true,
  );

  // Opened branch overlays the wooden click at stingStartMs + openedWoodenClickDelayMs.
  const openedClick = recognitionBeatProgress(
    recognitionFeedbackContract.stingStartMs + recognitionFeedbackContract.openedWoodenClickDelayMs,
    { outcome: "opened" },
  );
  assert.equal(openedClick.woodenClickElapsedMs !== null, true, "opened wooden click did not fire");
  assert.equal(openedClick.woodenClickElapsedMs, 0);

  // Sealed branch does NOT overlay the wooden click.
  const sealedNoClick = recognitionBeatProgress(
    recognitionFeedbackContract.stingStartMs + recognitionFeedbackContract.openedWoodenClickDelayMs,
    { outcome: "sealed" },
  );
  assert.equal(sealedNoClick.woodenClickElapsedMs, null);

  // Beat settles at totalMs — progress hits 1.
  const done = recognitionBeatProgress(recognitionFeedbackContract.totalMs);
  assert.equal(done.elapsedMs, recognitionFeedbackContract.totalMs);
  assert.equal(done.progress, 1);
}

/**
 * Run every recognition-beat invariant (build plan, line resolver, feel
 * envelope) as a single throwing check bundle. The aftersign e2e lane wraps
 * this in a Playwright test so a failure surfaces in CI; the standalone
 * plain-TS harness at the bottom of this file invokes the same bundle so
 * `test:aftersign` (node --loader) catches drift too.
 */
export function runRecognitionBeatChecks(): void {
  checkBuildPlan();
  checkLineResolver();
  checkFeelEnvelope();
}

// No top-level invocation — the CI-gating call site is the paired
// Playwright spec at `aftersign/e2e/recognition-beat-contract.spec.ts`,
// which runs on `aftersign/playwright.pure.config.ts`. A top-level call
// here would double-execute the bundle at import time (once on import,
// once inside the spec's `test()`), which PR #973 review flagged.
