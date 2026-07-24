export type AftersignPacketOutcome = "sealed" | "opened" | "withheld" | "returned";

export type AftersignInstructionOutcome = "listened" | "skipped";

export type AftersignReturnTone = "kind" | "evasive" | "blunt";

export const AFTERSIGN_IO_FIRST_BRIEFING_LINES = [
  "Night Post keeps the city stitched after dark.",
  "Blue packet. Sealed. Sign box across the stair.",
  "Read the lantern marks. Step where they agree.",
  "Bring me back the fact of what you did.",
] as const;

export const AFTERSIGN_IO_PACKET_MEMORY_LINES: Record<AftersignPacketOutcome, string> = {
  sealed: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
  opened: "You came back. The seal did not. I can use one of those facts.",
  withheld: "You kept the packet from the box. That is not nothing. It is not delivery either.",
  returned: "You brought the packet back instead of guessing. The city survives on fewer guesses than people think.",
};

export const AFTERSIGN_IO_INSTRUCTION_MEMORY_LINES: Record<AftersignInstructionOutcome, string> = {
  listened: "You listened before you ran. Rare habit. Keep it.",
  skipped: "You found the box anyway. Next time, let me finish saving your life.",
};

export const AFTERSIGN_IO_RETURN_TONE_LINES: Record<AftersignReturnTone, string> = {
  kind: "You came back careful. Vey can use careful.",
  evasive: "You came back with fog in your mouth. I can route around fog.",
  blunt: "You came back blunt. Good. Blunt things still point somewhere.",
};

export function getAftersignIoPacketMemoryLine(outcome: AftersignPacketOutcome): string {
  return AFTERSIGN_IO_PACKET_MEMORY_LINES[outcome];
}

export function getAftersignIoInstructionMemoryLine(outcome: AftersignInstructionOutcome): string {
  return AFTERSIGN_IO_INSTRUCTION_MEMORY_LINES[outcome];
}

export function getAftersignIoReturnToneLine(tone: AftersignReturnTone): string {
  return AFTERSIGN_IO_RETURN_TONE_LINES[tone];
}
