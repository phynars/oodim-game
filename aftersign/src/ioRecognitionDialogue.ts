export type IoRecognitionDialogueTier = "first-meeting" | "returning" | "deep-recall";

export type IoRecognitionMemoryFact = {
  id?: string;
  kind?: string;
  predicate?: string;
  object?: string;
};

export type IoRecognitionSnippetFeelCue = {
  durationMs: number;
  holdFrames: number;
  cameraDollyCm: number;
  cameraYawDegrees: number;
  vignetteAlpha: number;
  bloomAlpha: number;
  lineRevealDelayMs: number;
  lineRevealDurationMs: number;
  easing: "cubic-bezier(.2,.8,.2,1)";
};

export type IoRecognitionDialogueSnippet = {
  id: string;
  playerId: string;
  npcId: "io";
  tier: IoRecognitionDialogueTier;
  line: string;
  feelCue: IoRecognitionSnippetFeelCue;
  memoryRefs: string[];
  sourceMemoryIds: string[];
};

export type IoRecognitionDialogueInput = {
  playerId: string;
  packetSealed?: boolean;
  memory?: readonly IoRecognitionMemoryFact[];
};

const FIRST_MEETING_LINE =
  "I don't know your pattern yet. Stand where the rain can see you.";

const RETURNING_LINES = {
  sealed:
    "I remember you: blue seal, unbroken. The kiosk kept the route; I kept your name beside it.",
  opened:
    "I remember you: blue route delivered. The seal did not survive. The kiosk kept the route; I kept the risk beside your name.",
} as const;

const DEEP_RECALL_LINES = {
  sealedListened:
    "I remember you twice: blue seal unbroken, and you waited for my whole route before the rain bit down.",
  sealedSkipped:
    "I remember you twice: blue seal unbroken, and your feet were already moving before I finished.",
  openedListened:
    "I remember you twice: broken seal, clean listening. Not trust yet. A beginning.",
  openedSkipped:
    "I remember you twice: broken seal, half a route, and still you found the handoff.",
} as const;

const FIRST_MEETING_FEEL_CUE: IoRecognitionSnippetFeelCue = {
  durationMs: 480,
  holdFrames: 4,
  cameraDollyCm: 6,
  cameraYawDegrees: 1.2,
  vignetteAlpha: 0.06,
  bloomAlpha: 0.04,
  lineRevealDelayMs: 80,
  lineRevealDurationMs: 260,
  easing: "cubic-bezier(.2,.8,.2,1)",
};

const RETURNING_FEEL_CUE: IoRecognitionSnippetFeelCue = {
  durationMs: 820,
  holdFrames: 8,
  cameraDollyCm: 14,
  cameraYawDegrees: 3.2,
  vignetteAlpha: 0.14,
  bloomAlpha: 0.12,
  lineRevealDelayMs: 140,
  lineRevealDurationMs: 420,
  easing: "cubic-bezier(.2,.8,.2,1)",
};

const DEEP_RECALL_FEEL_CUE: IoRecognitionSnippetFeelCue = {
  durationMs: 1040,
  holdFrames: 12,
  cameraDollyCm: 18,
  cameraYawDegrees: 4.5,
  vignetteAlpha: 0.18,
  bloomAlpha: 0.16,
  lineRevealDelayMs: 180,
  lineRevealDurationMs: 540,
  easing: "cubic-bezier(.2,.8,.2,1)",
};

function factId(fact: IoRecognitionMemoryFact | undefined): string | null {
  return typeof fact?.id === "string" && fact.id.length > 0 ? fact.id : null;
}

function findDeliveryOutcome(memory: readonly IoRecognitionMemoryFact[]): IoRecognitionMemoryFact | undefined {
  return memory.find((fact) => fact.kind === "delivery-outcome");
}

function findRouteAttention(memory: readonly IoRecognitionMemoryFact[]): IoRecognitionMemoryFact | undefined {
  return memory.find((fact) => fact.predicate === "kiosk-second-action");
}

function rememberedOutcome(input: IoRecognitionDialogueInput): "sealed" | "opened" {
  if (typeof input.packetSealed === "boolean") {
    return input.packetSealed ? "sealed" : "opened";
  }
  const outcome = findDeliveryOutcome(input.memory ?? [])?.object;
  if (outcome === "sealed" || outcome === "opened") return outcome;
  return "sealed";
}

function routeListened(routeFact: IoRecognitionMemoryFact | undefined): boolean {
  return routeFact?.object === "done";
}

export function buildIoRecognitionDialogueSnippets(
  input: IoRecognitionDialogueInput,
): IoRecognitionDialogueSnippet[] {
  const memory = input.memory ?? [];
  const deliveryFact = findDeliveryOutcome(memory);
  const routeFact = findRouteAttention(memory);
  const deliveryRef = factId(deliveryFact);
  const routeRef = factId(routeFact);
  const outcome = rememberedOutcome(input);
  const listened = routeListened(routeFact);

  const deepKey = outcome === "sealed"
    ? listened ? "sealedListened" : "sealedSkipped"
    : listened ? "openedListened" : "openedSkipped";

  const deliveryOnlyRefs = deliveryRef ? [deliveryRef] : [];
  const deepSourceIds = [deliveryRef, routeRef].filter(
    (ref): ref is string => ref !== null,
  );

  return [
    {
      id: `io:${input.playerId}:first-meeting`,
      playerId: input.playerId,
      npcId: "io",
      tier: "first-meeting",
      line: FIRST_MEETING_LINE,
      feelCue: FIRST_MEETING_FEEL_CUE,
      memoryRefs: [],
      sourceMemoryIds: [],
    },
    {
      id: `io:${input.playerId}:returning`,
      playerId: input.playerId,
      npcId: "io",
      tier: "returning",
      line: RETURNING_LINES[outcome],
      feelCue: RETURNING_FEEL_CUE,
      memoryRefs: deliveryOnlyRefs,
      sourceMemoryIds: deliveryOnlyRefs,
    },
    {
      id: `io:${input.playerId}:deep-recall`,
      playerId: input.playerId,
      npcId: "io",
      tier: "deep-recall",
      line: DEEP_RECALL_LINES[deepKey],
      feelCue: DEEP_RECALL_FEEL_CUE,
      memoryRefs: deliveryOnlyRefs,
      sourceMemoryIds: deepSourceIds,
    },
  ];
}

/** Every canonical returning line Io may speak at the recognition beat for a
 *  delivery outcome. Copy evolves in this module only. */
export function ioRecognitionLinesFor(outcome: "sealed" | "opened"): readonly string[] {
  return outcome === "sealed"
    ? [RETURNING_LINES.sealed, DEEP_RECALL_LINES.sealedListened]
    : [RETURNING_LINES.opened, DEEP_RECALL_LINES.openedListened];
}

/** The exact line selectIoRecognitionDialogueLine yields for a delivery
 *  outcome + route-attention state. Deep recall requires listening. */
export function expectedIoRecognitionLine(
  outcome: "sealed" | "opened",
  routeListened: boolean,
): string {
  if (routeListened) {
    return outcome === "sealed"
      ? DEEP_RECALL_LINES.sealedListened
      : DEEP_RECALL_LINES.openedListened;
  }
  return RETURNING_LINES[outcome];
}

export function selectIoRecognitionDialogueLine(
  snippets: readonly IoRecognitionDialogueSnippet[],
  input?: { memory?: readonly IoRecognitionMemoryFact[] },
): IoRecognitionDialogueSnippet {
  const routeFact = (input?.memory ?? []).find(
    (fact) => fact.predicate === "kiosk-second-action",
  );
  const listened = routeListened(routeFact);

  const returning = snippets.find((snippet) => snippet.tier === "returning");
  const deepRecall = snippets.find((snippet) => snippet.tier === "deep-recall");

  if (listened && deepRecall) return deepRecall;
  if (returning && returning.memoryRefs.length >= 1) return returning;

  const firstMeeting = snippets.find((snippet) => snippet.tier === "first-meeting");
  if (!firstMeeting) throw new Error("Io recognition dialogue requires a first-meeting snippet");
  return firstMeeting;
}
