import { describe, expect, it } from "vitest";
import {
  buildIoFirstRouteMemorySentence,
  selectIoFirstRouteLines,
} from "./io-first-route-lines.ts";

describe("Io first route lines", () => {
  it("keeps Io's first handoff short, concrete, and route-bound", () => {
    expect(
      selectIoFirstRouteLines({
        packetState: "sealed",
        attention: "listened",
        answerTone: "kind",
      }),
    ).toEqual({
      handoff: "Blue packet. Wax faces out. If it comes back clean, so do you.",
      route:
        "Three lanterns down. Brass stair. Sign box with the moth scratch. Do not follow the bell if it rings twice.",
      warning: "Vey forgets careless feet first.",
      returnQuestion: "You came back. Tell me why.",
      packetAssessment: "Seal held. Good. A city can stand on one clean fact.",
      answerAssessment: "Kind answer. Dangerous tool. Keep it sharp.",
      authoredMemorySentence:
        "Io remembers that the courier kept the first blue seal intact and listened before leaving.",
    });
  });

  it("lets Io mark a skipped briefing without pretending the player listened", () => {
    const lines = selectIoFirstRouteLines({
      packetState: "opened",
      attention: "skipped",
      answerTone: "evasive",
    });

    expect(lines.route).toBe(
      "Walk, then. Learn from the city if you will not learn from me.",
    );
    expect(lines.packetAssessment).toBe(
      "Seal broke. So did the easy version of this job.",
    );
    expect(lines.answerAssessment).toBe(
      "You walked around the question. I still saw the path.",
    );
    expect(lines.authoredMemorySentence).toBe(
      "Io remembers that the courier broke the first blue seal and left before the route was finished.",
    );
  });

  it("builds auditable memory sentences from concrete player actions", () => {
    expect(
      buildIoFirstRouteMemorySentence({
        packetState: "sealed",
        attention: "skipped",
        answerTone: "blunt",
      }),
    ).toBe(
      "Io remembers that the courier kept the first blue seal intact and left before the route was finished.",
    );
  });
});
