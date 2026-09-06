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
  const routeAttentionCases = [
    { routeListened: true, routeObject: "done" },
    { routeListened: false, routeObject: "skipped" },
  ];

  it.each(cases)(
    "keeps the expected recognition line wired to the selected $outcome snippet after listening",
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

  it.each(cases.flatMap(({ outcome, packetSealed }) =>
    routeAttentionCases.map(({ routeListened, routeObject }) => ({
      outcome,
      packetSealed,
      routeListened,
      routeObject,
    })),
  ))(
    "keeps the expected $outcome recognition line wired when the route was $routeObject",
    ({ outcome, packetSealed, routeListened, routeObject }) => {
      const memory: IoRecognitionMemoryFact[] = [
        {
          id: `delivery:${outcome}`,
          kind: "delivery-outcome",
          object: outcome,
        },
        {
          id: `route:${routeObject}`,
          predicate: "kiosk-second-action",
          object: routeObject,
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
