import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_NPC_MEMORY_RECALL_DIALOGUE,
  findAftersignNpcMemoryRecallLine,
} from "./npcMemoryRecallDialogue";

describe("Aftersign NPC memory recall dialogue", () => {
  it("keeps one assertable spoken line for each returning memory beat", () => {
    expect(AFTERSIGN_NPC_MEMORY_RECALL_DIALOGUE).toEqual([
      {
        id: "io-return-opened",
        npcId: "io",
        trigger: {
          scene: "io-return",
          remembers: "packet-opened",
        },
        line: "You opened it. I heard the seal give before the room did.",
        playerMemoryEcho: "Io remembers that you opened the packet.",
        assertionText: "You opened it.",
      },
      {
        id: "io-return-sealed",
        npcId: "io",
        trigger: {
          scene: "io-return",
          remembers: "packet-sealed",
        },
        line: "Still sealed. Good. Some doors only learn your name after you refuse them.",
        playerMemoryEcho: "Io remembers that you kept the packet sealed.",
        assertionText: "Still sealed.",
      },
      {
        id: "orra-return-answered-saint-orra",
        npcId: "orra",
        trigger: {
          scene: "orra-return",
          remembers: "answered-saint-orra",
        },
        line: "You answered when the saint asked. That kind of voice leaves a thread.",
        playerMemoryEcho: "Saint Orra remembers that you answered her.",
        assertionText: "You answered when the saint asked.",
      },
    ]);
  });

  it("finds a line by NPC and remembered player action", () => {
    expect(
      findAftersignNpcMemoryRecallLine({
        npcId: "io",
        remembers: "packet-opened",
      }),
    ).toMatchObject({
      id: "io-return-opened",
      assertionText: "You opened it.",
    });

    expect(
      findAftersignNpcMemoryRecallLine({
        npcId: "orra",
        remembers: "packet-sealed",
      }),
    ).toBeNull();
  });

  it("keeps every recall line short enough to render as dialogue", () => {
    for (const recallLine of AFTERSIGN_NPC_MEMORY_RECALL_DIALOGUE) {
      expect(recallLine.line.length).toBeLessThanOrEqual(86);
      expect(recallLine.assertionText.length).toBeGreaterThan(0);
      expect(recallLine.playerMemoryEcho).toContain("remembers");
    }
  });
});
