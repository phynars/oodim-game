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
  // Memory ids the SPOKEN line legitimately cites for the harness's
  // `assertNpcReferencesPriorMemory` check. The route-attention id is
  // deliberately excluded per docs/flagship/story-state-contract.md
  // ("its id must not appear in `lastLineMemoryRefs`") — the deep-recall
  // wording DRAWS on the route memory (that's the tier distinction),
  // but the only ref carried into `lastLineMemoryRefs` is the durable
  // delivery-outcome id, regardless of tier.
  memoryRefs: string[];
  // Provenance snippet: which memory facts influenced the LINE choice
  // (as opposed to the citation set above). Consumers that want to
  // show "Io recalls two things" affordances read this, not memoryRefs.
  sourceMemoryIds: string[];
};

export type IoRecognitionDialogueInput = {
  playerId: string;
  // Authoritative outcome signal at the recognition beat — the caller
  // owns this. Optional so pure unit tests can build snippets from
  // memory alone; runtime callers ALWAYS pass it (and the red-polarity
  // wrong-io-line break flips it here to force a line/outcome mismatch).
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
  // packetSealed is the authoritative signal from the caller at the
  // recognition beat — main.js passes `state.packet.sealed` here (or,
  // under the `wrong-io-line` break mode, its deliberate flip). The
  // durable delivery-outcome memory is only consulted as a fallback
  // when the caller did not supply packetSealed (input built without
  // live scene state, e.g. pure unit tests). If we read memory first,
  // the red-polarity break can't flip the line and the harness's
  // wrong-io-line assertion silently passes when it should fail.
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

  // memoryRefs is the CITATION set carried into `lastLineMemoryRefs`
  // — contract-clean, delivery id only. sourceMemoryIds is the wider
  // provenance (delivery + route-attention for deep-recall) that the
  // UI can use to describe "Io recalls two things" without polluting
  // the citation set the harness inspects.
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
      memoryRefs: [],
      sourceMemoryIds: [],
    },
    {
      id: `io:${input.playerId}:returning`,
      playerId: input.playerId,
      npcId: "io",
      tier: "returning",
      line: RETURNING_LINES[outcome],
      memoryRefs: deliveryOnlyRefs,
      sourceMemoryIds: deliveryOnlyRefs,
    },
    {
      id: `io:${input.playerId}:deep-recall`,
      playerId: input.playerId,
      npcId: "io",
      tier: "deep-recall",
      line: DEEP_RECALL_LINES[deepKey],
      memoryRefs: deliveryOnlyRefs,
      sourceMemoryIds: deepSourceIds,
    },
  ];
}

export function selectIoRecognitionDialogueLine(
  snippets: readonly IoRecognitionDialogueSnippet[],
  input?: { memory?: readonly IoRecognitionMemoryFact[] },
): IoRecognitionDialogueSnippet {
  // Deep-recall is gated on a SECOND-ACTION distinction, not on the
  // mere presence of both memory facts. Post-delivery the two facts
  // are always present (the shape is invariant per memoryFacts()), so
  // memoryRefs.length >= 2 was constant — it shadowed the returning
  // tier and broke the contract-required fragment in `lastLine`.
  //
  // The genuine distinction: did the player acknowledge the kiosk's
  // second beat (route-attention `object === "done"`)? If yes, Io
  // recalls twice — the deep-recall tier speaks. Otherwise the
  // returning tier speaks and its line carries the harness fragment.
  const routeFact = (input?.memory ?? []).find(
    (fact) => fact.predicate === "kiosk-second-action",
  );
  const routeListened = routeFact?.object === "done";

  const returning = snippets.find((snippet) => snippet.tier === "returning");
  const deepRecall = snippets.find((snippet) => snippet.tier === "deep-recall");

  if (routeListened && deepRecall) return deepRecall;
  if (returning && returning.memoryRefs.length >= 1) return returning;

  const firstMeeting = snippets.find((snippet) => snippet.tier === "first-meeting");
  if (!firstMeeting) throw new Error("Io recognition dialogue requires a first-meeting snippet");
  return firstMeeting;
}
