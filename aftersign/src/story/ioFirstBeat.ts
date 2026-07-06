// Io's first-beat voice, wired to the `window.__game` story-state contract.
//
// The reviewer of #429 was right about the sequencing: dialogue that isn't
// tied to a memory ref can't be pinned by the harness. So every returning
// line this module produces travels WITH the memory id(s) it references,
// and the required fragments from docs/flagship/story-state-contract.md are
// baked into the returning-packet lines (they are the assertion target).

export type PacketOutcome =
  | 'unknown'
  | 'sealed'
  | 'opened'
  | 'withheld'
  | 'returned';

export type RouteBehavior = 'listened' | 'skipped';
export type ReturnAnswerTone = 'kind' | 'evasive' | 'blunt' | 'unset';

export type IoMemoryKind =
  | 'delivery-outcome'
  | 'return'
  | 'route-attention'
  | 'answer-tone';

export interface IoMemory {
  id: string;
  kind: IoMemoryKind;
  subject: 'player';
  predicate: string;
  object: string;
  deliveryId?: 'blue-packet';
  sessionId: string;
  source: 'server' | 'local-fallback';
}

export interface IoLine {
  /** The line as Io speaks it. */
  text: string;
  /**
   * The memory ids this line is claiming to remember. Empty for first-session
   * lines that don't reference the past. Non-empty returning lines MUST list
   * every memory id that authorizes the claim they make.
   */
  memoryRefs: string[];
}

/**
 * First-session lines. None of these reference prior memory, so `memoryRefs`
 * is empty by definition — the harness only asserts refs on returning beats.
 */
export const IO_FIRST_SESSION_LINES = {
  arrival: {
    text:
      'You made it before the rain learned your name. Good. Take the blue packet. Do not make it interesting.',
    memoryRefs: [] as string[],
  },
  packetOffered: {
    text:
      'Blue wax, brass hook, no return address. Deliver it whole or deliver it broken — either way I want to know which.',
    memoryRefs: [] as string[],
  },
  packetKeptSealed: {
    text:
      'Seal is clean. Box has it. That is how a city stays standing: one small refusal at a time.',
    memoryRefs: [] as string[],
  },
  packetOpened: {
    text:
      'Wax is broken. So is the easy version of this job. Bring me what is left.',
    memoryRefs: [] as string[],
  },
  routePrompt: {
    text:
      'Lantern with the brass hook. Stair with no third step. Box under the pharmacy saint. Repeat it if you want to live.',
    memoryRefs: [] as string[],
  },
  routeListened: {
    text: 'You listened before you ran. Rare habit. Keep it.',
    memoryRefs: [] as string[],
  },
  routeSkipped: {
    text:
      'You found the box anyway. Next time, let me finish saving your life.',
    memoryRefs: [] as string[],
  },
  returnedKind: {
    text:
      'Kind answer. Expensive habit. I will mark it under assets until Vey proves otherwise.',
    memoryRefs: [] as string[],
  },
  returnedEvasive: {
    text:
      'You stepped around the question. Fine. Couriers need knees more than confessions.',
    memoryRefs: [] as string[],
  },
  returnedBlunt: {
    text: 'Blunt, then. Good. The city wastes enough breath for all of us.',
    memoryRefs: [] as string[],
  },
} as const satisfies Record<string, IoLine>;

/**
 * Stable memory ids for the slice-1 returning branches. The harness pins on
 * these exact strings — see docs/flagship/story-state-contract.md § "Required
 * mappings".
 */
export const IO_MEMORY_ID = {
  bluePacketSealed: 'io-remembers-blue-packet-sealed',
  bluePacketOpened: 'io-remembers-blue-packet-opened',
} as const;

/**
 * Returning-session lines. Each one MUST contain the exact fragment the
 * contract's fragment check looks for, AND must list the memory id it is
 * claiming to remember. Move either half without the other and the harness
 * will fail — which is the point.
 */
export const IO_RETURNING_PACKET_LINES: Record<
  Extract<PacketOutcome, 'sealed' | 'opened'>,
  IoLine
> = {
  sealed: {
    // required fragment: "blue seal, unbroken"
    text:
      'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
    memoryRefs: [IO_MEMORY_ID.bluePacketSealed],
  },
  opened: {
    // required fragment: "The seal did not"
    text: 'You came back. The seal did not. I can use one of those facts.',
    memoryRefs: [IO_MEMORY_ID.bluePacketOpened],
  },
} as const;

/**
 * Build the delivery-outcome memory row that will be mirrored into
 * `window.__game.npcs.io.memories`. `source` is passed through so the harness
 * can distinguish the server-authoritative case from the local-fallback
 * degraded case — the latter must fail the durable proof.
 */
export function buildDeliveryOutcomeMemory(input: {
  outcome: 'sealed' | 'opened';
  sessionId: string;
  source: 'server' | 'local-fallback';
}): IoMemory {
  const { outcome, sessionId, source } = input;
  return {
    id:
      outcome === 'sealed'
        ? IO_MEMORY_ID.bluePacketSealed
        : IO_MEMORY_ID.bluePacketOpened,
    kind: 'delivery-outcome',
    subject: 'player',
    predicate: 'delivered',
    object: outcome === 'sealed' ? 'blue-packet-sealed' : 'blue-packet-opened',
    deliveryId: 'blue-packet',
    sessionId,
    source,
  };
}

/**
 * Pick Io's returning line from her memories. The line and its refs travel
 * together — callers never format the string separately from the id list.
 */
export function ioReturningLine(memories: readonly IoMemory[]): IoLine {
  const deliveryMemory = memories.find(
    (memory) => memory.kind === 'delivery-outcome',
  );

  if (deliveryMemory?.id === IO_MEMORY_ID.bluePacketSealed) {
    return IO_RETURNING_PACKET_LINES.sealed;
  }
  if (deliveryMemory?.id === IO_MEMORY_ID.bluePacketOpened) {
    return IO_RETURNING_PACKET_LINES.opened;
  }

  return {
    text:
      'You came back. That is not nothing. Stand where I can see what the rain changed.',
    memoryRefs: [],
  };
}
