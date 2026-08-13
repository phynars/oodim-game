import { describe, expect, it } from "vitest";

import {
  buildIoRecognitionDialogueSnippets,
  expectedIoRecognitionLine,
  selectIoRecognitionDialogueLine,
  type IoRecognitionMemoryFact,
} from "../../../../aftersign/src/ioRecognitionDialogue";

type PacketOutcome = "opened" | "sealed";

const CASES: Array<{
  packetOutcome: PacketOutcome;
  routeListened: boolean;
}> = [
  { packetOutcome: "opened", routeListened: true },
  { packetOutcome: "opened", routeListened: false },
  { packetOutcome: "sealed", routeListened: true },
  { packetOutcome: "sealed", routeListened: false },
];

function memoryFor(
  packetOutcome: PacketOutcome,
  routeListened: boolean,
): IoRecognitionMemoryFact[] {
  return [
    {
      id: `delivery:${packetOutcome}`,
      kind: "delivery-outcome",
      object: packetOutcome,
    },
    {
      id: `route:${routeListened ? "done" : "skipped"}`,
      predicate: "kiosk-second-action",
      object: routeListened ? "done" : "skipped",
    },
  ];
}

describe("io recognition expected line consumer", () => {
  it.each(CASES)(
    "keeps the expected recognition line wired to the served dialogue selector for %s",
    ({ packetOutcome, routeListened }) => {
      const memory = memoryFor(packetOutcome, routeListened);
      const selectedSnippet = selectIoRecognitionDialogueLine(
        buildIoRecognitionDialogueSnippets({
          playerId: "vitest-player",
          packetSealed: packetOutcome === "sealed",
          memory,
        }),
        { memory },
      );

      expect(expectedIoRecognitionLine(packetOutcome, routeListened)).toBe(
        selectedSnippet.line,
      );
    },
  );
});
