import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_IO_LINES,
  buildIoMemorySentence,
  buildIoReturnMemoryThread,
  ioPacketReturnLine,
  ioReturnReasonLine,
  ioRouteAttentionLine,
  normalizeAftersignPacketOutcome,
} from "./ioVoiceContract";
import { ioReturningSessionLines } from "../../../../packages/aftersign/src/ioReturningSession";

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
    expect(ioRouteAttentionLine("heard").text).toBe(
      ioReturningSessionLines.listenedRoute,
    );
    expect(ioRouteAttentionLine("skipped").text).toBe(
      ioReturningSessionLines.skippedRoute,
    );
  });

  // #2408: the apps/web copy must not fork the vertical-slice-script canon.
  it("binds packet return lines to the script-pinned canon", () => {
    expect(ioPacketReturnLine("opened").text).toBe(
      "You made it back. The seal did not. I can use one of those facts.",
    );
    expect(ioPacketReturnLine("opened").text).toBe(ioReturningSessionLines.openedPacket);
    expect(ioPacketReturnLine("sealed").text).toBe(ioReturningSessionLines.sealedPacket);
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

  it("builds a deterministic three-line returning-player memory thread", () => {
    expect(
      buildIoReturnMemoryThread({
        routeAttention: "skipped",
        packetOutcome: "opened",
        returnReason: "blunt",
      }),
    ).toEqual([
      "Io remembers that the courier skipped the route instructions.",
      "Io remembers that the courier opened the blue packet.",
      "Io remembers that the courier answered bluntly when asked why they returned.",
    ]);
  });
});
