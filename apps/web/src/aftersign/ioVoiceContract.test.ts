import {
  AFTERSIGN_IO_LINES,
  buildIoMemorySentence,
  ioPacketReturnLine,
  ioReturnReasonLine,
  ioRouteAttentionLine,
  normalizeAftersignPacketOutcome,
} from "./ioVoiceContract";

describe("Aftersign Io voice contract", () => {
  it("selects the exact remembered packet line for the prior player action", () => {
    expect(ioPacketReturnLine("sealed")).toBe(AFTERSIGN_IO_LINES.sealedReturn);
    expect(ioPacketReturnLine("opened")).toBe(AFTERSIGN_IO_LINES.openedReturn);
    expect(ioPacketReturnLine(undefined)).toBe(AFTERSIGN_IO_LINES.sealedReturn);
  });

  it("normalizes unknown packet outcomes to the sealed baseline", () => {
    expect(normalizeAftersignPacketOutcome("opened")).toBe("opened");
    expect(normalizeAftersignPacketOutcome("sealed")).toBe("sealed");
    expect(normalizeAftersignPacketOutcome("lost")).toBe("sealed");
    expect(normalizeAftersignPacketOutcome(null)).toBe("sealed");
  });

  it("keeps Io's route memory concrete and short", () => {
    expect(ioRouteAttentionLine("heard").text).toBe("You listened before you ran. Rare habit. Keep it.");
    expect(ioRouteAttentionLine("skipped").text).toBe(
      "You found the box anyway. Next time, let me finish saving your life.",
    );
  });

  it("maps the return answer posture into authored memory lines", () => {
    expect(ioReturnReasonLine("kind")).toBe(AFTERSIGN_IO_LINES.kindReturn);
    expect(ioReturnReasonLine("evasive")).toBe(AFTERSIGN_IO_LINES.evasiveReturn);
    expect(ioReturnReasonLine("blunt")).toBe(AFTERSIGN_IO_LINES.bluntReturn);
  });

  it("exposes a memory sentence the save contract can persist or assert", () => {
    expect(buildIoMemorySentence(AFTERSIGN_IO_LINES.openedReturn)).toBe(
      "Io remembers that the courier opened the blue packet.",
    );
    expect(buildIoMemorySentence(AFTERSIGN_IO_LINES.firstGreeting)).toBe(
      `Io remembers: ${AFTERSIGN_IO_LINES.firstGreeting.text}`,
    );
  });
});
