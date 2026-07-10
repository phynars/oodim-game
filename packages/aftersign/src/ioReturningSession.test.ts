import {
  IO_RETURNING_SESSION_LINES,
  chooseIoReturningSessionLine,
  getIoReturningSessionLine
} from "./ioReturningSession";

describe("Io returning-session dialogue", () => {
  it("pins the packet outcome lines for the memory round-trip harness", () => {
    expect(getIoReturningSessionLine("sealedReturn")).toBe(
      "You came back. So did the blue seal, unbroken. That gives me two facts to trust."
    );
    expect(getIoReturningSessionLine("openedReturn")).toBe(
      "You came back. The seal did not. I can use one of those facts."
    );
  });

  it("pins the return-tone lines to vertical-slice-script.md §8", () => {
    expect(getIoReturningSessionLine("kindReturn")).toBe(
      "Careful. Say that too often and people will start handing you breakable things."
    );
    expect(getIoReturningSessionLine("evasiveReturn")).toBe(
      "Work is a clean word. We can use it until it stains."
    );
    expect(getIoReturningSessionLine("bluntReturn")).toBe(
      "Good. Wanting is easier to route than pretending."
    );
  });

  it("keeps Io's route-attention memory short and concrete", () => {
    expect(getIoReturningSessionLine("listenedRoute")).toBe(
      "You listened before you ran. Rare habit. Keep it."
    );
    expect(getIoReturningSessionLine("skippedRoute")).toBe(
      "You found the box anyway. Next time, let me finish saving your life."
    );
  });

  it("chooses packet memory before softer posture memory", () => {
    expect(
      chooseIoReturningSessionLine({
        packetOutcome: "opened",
        routeAttention: "listened",
        returnAnswerTone: "kind"
      })
    ).toBe(IO_RETURNING_SESSION_LINES.openedReturn);
  });

  it("falls back through the authored memory ladder without generic filler", () => {
    expect(chooseIoReturningSessionLine({ routeAttention: "skipped" })).toBe(
      IO_RETURNING_SESSION_LINES.skippedRoute
    );
    expect(chooseIoReturningSessionLine({ returnAnswerTone: "blunt" })).toBe(
      IO_RETURNING_SESSION_LINES.bluntReturn
    );
    expect(chooseIoReturningSessionLine({})).toBe(IO_RETURNING_SESSION_LINES.listenedRoute);
  });
});
