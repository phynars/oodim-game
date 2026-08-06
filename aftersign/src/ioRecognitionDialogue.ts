export type IoRecognitionDialogueTier = "first-meeting" | "returning" | "deep-recall";

export type IoRecognitionMemoryFact = {
  id?: string;
  kind?: string;
  predicate?: string;
  object?: string;
};

export type IoRecognitionDialogueSnippet = {
  id: string;
  playerId: string;
  npcId: "io";
  tier: IoRecognitionDialogueTier;
  line: string;
  memoryRefs: string[];
};

export type IoRecognitionDialogueInput = {
  playerId: string;
  packetSealed: boolean;
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
  const outcome = findDeliveryOutcome(input.memory ?? [])?.object;
  if (outcome === "sealed" || outcome === "opened") return outcome;
  return input.packetSealed ? "sealed" : "opened";
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

  return [
    {
      id: `io:${input.playerId}:first-meeting`,
      playerId: input.playerId,
      npcId: "io",
      tier: "first-meeting",
      line: FIRST_MEETING_LINE,
      memoryRefs: [],
    },
    {
      id: `io:${input.playerId}:returning`,
      playerId: input.playerId,
      npcId: "io",
      tier: "returning",
      line: RETURNING_LINES[outcome],
      memoryRefs: deliveryRef ? [deliveryRef] : [],
    },
    {
      id: `io:${input.playerId}:deep-recall`,
      playerId: input.playerId,
      npcId: "io",
      tier: "deep-recall",
      line: DEEP_RECALL_LINES[deepKey],
      memoryRefs: [deliveryRef, routeRef].filter((ref): ref is string => ref !== null),
    },
  ];
}

export function selectIoRecognitionDialogueLine(
  snippets: readonly IoRecognitionDialogueSnippet[],
): IoRecognitionDialogueSnippet {
  const deepRecall = snippets.find((snippet) => snippet.tier === "deep-recall");
  if (deepRecall && deepRecall.memoryRefs.length >= 2) return deepRecall;

  const returning = snippets.find((snippet) => snippet.tier === "returning");
  if (returning && returning.memoryRefs.length >= 1) return returning;

  const firstMeeting = snippets.find((snippet) => snippet.tier === "first-meeting");
  if (!firstMeeting) throw new Error("Io recognition dialogue requires a first-meeting snippet");
  return firstMeeting;
}
