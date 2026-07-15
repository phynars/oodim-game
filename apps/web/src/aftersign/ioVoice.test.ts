import assert from "node:assert/strict";

import {
  getIoRecognitionLine,
  getIoRecognitionLines,
  ioRecognitionLines,
} from "./ioVoice";

// Single-axis: packet only.
{
  const line = getIoRecognitionLine({ packetOutcome: "sealed" });
  assert.notEqual(line, null);
  assert.equal(line?.referencedFact, "packetOutcome");
  assert.equal(line?.referencedValue, "sealed");
  assert.equal(line?.id, "io-return-packet-sealed");
}

// Single-axis: route only.
{
  const line = getIoRecognitionLine({ routeAttention: "skipped" });
  assert.equal(line?.referencedFact, "routeAttention");
  assert.equal(line?.referencedValue, "skipped");
}

// Single-axis: tone only, and the revised copy is what shipped.
{
  const line = getIoRecognitionLine({ returnTone: "kind" });
  assert.equal(line?.referencedFact, "returnTone");
  assert.equal(line?.referencedValue, "kind");
  assert.equal(line?.text, "Kind answer. Expensive habit. Useful one.");
}

// Empty facts → no line.
{
  assert.equal(getIoRecognitionLine({}), null);
  assert.deepEqual(getIoRecognitionLines({}), []);
}

// Multi-axis gather: all three facts return three lines in packet → route → tone order.
{
  const lines = getIoRecognitionLines({
    packetOutcome: "opened",
    routeAttention: "listened",
    returnTone: "blunt",
  });
  assert.equal(lines.length, 3);
  assert.deepEqual(
    lines.map((l) => l.referencedFact),
    ["packetOutcome", "routeAttention", "returnTone"],
  );
  assert.equal(lines[0]?.referencedValue, "opened");
  assert.equal(lines[1]?.referencedValue, "listened");
  assert.equal(lines[2]?.referencedValue, "blunt");
}

// Partial multi-axis: packet + tone, skipping route.
{
  const lines = getIoRecognitionLines({
    packetOutcome: "sealed",
    returnTone: "evasive",
  });
  assert.equal(lines.length, 2);
  assert.equal(lines[0]?.referencedFact, "packetOutcome");
  assert.equal(lines[1]?.referencedFact, "returnTone");
  assert.equal(
    lines[1]?.text,
    "You dodged the why. Fine. I pay attention to where people stand after dodging.",
  );
}

// getIoRecognitionLine keeps its single-line contract (first axis wins).
{
  const line = getIoRecognitionLine({
    packetOutcome: "sealed",
    returnTone: "blunt",
  });
  assert.equal(line?.referencedFact, "packetOutcome");
}

// Registry surface is unchanged.
{
  assert.equal(ioRecognitionLines.packet.sealed.referencedValue, "sealed");
  assert.equal(ioRecognitionLines.route.listened.referencedValue, "listened");
  assert.equal(ioRecognitionLines.tone.blunt.referencedValue, "blunt");
}
