import {
  AFTERSIGN_IO_RETURNING_SESSION_LINES,
  getAftersignIoReturningSessionLine,
} from "./ioReturningSessionLines";

describe("AFTERSIGN Io returning-session lines", () => {
  it("keeps every authored line tied to a concrete remembered player action", () => {
    expect(AFTERSIGN_IO_RETURNING_SESSION_LINES).toEqual([
      {
        outcome: "sealed",
        rememberedAction: "delivered the blue packet with its seal unbroken",
        line: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
      },
      {
        outcome: "opened",
        rememberedAction: "opened the blue packet before returning",
        line: "You came back. The seal did not. I can use one of those facts.",
      },
      {
        outcome: "skippedRoute",
        rememberedAction: "left before Io finished the route instructions",
        line: "You found the box anyway. Next time, let me finish saving your life.",
      },
      {
        outcome: "listenedRoute",
        rememberedAction: "listened to Io's route instructions before leaving",
        line: "You listened before you ran. Rare habit. Keep it.",
      },
    ]);
  });

  it("selects the exact returning-session line for the stored outcome", () => {
    expect(getAftersignIoReturningSessionLine("sealed").line).toBe(
      "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
    );
    expect(getAftersignIoReturningSessionLine("opened").line).toBe(
      "You came back. The seal did not. I can use one of those facts.",
    );
  });
});
