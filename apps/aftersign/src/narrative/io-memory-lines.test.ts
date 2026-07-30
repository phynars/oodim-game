import { describe, expect, it } from "vitest";

import {
  selectAnswerLine,
  selectIoReturningLines,
  selectPacketLine,
  selectRouteLine,
} from "./io-memory-lines";

describe("Io memory lines", () => {
  it("anchors the sealed-packet return to the exact prior action", () => {
    expect(
      selectIoReturningLines({
        packetOutcome: "sealed",
        listenedToRoute: true,
        returnedAfterClose: true,
        authoredMemorySentence:
          "Io remembers that the courier delivered the first blue packet unopened.",
      }),
    ).toEqual({
      greeting: "You came back. Good. The city dislikes wasted keys.",
      packetLine:
        "The blue seal made the trip unbroken. That gives me one clean fact.",
      routeLine: "You listened before you ran. Rare habit. Keep it.",
      memorySentence:
        "Io remembers that the courier delivered the first blue packet unopened.",
    });
  });

  it("anchors the opened-packet return without granting trust", () => {
    expect(
      selectIoReturningLines({
        packetOutcome: "opened",
        listenedToRoute: false,
        returnedAfterClose: true,
        answerTone: "evasive",
        authoredMemorySentence:
          "Io remembers that the courier broke the first blue seal.",
      }),
    ).toEqual({
      greeting: "You came back. Good. The city dislikes wasted keys.",
      packetLine:
        "The packet came back lighter than it left. I can use that fact too.",
      routeLine:
        "You found the box anyway. Next time, let me finish saving your life.",
      answerLine:
        "You stepped around the question. I noticed the shape of the step.",
      memorySentence: "Io remembers that the courier broke the first blue seal.",
    });
  });

  it.each([
    ["withheld", "You kept the packet out of the box. That is not nothing. It is just not delivery."],
    ["returned", "You brought the packet back instead of inventing an ending. Rare mercy."],
    [undefined, "No packet fact yet. We will earn one before dawn."],
  ] as const)("writes a concrete packet line for %s", (outcome, line) => {
    expect(selectPacketLine(outcome)).toBe(line);
  });

  it.each([
    [true, "You listened before you ran. Rare habit. Keep it."],
    [false, "You found the box anyway. Next time, let me finish saving your life."],
    [undefined, undefined],
  ] as const)("writes the route line for %s", (listenedToRoute, line) => {
    expect(selectRouteLine(listenedToRoute)).toBe(line);
  });

  it.each([
    ["kind", "Kind answers are still entries in the ledger. I marked yours."],
    ["evasive", "You stepped around the question. I noticed the shape of the step."],
    ["blunt", "Blunt, then. Saves ink when it does not spill blood."],
    [undefined, undefined],
  ] as const)("writes the answer-tone line for %s", (tone, line) => {
    expect(selectAnswerLine(tone)).toBe(line);
  });
});
