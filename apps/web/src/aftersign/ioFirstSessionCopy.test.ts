import assert from "node:assert/strict";

import {
  getIoFirstSessionLine,
  getIoFirstSessionText,
  ioFirstSessionCopy,
  type IoFirstSessionBeatId,
} from "./ioFirstSessionCopy";

const expectedIds: readonly IoFirstSessionBeatId[] = [
  "arrival",
  "packetOffer",
  "routeInstruction",
  "sealedWarning",
  "openedWarning",
  "returnSealed",
  "returnOpened",
];

assert.deepEqual(
  ioFirstSessionCopy.map((line) => line.id),
  expectedIds,
);

for (const line of ioFirstSessionCopy) {
  assert.ok(line.text.length > 0, `${line.id} has copy`);
  // Io's authored lines run up to ~85 chars (see the route instruction in
  // docs/flagship/vertical-slice-script.md). The cap catches essays, not
  // scripture — keep it generous enough for the authored copy.
  assert.ok(line.text.length <= 120, `${line.id} stays playable in a compact dialogue surface`);
  assert.doesNotMatch(
    line.text,
    /memory system|persistent|durable|server/i,
    `${line.id} avoids system exposition`,
  );
}

// Arrival is script-locked; the harness reads this exact string.
assert.equal(
  getIoFirstSessionText("arrival"),
  "You made it above the water. Good. That is the first qualification.",
);

// The returning-session lines are the primary recognition proof. The
// story-state contract asserts these fragments; keep them stable.
assert.match(getIoFirstSessionText("returnSealed"), /The bell rang\. Good\./);
assert.match(getIoFirstSessionText("returnOpened"), /^No bell\./);

// referencedPlayerAction uses the same tokens as
// docs/flagship/story-state-contract.md (delivery.outcome: 'sealed' | 'opened').
assert.equal(getIoFirstSessionLine("returnSealed").referencedPlayerAction, "sealed");
assert.equal(getIoFirstSessionLine("returnOpened").referencedPlayerAction, "opened");
assert.equal(getIoFirstSessionLine("sealedWarning").referencedPlayerAction, "sealed");
assert.equal(getIoFirstSessionLine("openedWarning").referencedPlayerAction, "opened");

assert.throws(
  () => getIoFirstSessionText("missing" as IoFirstSessionBeatId),
  /Unknown Io first-session beat: missing/,
);
