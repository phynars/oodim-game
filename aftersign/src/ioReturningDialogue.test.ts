import {
  IO_RETURNING_LINES,
  getIoReturningLineText,
  selectIoReturningLine,
  type IoMemoryRecord,
} from "./ioReturningDialogue";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertLine(memory: IoMemoryRecord, expectedId: string, expectedText: string): void {
  const line = selectIoReturningLine(memory);
  assert(line.id === expectedId, `expected ${expectedId}, got ${line.id}`);
  assert(line.text === expectedText, `unexpected text for ${expectedId}: ${line.text}`);
  assert(getIoReturningLineText(memory) === expectedText, `text helper drifted for ${expectedId}`);
}

assertLine(
  { returnedAfterClose: true, packetOutcome: "sealed" },
  "io.return.sealed",
  "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
);

assertLine(
  { returnedAfterClose: true, packetOutcome: "opened" },
  "io.return.opened",
  "You came back. The seal did not. I can use one of those facts.",
);

assertLine(
  { returnedAfterClose: true, packetOutcome: "withheld" },
  "io.return.withheld",
  "You came back with the packet still in your pocket. That is not nothing. It is not delivery.",
);

assertLine(
  { returnedAfterClose: true, packetOutcome: "returned" },
  "io.return.returned",
  "You brought the work back instead of losing it. Bad news, neatly labeled, still counts.",
);

assertLine(
  { routeAttention: "skipped" },
  "io.return.route.skipped",
  "You found the box anyway. Next time, let me finish saving your life.",
);

assertLine(
  { routeAttention: "listened" },
  "io.return.route.listened",
  "You listened before you ran. Rare habit. Keep it.",
);

assertLine(
  { returnReason: "kind" },
  "io.return.reason.kind",
  "You said you came back because someone might be waiting. Dangerous answer. Useful one.",
);

assertLine(
  { returnReason: "evasive" },
  "io.return.reason.evasive",
  "You dodged the question last time. Fine. Couriers live longer with one pocket closed.",
);

assertLine(
  { returnReason: "blunt" },
  "io.return.reason.blunt",
  "You said you came back for the work. Clean answer. I prefer those when I can get them.",
);

assertLine(
  { returnedAfterClose: true },
  "io.return.fallback",
  "Back after dark. Good. Vey wastes daylight. We do not.",
);

for (const [key, line] of Object.entries(IO_RETURNING_LINES)) {
  assert(line.text.length > 0, `${key} has empty text`);
  assert(line.references.length > 0, `${key} needs auditable references`);
}
