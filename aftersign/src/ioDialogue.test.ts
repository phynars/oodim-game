import assert from "node:assert/strict";

import { getIoPrimaryRecognitionLine, getIoRecognitionLines } from "./ioDialogue";

assert.deepEqual(getIoRecognitionLines({ packetOutcome: "sealed" }), [
  {
    id: "io-return-packet-sealed",
    text: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
  },
]);

assert.deepEqual(getIoRecognitionLines({ packetOutcome: "opened" }), [
  {
    id: "io-return-packet-opened",
    text: "You came back. The seal did not. I can use one of those facts.",
  },
]);

assert.deepEqual(
  getIoRecognitionLines({
    packetOutcome: "sealed",
    routeAttention: "skipped",
    returnTone: "blunt",
  }),
  [
    {
      id: "io-return-packet-sealed",
      text: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
    },
    {
      id: "io-return-route-skipped",
      text: "You found the box anyway. Next time, let me finish saving your life.",
    },
    {
      id: "io-return-tone-blunt",
      text: "Blunt answer. Saves ink. Sometimes blood.",
    },
  ],
);

assert.equal(
  getIoPrimaryRecognitionLine({ packetOutcome: "opened", routeAttention: "listened" }).text,
  "You came back. The seal did not. I can use one of those facts.",
);
