// Io's recognition beat — the single spoken LINE Io says when she recognizes
// the returning player. One beat per memory shape, chosen by priority:
// packet outcome (most concrete) → route attention → return tone → default.
//
// BOUNDARY WITH TWO NEIGHBORS (do not fold these together without a plan):
//
//   packages/aftersign/src/ioRecognitionBeat.ts — the CUE PUBLISHER.
//     Owns `playIoRecognitionBeat`, `IoRecognitionBeatCue`, and its own
//     `IoPacketOutcome = "sealed" | "opened"` (only two branches, because
//     the renderer only distinguishes two envelope shapes). That file
//     answers "when does the beat start and which envelope do we play?"
//     — NOT the words.
//
//   apps/aftersign/src/narrative/io-memory-lines.ts — the GREETING DECK.
//     `selectIoReturningLines` returns a multi-part {greeting, packetLine,
//     routeLine, toneLine} shape used when Io re-encounters the player
//     across a broader spread of memory. Overlaps in spirit but not in
//     shape or consumer.
//
//   THIS FILE — the RECOGNITION LINE. Returns a single `IoRecognitionBeat`
//     (id + line + remembered facts + required-memory guard). Used by the
//     cue publisher's renderer when it needs the actual sentence Io speaks
//     at the moment of recognition, and by memory-authoring code that
//     needs a sentence like "the player opened the blue packet" for the
//     ledger. Type is `IoPacketMemoryOutcome` (four branches) — DIFFERENT
//     from the cue's `IoPacketOutcome` on purpose: the line deck knows
//     about withheld/returned outcomes even though the envelope doesn't.

export type IoPacketMemoryOutcome = 'sealed' | 'opened' | 'withheld' | 'returned';

export type IoRouteAttention = 'listened' | 'skipped' | 'unknown';

export type IoReturnTone = 'kind' | 'evasive' | 'blunt' | 'unknown';

export interface IoSliceMemoryRecord {
  readonly completedDeliveryIds: readonly string[];
  readonly packetOutcome?: IoPacketMemoryOutcome;
  readonly routeAttention?: IoRouteAttention;
  readonly returnTone?: IoReturnTone;
  readonly authoredMemorySentence?: string;
  readonly lastSeenBucket?: 'same-night' | 'next-night' | 'later';
}

export interface IoRecognitionBeat {
  readonly id: string;
  readonly line: string;
  readonly remembers: readonly string[];
  readonly requiredMemory: Partial<Pick<IoSliceMemoryRecord, 'packetOutcome' | 'routeAttention' | 'returnTone'>>;
}

const FIRST_PACKET_DELIVERY_ID = 'io-blue-packet';

const SEALED_BEAT: IoRecognitionBeat = {
  id: 'io-return-blue-seal-unbroken',
  line: 'You came back. So did the blue seal, unbroken. Two facts. I can work with two.',
  remembers: ['the player returned', 'the player delivered the blue packet unopened'],
  requiredMemory: { packetOutcome: 'sealed' },
};

const OPENED_BEAT: IoRecognitionBeat = {
  id: 'io-return-blue-seal-broken',
  line: 'You came back. The seal did not. I can use one of those facts.',
  remembers: ['the player returned', 'the player opened the blue packet'],
  requiredMemory: { packetOutcome: 'opened' },
};

const WITHHELD_BEAT: IoRecognitionBeat = {
  id: 'io-return-blue-packet-withheld',
  line: 'You came back without the packet. That is not failure yet. It is inventory.',
  remembers: ['the player returned', 'the player withheld the blue packet'],
  requiredMemory: { packetOutcome: 'withheld' },
};

const RETURNED_BEAT: IoRecognitionBeat = {
  id: 'io-return-blue-packet-returned',
  line: 'You brought it back instead of pretending the route was clean. Useful habit.',
  remembers: ['the player returned', 'the player returned the blue packet to Io'],
  requiredMemory: { packetOutcome: 'returned' },
};

const SKIPPED_ROUTE_BEAT: IoRecognitionBeat = {
  id: 'io-return-route-skipped',
  line: 'You found the box anyway. Next time, let me finish saving your life.',
  remembers: ['the player returned', 'the player left before Io finished the route'],
  requiredMemory: { routeAttention: 'skipped' },
};

const LISTENED_ROUTE_BEAT: IoRecognitionBeat = {
  id: 'io-return-route-listened',
  line: 'You listened before you ran. Rare habit. Keep it.',
  remembers: ['the player returned', 'the player listened to Io’s route instructions'],
  requiredMemory: { routeAttention: 'listened' },
};

const KIND_RETURN_BEAT: IoRecognitionBeat = {
  id: 'io-return-tone-kind',
  line: 'Kind answer. Not required. Not wasted.',
  remembers: ['the player returned', 'the player answered Io kindly'],
  requiredMemory: { returnTone: 'kind' },
};

const EVASIVE_RETURN_BEAT: IoRecognitionBeat = {
  id: 'io-return-tone-evasive',
  line: 'You dodged the question. Fine. Couriers start with feet, not confessions.',
  remembers: ['the player returned', 'the player avoided saying why they came back'],
  requiredMemory: { returnTone: 'evasive' },
};

const BLUNT_RETURN_BEAT: IoRecognitionBeat = {
  id: 'io-return-tone-blunt',
  line: 'Blunt, then. Saves ink.',
  remembers: ['the player returned', 'the player answered Io bluntly'],
  requiredMemory: { returnTone: 'blunt' },
};

const FIRST_RETURN_BEAT: IoRecognitionBeat = {
  id: 'io-return-first',
  line: 'You came back. Good. Vey loses fewer people who do that twice.',
  remembers: ['the player returned'],
  requiredMemory: {},
};

const PACKET_BEATS: Record<IoPacketMemoryOutcome, IoRecognitionBeat> = {
  sealed: SEALED_BEAT,
  opened: OPENED_BEAT,
  withheld: WITHHELD_BEAT,
  returned: RETURNED_BEAT,
};

const ROUTE_BEATS: Record<IoRouteAttention, IoRecognitionBeat | undefined> = {
  listened: LISTENED_ROUTE_BEAT,
  skipped: SKIPPED_ROUTE_BEAT,
  unknown: undefined,
};

const RETURN_TONE_BEATS: Record<IoReturnTone, IoRecognitionBeat | undefined> = {
  kind: KIND_RETURN_BEAT,
  evasive: EVASIVE_RETURN_BEAT,
  blunt: BLUNT_RETURN_BEAT,
  unknown: undefined,
};

export function selectIoRecognitionBeat(memory: IoSliceMemoryRecord): IoRecognitionBeat {
  if (memory.completedDeliveryIds.includes(FIRST_PACKET_DELIVERY_ID) && memory.packetOutcome) {
    return PACKET_BEATS[memory.packetOutcome];
  }

  const routeBeat = memory.routeAttention ? ROUTE_BEATS[memory.routeAttention] : undefined;
  if (routeBeat) {
    return routeBeat;
  }

  const toneBeat = memory.returnTone ? RETURN_TONE_BEATS[memory.returnTone] : undefined;
  if (toneBeat) {
    return toneBeat;
  }

  return FIRST_RETURN_BEAT;
}

export function isIoRecognitionBeatAllowed(beat: IoRecognitionBeat, memory: IoSliceMemoryRecord): boolean {
  return Object.entries(beat.requiredMemory).every(([key, value]) => {
    return memory[key as keyof IoRecognitionBeat['requiredMemory']] === value;
  });
}

export function buildIoAuthoredMemorySentence(memory: IoSliceMemoryRecord): string {
  const beat = selectIoRecognitionBeat(memory);

  if (memory.authoredMemorySentence && isIoRecognitionBeatAllowed(beat, memory)) {
    return memory.authoredMemorySentence;
  }

  return beat.remembers[beat.remembers.length - 1] ?? 'the player returned';
}
