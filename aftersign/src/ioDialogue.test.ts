import {
  getIoPacketReturnLine,
  getIoReturningDialogue,
  getIoReturnReasonLine,
  getIoRouteReturnLine,
  IO_RETURNING_LINES,
  type IoDialogueLine,
} from "./ioDialogue";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertLine(line: IoDialogueLine | null, expectedId: string): void {
  assert(line !== null, `Expected ${expectedId}, got null`);
  assert(line.id === expectedId, `Expected ${expectedId}, got ${line.id}`);
}

export function runIoDialogueChecks(): void {
  assertLine(
    getIoPacketReturnLine({ returnedAfterClose: true, packetOutcome: "sealed" }),
    IO_RETURNING_LINES.sealedPacket.id,
  );

  assertLine(
    getIoPacketReturnLine({ returnedAfterClose: true, packetOutcome: "opened" }),
    IO_RETURNING_LINES.openedPacket.id,
  );

  assertLine(
    getIoPacketReturnLine({ returnedAfterClose: true, packetOutcome: "withheld" }),
    IO_RETURNING_LINES.withheldPacket.id,
  );

  assertLine(
    getIoPacketReturnLine({ returnedAfterClose: true, packetOutcome: "returned" }),
    IO_RETURNING_LINES.returnedPacket.id,
  );

  assertLine(
    getIoRouteReturnLine({ routeAttention: "listened" }),
    IO_RETURNING_LINES.listenedRoute.id,
  );

  assertLine(
    getIoRouteReturnLine({ routeAttention: "skipped" }),
    IO_RETURNING_LINES.skippedRoute.id,
  );

  assertLine(
    getIoReturnReasonLine({ returnReasonTone: "kind" }),
    IO_RETURNING_LINES.kindReturn.id,
  );

  assertLine(
    getIoReturnReasonLine({ returnReasonTone: "evasive" }),
    IO_RETURNING_LINES.evasiveReturn.id,
  );

  assertLine(
    getIoReturnReasonLine({ returnReasonTone: "blunt" }),
    IO_RETURNING_LINES.bluntReturn.id,
  );

  const fullReturn = getIoReturningDialogue({
    packetOutcome: "opened",
    routeAttention: "skipped",
    returnedAfterClose: true,
    returnReasonTone: "blunt",
  });

  assert(
    fullReturn.map((line) => line.id).join("|") ===
      [
        IO_RETURNING_LINES.openedPacket.id,
        IO_RETURNING_LINES.skippedRoute.id,
        IO_RETURNING_LINES.bluntReturn.id,
      ].join("|"),
    "Expected returning dialogue to preserve packet, route, reason order",
  );

  for (const line of fullReturn) {
    assert(line.text.length > 0, `${line.id} has empty text`);
    assert(line.remembers.length > 0, `${line.id} does not declare remembered fields`);
  }
}

runIoDialogueChecks();
