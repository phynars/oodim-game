import assert from "node:assert/strict";
import {
  canAdvanceIoFirstSessionCue,
  getIoFirstSessionCue,
} from "./ioFirstSessionPacing";

const packetOfferCue = getIoFirstSessionCue(
  "packetOffer",
  "Blue packet. Sign box with three moths painted on it.",
);

assert.deepEqual(packetOfferCue, {
  beat: "packetOffer",
  text: "Blue packet. Sign box with three moths painted on it.",
  minHoldMs: 1768,
  inputLockMs: 160,
});

assert.equal(
  canAdvanceIoFirstSessionCue(packetOfferCue, packetOfferCue.minHoldMs - 1),
  false,
  "Io's packet offer cannot be skipped on the frame before its readable hold ends",
);

assert.equal(
  canAdvanceIoFirstSessionCue(packetOfferCue, packetOfferCue.minHoldMs),
  true,
  "Io's packet offer advances on the first frame at or after its readable hold",
);

const tinyCue = getIoFirstSessionCue("openedWarning", "Knife.");
assert.equal(tinyCue.minHoldMs, 900, "short Io barks still get a readable minimum hold");
assert.equal(
  canAdvanceIoFirstSessionCue(tinyCue, tinyCue.inputLockMs),
  false,
  "the 160ms input lock alone never skips a short bark before the readable hold",
);

const longCue = getIoFirstSessionCue(
  "routeInstruction",
  "Left stair, red string, brass bell. If the stair argues with you, trust the bell. Then move before the tide notices.",
);
assert.equal(longCue.minHoldMs, 2600, "long Io lines cap their hold so dialogue stays playable");

assert.throws(
  () => getIoFirstSessionCue("arrival", "   "),
  /Io first-session beat arrival needs playable copy before pacing/,
);
