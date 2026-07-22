export type IoPacketOutcome = "sealed" | "opened" | "withheld" | "returned";

export interface IoReturnMemory {
  packetOutcome: IoPacketOutcome;
  listenedToRoute: boolean;
}

export function getIoReturnLine(memory: IoReturnMemory): string {
  if (memory.packetOutcome === "sealed") {
    return "You came back. So did the blue seal, unbroken. That gives me two facts to trust.";
  }

  if (memory.packetOutcome === "opened") {
    return "You came back. The seal did not. I can use one of those facts.";
  }

  if (!memory.listenedToRoute) {
    return "You found the box anyway. Next time, let me finish saving your life.";
  }

  return "You listened before you ran. Rare habit. Keep it.";
}
