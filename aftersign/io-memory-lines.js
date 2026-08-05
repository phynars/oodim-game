const IO_RETURNING_LINES = Object.freeze({
  sealed: Object.freeze([
    "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
    "Blue seal intact. Courier intact. Vey is generous tonight.",
    "You kept what was not yours. Good. The city is mostly made of that test."
  ]),
  opened: Object.freeze([
    "You came back. The seal did not. I can use one of those facts.",
    "Broken wax tells the truth faster than people do.",
    "You opened it. I am not shocked. I am accounting."
  ]),
  skippedRoute: Object.freeze([
    "You found the box anyway. Next time, let me finish saving your life.",
    "Fast feet. Short ears. That ratio kills couriers."
  ]),
  heardRoute: Object.freeze([
    "You listened before you ran. Rare habit. Keep it.",
    "You heard the route. That is half the work and most of surviving."
  ]),
  returnedKind: Object.freeze([
    "Kindness, then. Expensive tool. Keep it dry.",
    "You came back soft-spoken. Vey has uses for that."
  ]),
  returnedEvasive: Object.freeze([
    "That was nearly an answer. I will file it as weather.",
    "Evasion is still a route. Usually the wet one."
  ]),
  returnedBlunt: Object.freeze([
    "Blunt travels well. Try not to cut the packet.",
    "Plain answer. Good. I get tired of decorative lies."
  ]),
  firstArrival: Object.freeze([
    "Night Post is open. If you are lost, stand where I can see you.",
    "No past on you. Fine. We mostly deliver to the future."
  ])
});

const IO_FALLBACK_LINE = "I remember enough. That will have to do.";

export function getIoMemoryLine(memory = {}) {
  if (memory.packetOutcome === "delivered_sealed" || memory.packetOutcome === "sealed") {
    return IO_RETURNING_LINES.sealed[0];
  }

  if (memory.packetOutcome === "opened") {
    return IO_RETURNING_LINES.opened[0];
  }

  if (memory.heardRoute === false) {
    return IO_RETURNING_LINES.skippedRoute[0];
  }

  if (memory.heardRoute === true) {
    return IO_RETURNING_LINES.heardRoute[0];
  }

  if (memory.returnTone === "kind") {
    return IO_RETURNING_LINES.returnedKind[0];
  }

  if (memory.returnTone === "evasive") {
    return IO_RETURNING_LINES.returnedEvasive[0];
  }

  if (memory.returnTone === "blunt") {
    return IO_RETURNING_LINES.returnedBlunt[0];
  }

  if (memory.isFirstArrival) {
    return IO_RETURNING_LINES.firstArrival[0];
  }

  return IO_FALLBACK_LINE;
}

export function getIoLineBank() {
  return IO_RETURNING_LINES;
}

if (typeof window !== "undefined") {
  window.__aftersignIoCopy = Object.freeze({
    getIoMemoryLine,
    getIoLineBank
  });
}
