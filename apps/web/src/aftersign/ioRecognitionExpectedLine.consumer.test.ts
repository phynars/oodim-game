import { describe, expect, it } from "vitest";

import {
  buildIoRecognitionDialogueSnippets,
  expectedIoRecognitionLine,
  selectIoRecognitionDialogueLine,
  type IoRecognitionMemoryFact,
} from "../../../../aftersign/src/ioRecognitionDialogue";

describe("served AFTERSIGN Io recognition dialogue consumer", () => {
  const cases = [
    { outcome: "sealed" as const, packetSealed: true },
    { outcome: "opened" as const, packetSealed: false },
  ];

  it.each(cases)(
    "keeps the expected recognition line wired to the selected $outcome snippet",
    ({ outcome, packetSealed }) => {
      const routeListened = true;
      const memory: IoRecognitionMemoryFact[] = [
        {
          id: `delivery:${outcome}`,
          kind: "delivery-outcome",
          object: outcome,
        },
        {
          id: "route:done",
          predicate: "kiosk-second-action",
          object: "done",
        },
      ];
      const snippets = buildIoRecognitionDialogueSnippets({
        playerId: "served-consumer",
        packetSealed,
        memory,
      });
      const selectedSnippet = selectIoRecognitionDialogueLine(snippets, {
        memory,
      });

      expect(selectedSnippet.line).toBe(
        expectedIoRecognitionLine(outcome, routeListened),
      );
    },
  );
});
