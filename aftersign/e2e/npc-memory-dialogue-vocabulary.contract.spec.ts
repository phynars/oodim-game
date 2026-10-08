import { expect, test } from "@playwright/test";
import {
  ioMemoryResponseLinesFor,
  IO_MEMORY_RESPONSE_LINES,
} from "../src/npcMemoryDialogue.js";
import {
  NPC_MEMORY_FACT_ID,
  PLAYER_MEMORY_FLAG,
} from "../src/npcMemoryFlagSchema.js";

const introFlags = { [PLAYER_MEMORY_FLAG.IO_INTRO_SEEN]: true };

const memoryLineFor = (object: "done" | "skipped") =>
  ioMemoryResponseLinesFor({
    playerFlags: introFlags,
    npcMemoryFacts: [{
      kind: "route-attention",
      predicate: "kiosk-second-action",
      object,
      id: object === "done"
        ? NPC_MEMORY_FACT_ID.IO_KIOSK_SECOND_ACTION_DONE
        : NPC_MEMORY_FACT_ID.IO_KIOSK_SECOND_ACTION_SKIPPED,
    }],
  })[0]?.text ?? "";

test("Io's kiosk-memory lines name the player's route choice", () => {
  expect(memoryLineFor("done").toLowerCase()).toContain("route");
  expect(memoryLineFor("skipped").toLowerCase()).toContain("route");
  expect(memoryLineFor("skipped").toLowerCase()).toContain("acknowledg");
  expect(IO_MEMORY_RESPONSE_LINES.remembersSecondActionDone.text.toLowerCase()).toContain("route");
  expect(IO_MEMORY_RESPONSE_LINES.remembersSecondActionSkipped.text.toLowerCase()).toContain("acknowledg");
});
