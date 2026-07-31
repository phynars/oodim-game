import { strict as assert } from "node:assert";
import {
  buildIoRecognitionBeat,
  ioRecognitionBeat,
  recognitionBeatProgress,
  RECOGNITION_BEAT_DURATION_MS,
} from "./recognitionBeat";
import { ioReturningSessionLines } from "../../packages/aftersign/src/ioReturningSession";
import {
  RECOGNITION_FEEDBACK_TOTAL_MS,
  RECOGNITION_FEEDBACK_REDUCED_MOTION_MS,
  RECOGNITION_FEEDBACK_STING_START_MS,
  RECOGNITION_FEEDBACK_STING_GAIN_DB,
  RECOGNITION_FEEDBACK_OPENED_CLICK_DELAY_MS,
} from "./recognitionFeedback";

// ---------------------------------------------------------------------------
// Feel-plan (build) checks — pin the lantern/sting/haptic timing envelope
// authored in `buildIoRecognitionBeat`. These are the numbers the flagship
// slice depends on; drift here means the recognition beat no longer feels
// the way the spec authored it.
// ---------------------------------------------------------------------------

function checkBuildPlan(): void {
  const sealed = buildIoRecognitionBeat("sealed");
  assert.equal(sealed.durationMs, RECOGNITION_BEAT_DURATION_MS);
  assert.equal(sealed.durationMs, 1640);
  // Single-source-of-truth: the sealed line is the authored `sealedPacket`
  // key from `ioReturningSessionLines`, not a local copy.
  assert.equal(sealed.line, ioReturningSessionLines.sealedPacket);
  assert.deepEqual(
    sealed.cues.map((cue) => [cue.atMs, cue.kind, cue.easing ?? "none"]),
    [
      [0, "camera", "easeOutCubic"],
      [80, "light", "easeInOutSine"],
      [120, "audio", "linear"],
      [120, "haptic", "easeOutCubic"],
      [420, "dialogue", "none"],
    ],
  );
  assert.equal(sealed.cues[0]?.value, 4);
  assert.equal(sealed.cues[1]?.value, 1.35);
  assert.equal(sealed.cues[2]?.value, 0.72);
  assert.equal(sealed.cues[3]?.value, 3);

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
// against `recognitionFeedbackAt`. This guards the delegate contract so a
// later refactor of the underlying sampler can't silently drop a cue.
// ---------------------------------------------------------------------------

function checkFeelEnvelope(): void {
  const rest = recognitionBeatProgress(0);
  assert.equal(rest.elapsedMs, 0);
  assert.equal(rest.cameraYawDegrees, 0);
  assert.equal(rest.screenShakePx >= 0, true);

  // Reduced motion collapses the camera + shortens the total.
  const reduced = recognitionBeatProgress(80, { reducedMotion: true });
  assert.equal(reduced.reducedMotion, true);
  assert.equal(reduced.cameraYawDegrees, 0);
  assert.equal(reduced.cameraDeltaMeters, 0);

  const reducedDone = recognitionBeatProgress(
    RECOGNITION_FEEDBACK_REDUCED_MOTION_MS,
    { reducedMotion: true },
  );
  assert.equal(reducedDone.elapsedMs, RECOGNITION_FEEDBACK_REDUCED_MOTION_MS);

  // Sting fires at stingStartMs with the authored gain.
  const sting = recognitionBeatProgress(RECOGNITION_FEEDBACK_STING_START_MS);
  assert.equal(sting.audioCue, "bell-glass-sting");
  assert.equal(sting.audioCueGainDb, RECOGNITION_FEEDBACK_STING_GAIN_DB);

  // Opened branch overlays the wooden click at stingStartMs + delay.
  const openedClick = recognitionBeatProgress(
    RECOGNITION_FEEDBACK_STING_START_MS + RECOGNITION_FEEDBACK_OPENED_CLICK_DELAY_MS,
    { outcome: "opened" },
  );
  assert.equal(openedClick.audioCue, "wooden-click");

  // Beat settles at totalMs.
  const done = recognitionBeatProgress(RECOGNITION_FEEDBACK_TOTAL_MS);
  assert.equal(done.phase, "settle");
  assert.equal(done.screenShakePx, 0);
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

runRecognitionBeatChecks();
console.log("recognition beat feel contract ok");
