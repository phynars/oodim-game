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
  assert.ok(line.text.length <= 72, `${line.id} stays playable in a compact dialogue surface`);
  assert.doesNotMatch(line.text, /memory system|persistent|durable|server/i, `${line.id} avoids system exposition`);
}

assert.equal(
  getIoFirstSessionText("arrival"),
  "You made it above the water. That is not the same as safe.",
);
assert.equal(getIoFirstSessionLine("returnSealed").referencedPlayerAction, "kept-seal");
assert.equal(getIoFirstSessionLine("returnOpened").referencedPlayerAction, "broke-seal");

assert.throws(
  () => getIoFirstSessionText("missing" as IoFirstSessionBeatId),
  /Unknown Io first-session beat: missing/,
);
