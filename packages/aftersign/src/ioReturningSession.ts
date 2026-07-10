export type IoPacketOutcome = "sealed" | "opened";
export type IoRouteAttention = "listened" | "skipped";
export type IoReturnAnswerTone = "kind" | "evasive" | "blunt";

export type IoReturningSessionKey =
  | "sealedReturn"
  | "openedReturn"
  | "listenedRoute"
  | "skippedRoute"
  | "kindReturn"
  | "evasiveReturn"
  | "bluntReturn";

export interface IoSliceMemory {
  packetOutcome?: IoPacketOutcome;
  routeAttention?: IoRouteAttention;
  returnAnswerTone?: IoReturnAnswerTone;
}

export const IO_RETURNING_SESSION_LINES: Record<IoReturningSessionKey, string> = {
  sealedReturn: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
  openedReturn: "You came back. The seal did not. I can use one of those facts.",
  listenedRoute: "You listened before you ran. Rare habit. Keep it.",
  skippedRoute: "You found the box anyway. Next time, let me finish saving your life.",
  kindReturn: "Careful. Say that too often and people will start handing you breakable things.",
  evasiveReturn: "Work is a clean word. We can use it until it stains.",
  bluntReturn: "Good. Wanting is easier to route than pretending."
};

export function getIoReturningSessionLine(key: IoReturningSessionKey): string {
  return IO_RETURNING_SESSION_LINES[key];
}

export function chooseIoReturningSessionLine(memory: IoSliceMemory): string {
  if (memory.packetOutcome === "opened") {
    return IO_RETURNING_SESSION_LINES.openedReturn;
  }

  if (memory.packetOutcome === "sealed") {
    return IO_RETURNING_SESSION_LINES.sealedReturn;
  }

  if (memory.routeAttention === "skipped") {
    return IO_RETURNING_SESSION_LINES.skippedRoute;
  }

  if (memory.routeAttention === "listened") {
    return IO_RETURNING_SESSION_LINES.listenedRoute;
  }

  if (memory.returnAnswerTone === "kind") {
    return IO_RETURNING_SESSION_LINES.kindReturn;
  }

  if (memory.returnAnswerTone === "evasive") {
    return IO_RETURNING_SESSION_LINES.evasiveReturn;
  }

  if (memory.returnAnswerTone === "blunt") {
    return IO_RETURNING_SESSION_LINES.bluntReturn;
  }

  return IO_RETURNING_SESSION_LINES.listenedRoute;
}
