export const IO_RETURNING_SESSION_LINES = Object.freeze({
  sealedPacket:
    "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
  openedPacket: "You came back. The seal did not. I can use one of those facts.",
  listenedRoute: "You listened before you ran. Rare habit. Keep it.",
  skippedRoute: "You found the box anyway. Next time, let me finish saving your life.",
  kindReturn: "Kind answer. Dangerous tool. Keep it sharp.",
  evasiveReturn: "You walked around the question. I noticed the shape of the path.",
  bluntReturn: "Blunt, then. Fine. A dull knife still opens rope.",
  fallback: "Back again. Good. Vey is less cruel to repeat witnesses.",
});

export function getIoReturningSessionLine(key) {
  return IO_RETURNING_SESSION_LINES[key] || IO_RETURNING_SESSION_LINES.fallback;
}

export function chooseIoReturningSessionLine(memory = {}) {
  if (memory.packetOutcome === "delivered" || memory.packetOutcome === "sealed") {
    return IO_RETURNING_SESSION_LINES.sealedPacket;
  }

  if (memory.packetOutcome === "opened") {
    return IO_RETURNING_SESSION_LINES.openedPacket;
  }

  if (memory.listenedToRoute === true) {
    return IO_RETURNING_SESSION_LINES.listenedRoute;
  }

  if (memory.listenedToRoute === false) {
    return IO_RETURNING_SESSION_LINES.skippedRoute;
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

  return IO_RETURNING_SESSION_LINES.fallback;
}
