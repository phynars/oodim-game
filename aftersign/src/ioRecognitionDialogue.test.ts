import { describe, expect, it } from "vitest";

import {
  buildIoRecognitionDialogueSnippets,
  expectedIoRecognitionLine,
  selectIoRecognitionDialogueLine,
} from "./ioRecognitionDialogue";

describe("Io recognition dialogue selection", () => {
  it("uses the live packet outcome over a stale delivery memory", () => {
    const snippets = buildIoRecognitionDialogueSnippets({
      playerId: "returning-player",
      packetSealed: false,
      memory: [{ id: "delivery-1", kind: "delivery-outcome", object: "sealed" }],
    });

    expect(selectIoRecognitionDialogueLine(snippets).line).toBe(
      expectedIoRecognitionLine("opened", false),
    );
  });

  it("selects deep recall only after the kiosk route is acknowledged", () => {
    const memory = [
      { id: "delivery-1", kind: "delivery-outcome", object: "sealed" },
      { id: "route-1", predicate: "kiosk-second-action", object: "done" },
    ];
    const snippets = buildIoRecognitionDialogueSnippets({
      playerId: "returning-player",
      packetSealed: true,
      memory,
    });

    expect(selectIoRecognitionDialogueLine(snippets, { memory }).line).toBe(
      expectedIoRecognitionLine("sealed", true),
    );
  });
});
