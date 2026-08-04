import { strict as assert } from "node:assert";

import {
  getIoMemoryLine,
  getIoRouteLine,
  listIoMemoryLines,
  type IoMemoryLine,
} from "./ioMemoryLines";

function assertReferences(line: IoMemoryLine, key: string, value: string): void {
  assert.deepEqual(line.references, [{ key, value }]);
}

function run(): void {
  const sealed = getIoMemoryLine({ packetOutcome: "sealed" });
  assert.equal(sealed.id, "io.return.packet.sealed");
  assert.equal(
    sealed.text,
    "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
  );
  assertReferences(sealed, "packetOutcome", "sealed");

  const opened = getIoMemoryLine({ packetOutcome: "opened" });
  assert.equal(opened.id, "io.return.packet.opened");
  assert.equal(opened.text, "You came back. The seal did not. I can use one of those facts.");
  assertReferences(opened, "packetOutcome", "opened");

  const unknownPacket = getIoMemoryLine({ packetOutcome: null });
  assert.equal(unknownPacket.id, "io.return.packet.unknown");
  assertReferences(unknownPacket, "packetOutcome", "unknown");

  const listened = getIoRouteLine({ heardRoute: true });
  assert.equal(listened.id, "io.route.listened");
  assert.equal(listened.text, "You listened before you ran. Rare habit. Keep it.");
  assertReferences(listened, "heardRoute", "listened");

  const skipped = getIoRouteLine({ heardRoute: false });
  assert.equal(skipped.id, "io.route.skipped");
  assert.equal(skipped.text, "You found the box anyway. Next time, let me finish saving your life.");
  assertReferences(skipped, "heardRoute", "skipped");

  const unknownRoute = getIoRouteLine();
  assert.equal(unknownRoute.id, "io.route.unknown");
  assertReferences(unknownRoute, "heardRoute", "unknown");

  assert.equal(listIoMemoryLines().length, 6);
}

run();
