import {
  AFTERSIGN_IO_RETURNING_SESSION_LINES,
  findAftersignIoReturningSessionLine,
  type AftersignIoReturningSessionOutcome,
} from "./ioReturningSessionLines";

const expectedLines: readonly [AftersignIoReturningSessionOutcome, string][] = [
  ["sealed", "You came back. So did the blue seal, unbroken. That gives me two facts to trust."],
  ["opened", "You came back. The seal did not. I can use one of those facts."],
  ["skipped-route", "You found the box anyway. Next time, let me finish saving your life."],
  ["listened-route", "You listened before you ran. Rare habit. Keep it."],
];

describe("AFTERSIGN Io returning-session lines", () => {
  it("keeps each authored Io memory line tied to a concrete player outcome", () => {
    expect(AFTERSIGN_IO_RETURNING_SESSION_LINES).toHaveLength(expectedLines.length);

    for (const [outcome, text] of expectedLines) {
      const line = findAftersignIoReturningSessionLine(outcome);

      expect(line.speaker).toBe("io");
      expect(line.outcome).toBe(outcome);
      expect(line.text).toBe(text);
    }
  });
});
