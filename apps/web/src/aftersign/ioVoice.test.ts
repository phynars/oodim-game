import { describe, expect, it } from "vitest";
import {
  IO_PACKET_RETURN_LINES,
  IO_RETURN_TONE_LINES,
  IO_ROUTE_ATTENTION_LINES,
  IO_VOICE,
  getIoPacketReturnLine,
  getIoReturnToneLine,
  getIoRouteAttentionLine,
} from "./ioVoice";

describe("Io voice copy", () => {
  it("keeps the first-return packet memory lines concrete", () => {
    expect(getIoPacketReturnLine("sealed")).toBe(
      "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
    );
    expect(getIoPacketReturnLine("opened")).toBe(
      "You came back. The seal did not. I can use one of those facts.",
    );
    expect(getIoPacketReturnLine("unknown")).toBe(
      "You came back. I have one fact. Bring me another.",
    );
  });

  it("keeps route attention memory separate from packet outcome", () => {
    expect(getIoRouteAttentionLine("listened")).toBe(
      "You listened before you ran. Rare habit. Keep it.",
    );
    expect(getIoRouteAttentionLine("skipped")).toBe(
      "You found the box anyway. Next time, let me finish saving your life.",
    );
  });

  it("keeps the return-tone fork short enough for the served dialogue panel", () => {
    for (const line of Object.values(IO_RETURN_TONE_LINES)) {
      expect(line.length).toBeLessThanOrEqual(80);
    }

    expect(getIoReturnToneLine("kind")).toBe(
      "Kind answer. Dangerous tool. Keep it sharp.",
    );
    expect(getIoReturnToneLine("evasive")).toBe(
      "You walked around the truth. I noticed the shape of the room.",
    );
    expect(getIoReturnToneLine("blunt")).toBe(
      "Blunt is useful. So is knowing who bleeds when you swing it.",
    );
  });

  it("keeps Io's reusable slice lines lean", () => {
    expect(IO_VOICE.greeting).toBe(
      "Night Post is closed to excuses. Open to couriers.",
    );
    expect(IO_VOICE.packetOffer).toBe(
      "Blue seal. Silt Stair box. Do not improve the message on the way.",
    );
    expect(IO_VOICE.routeHint).toBe(
      "Lanterns mark the dry boards. Brass signs mark the honest ones. Follow both.",
    );
    expect(IO_VOICE.nextJob).toBe(
      "Moth Pier next. If the tide engine asks your name, give it mine first.",
    );
  });

  it("exports all authored line families", () => {
    expect(Object.keys(IO_PACKET_RETURN_LINES)).toEqual([
      "sealed",
      "opened",
      "unknown",
    ]);
    expect(Object.keys(IO_ROUTE_ATTENTION_LINES)).toEqual([
      "listened",
      "skipped",
    ]);
    expect(Object.keys(IO_RETURN_TONE_LINES)).toEqual([
      "kind",
      "evasive",
      "blunt",
    ]);
  });
});
