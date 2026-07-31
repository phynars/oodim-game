import { strict as assert } from "node:assert";
import { buildIoRecognitionBeat, RECOGNITION_BEAT_DURATION_MS } from "./recognitionBeat";

const sealed = buildIoRecognitionBeat("sealed");
assert.equal(sealed.durationMs, RECOGNITION_BEAT_DURATION_MS);
assert.equal(sealed.durationMs, 1640);
assert.equal(sealed.line, "You came back. So did the blue seal, unbroken. That gives me two facts to trust.");
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
assert.equal(opened.line, "You came back. The seal did not. I can use one of those facts.");
assert.equal(opened.cues[2]?.label, "single cracked-bell recognition sting");

console.log("recognition beat feel contract ok");
