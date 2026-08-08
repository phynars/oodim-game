import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_IO_RETURN_DIALOGUE,
  composeAftersignIoReturningSessionDialogue,
  getAftersignIoReturnDialogueLine,
} from "./ioReturningSessionDialogue";
import {
  createAftersignVerticalSliceState,
  recordAftersignPacketChoice,
  recordAftersignReplyTone,
  recordAftersignRouteChoice,
} from "./verticalSliceRuntimeState";

describe("Aftersign Io returning-session dialogue", () => {
  it("keeps each returning memory line short enough to play in-scene", () => {
    expect(AFTERSIGN_IO_RETURN_DIALOGUE).toHaveLength(7);

    for (const line of AFTERSIGN_IO_RETURN_DIALOGUE) {
      expect(line.text.length).toBeLessThanOrEqual(96);
    }
  });

  it("recognizes a sealed packet, listened route, and kind answer", () => {
    const state = createAftersignVerticalSliceState();

    recordAftersignPacketChoice(state, "sealed");
    recordAftersignRouteChoice(state, "listened");
    recordAftersignReplyTone(state, "kind");

    expect(composeAftersignIoReturningSessionDialogue(state).map((line) => line.text)).toEqual([
      "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
      "You listened before you ran. Rare habit. Keep it.",
      "Kind answer. Expensive habit, after dark. Still: noted.",
    ]);
  });

  it("recognizes an opened packet, skipped route, and blunt answer", () => {
    const state = createAftersignVerticalSliceState();

    recordAftersignPacketChoice(state, "opened");
    recordAftersignRouteChoice(state, "skipped");
    recordAftersignReplyTone(state, "blunt");

    expect(composeAftersignIoReturningSessionDialogue(state).map((line) => line.text)).toEqual([
      "You came back. The seal did not. I can use one of those facts.",
      "You found the box anyway. Next time, let me finish saving your life.",
      "Blunt answer. Saves ink. Sometimes blood.",
    ]);
  });

  it("recognizes an evasive answer on its own", () => {
    const state = createAftersignVerticalSliceState();

    recordAftersignReplyTone(state, "evasive");

    expect(composeAftersignIoReturningSessionDialogue(state)).toEqual([
      getAftersignIoReturnDialogueLine("tone-evasive"),
    ]);
  });
});
