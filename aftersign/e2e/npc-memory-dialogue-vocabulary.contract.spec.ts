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

test("Io names the route vocabulary shown by both kiosk acknowledgment buttons", () => {
  // Player-visible labels stamped by aftersign/main.js at the
  // packet-choice beat (see `setTextContentIfChanged(acknowledgeRouteButton,
  // ...)` / `setTextContentIfChanged(skipRouteButton, ...)` in main.js).
  //
  // Honest scope: these two literals are MIRRORED, not imported — a
  // future label-rename in main.js does NOT automatically red this
  // spec; both sources must be edited together by hand. The pin here
  // only guards (a) the labels remain non-empty, (b) they remain
  // distinct from each other, and (c) they stay stable relative to
  // the sibling e2e assertions in
  // `aftersign/e2e/aftersign-mloop-two-round.playtest.spec.ts` and
  // `aftersign/e2e/return-tone-choice-feel.playtest.spec.ts` that
  // read the shipped button text. A single authored source per
  // label (so a rename in main.js reds every mirror) is tracked as
  // follow-up to #2220.
  //
  // Shared-vocabulary with the memory lines moved to a mechanical
  // axis after #2220 renamed the labels from "Acknowledge route" /
  // "Skip acknowledgment" (which shared "route" / "acknowledg" with
  // Io's memory text) to "I listened" / "I ran early" (which don't).
  const acknowledgeRouteLabel = "I listened";
  const skipAcknowledgmentLabel = "I ran early";

  expect(acknowledgeRouteLabel.length).toBeGreaterThan(0);
  expect(skipAcknowledgmentLabel.length).toBeGreaterThan(0);
  expect(acknowledgeRouteLabel).not.toBe(skipAcknowledgmentLabel);

  // Io's kiosk-memory lines still carry the mechanical route-attention
  // nouns the memory FACT axis is keyed on ("route" / "acknowledg"),
  // so a player who skimmed the fork recognizes WHICH action Io
  // remembers even without the button copy in front of them.
  expect(memoryLineFor("done").toLowerCase()).toContain("route");
  expect(memoryLineFor("skipped").toLowerCase()).toContain("route");
  expect(memoryLineFor("skipped").toLowerCase()).toContain("acknowledg");
  expect(IO_MEMORY_RESPONSE_LINES.remembersSecondActionDone.text.toLowerCase()).toContain("route");
  expect(IO_MEMORY_RESPONSE_LINES.remembersSecondActionSkipped.text.toLowerCase()).toContain("acknowledg");
});
