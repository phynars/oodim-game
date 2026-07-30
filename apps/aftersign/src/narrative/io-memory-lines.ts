export type PacketOutcome = "sealed" | "opened" | "withheld" | "returned";

export type IoTrustPosture = "unproven" | "trusted" | "watching";

export type IoReturnAnswerTone = "kind" | "evasive" | "blunt";

export interface IoMemoryRecord {
  readonly packetOutcome?: PacketOutcome;
  readonly listenedToRoute?: boolean;
  readonly returnedAfterClose?: boolean;
  readonly answerTone?: IoReturnAnswerTone;
  readonly authoredMemorySentence?: string;
  readonly trustPosture?: IoTrustPosture;
}

export interface IoReturningLines {
  readonly greeting: string;
  readonly packetLine: string;
  readonly routeLine?: string;
  readonly answerLine?: string;
  readonly memorySentence: string;
}

const DEFAULT_MEMORY_SENTENCE =
  "Io remembers whether the courier kept the first blue seal intact.";

export function selectIoReturningLines(memory: IoMemoryRecord): IoReturningLines {
  const returned = memory.returnedAfterClose === true;
  const greeting = returned
    ? "You came back. Good. The city dislikes wasted keys."
    : "You are still here. Good. The city dislikes wasted keys.";

  const packetLine = selectPacketLine(memory.packetOutcome);
  const routeLine = selectRouteLine(memory.listenedToRoute);
  const answerLine = selectAnswerLine(memory.answerTone);

  return {
    greeting,
    packetLine,
    ...(routeLine ? { routeLine } : {}),
    ...(answerLine ? { answerLine } : {}),
    memorySentence: memory.authoredMemorySentence ?? DEFAULT_MEMORY_SENTENCE,
  };
}

export function selectPacketLine(outcome: PacketOutcome | undefined): string {
  switch (outcome) {
    case "sealed":
      return "The blue seal made the trip unbroken. That gives me one clean fact.";
    case "opened":
      return "The packet came back lighter than it left. I can use that fact too.";
    case "withheld":
      return "You kept the packet out of the box. That is not nothing. It is just not delivery.";
    case "returned":
      return "You brought the packet back instead of inventing an ending. Rare mercy.";
    default:
      return "No packet fact yet. We will earn one before dawn.";
  }
}

export function selectRouteLine(listenedToRoute: boolean | undefined): string | undefined {
  if (listenedToRoute === true) {
    return "You listened before you ran. Rare habit. Keep it.";
  }

  if (listenedToRoute === false) {
    return "You found the box anyway. Next time, let me finish saving your life.";
  }

  return undefined;
}

export function selectAnswerLine(tone: IoReturnAnswerTone | undefined): string | undefined {
  switch (tone) {
    case "kind":
      return "Kind answers are still entries in the ledger. I marked yours.";
    case "evasive":
      return "You stepped around the question. I noticed the shape of the step.";
    case "blunt":
      return "Blunt, then. Saves ink when it does not spill blood.";
    default:
      return undefined;
  }
}
