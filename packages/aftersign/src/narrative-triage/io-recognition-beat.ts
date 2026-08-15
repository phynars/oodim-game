// Io's return recognition deck — the single spoken line Io says when she
// recognizes a returning player. One selector owns the words; cue timing lives
// in packages/aftersign/src/ioRecognitionBeat.ts.
//
// This module also owns the rest of Io's vertical-slice authored copy so the
// harness has ONE source of truth for her voice: first meeting, packet
// inspection, delivery return, and the returning-memory selector used by the
// slice surface. Do not fork these lines into a parallel module — if you need
// a new beat, add it here.

// A "packet choice" is the two-outcome slice input: the player either kept the
// blue packet sealed or opened it before delivery. The recognition-beat memory
// (`IoPacketMemoryOutcome`) has more outcomes (`withheld`, `returned`) that
// only apply after the delivery is complete.
export type IoPacketChoice = 'kept-sealed' | 'opened';

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

export interface IoSliceLine {
  readonly id: string;
  readonly speaker: 'io' | 'system';
  readonly text: string;
}

export interface IoMemoryLine extends IoSliceLine {
  readonly remembers: string;
  readonly requiredChoice: IoPacketChoice;
}

export interface IoNextJobBeat extends IoSliceLine {
  readonly jobId: string;
  readonly claimTag: string;
  readonly nextBeat?: string;
}

export const FIRST_PACKET_DELIVERY_ID = 'io-blue-packet';
const PLAYER_RETURNED_MEMORY = 'the player returned';
export const IO_OPENED_SEAL_LINE = 'You came back. The seal did not. I can use one of those facts.';

const makeBeat = (beat: IoRecognitionBeat): IoRecognitionBeat => beat;

const PACKET_BEATS: Record<IoPacketMemoryOutcome, IoRecognitionBeat> = {
  sealed: makeBeat({
    id: 'io-return-blue-seal-unbroken',
    line: 'You came back. So did the blue seal, unbroken. Two facts. I can work with two.',
    remembers: [PLAYER_RETURNED_MEMORY, 'the player delivered the blue packet unopened'],
    requiredMemory: { packetOutcome: 'sealed' },
  }),
  opened: makeBeat({
    id: 'io-return-blue-seal-broken',
    line: IO_OPENED_SEAL_LINE,
    remembers: [PLAYER_RETURNED_MEMORY, 'the player opened the blue packet'],
    requiredMemory: { packetOutcome: 'opened' },
  }),
  withheld: makeBeat({
    id: 'io-return-blue-packet-withheld',
    line: 'You came back without the packet. That is not failure yet. It is inventory.',
    remembers: [PLAYER_RETURNED_MEMORY, 'the player withheld the blue packet'],
    requiredMemory: { packetOutcome: 'withheld' },
  }),
  returned: makeBeat({
    id: 'io-return-blue-packet-returned',
    line: 'You brought it back instead of pretending the route was clean. Useful habit.',
    remembers: [PLAYER_RETURNED_MEMORY, 'the player returned the blue packet to Io'],
    requiredMemory: { packetOutcome: 'returned' },
  }),
};

const ROUTE_BEATS: Record<IoRouteAttention, IoRecognitionBeat | undefined> = {
  listened: makeBeat({
    id: 'io-return-route-listened',
    line: 'You listened before you ran. Rare habit. Keep it.',
    remembers: [PLAYER_RETURNED_MEMORY, 'the player listened to Io’s route instructions'],
    requiredMemory: { routeAttention: 'listened' },
  }),
  skipped: makeBeat({
    id: 'io-return-route-skipped',
    line: 'You found the box anyway. Next time, let me finish saving your life.',
    remembers: [PLAYER_RETURNED_MEMORY, 'the player left before Io finished the route'],
    requiredMemory: { routeAttention: 'skipped' },
  }),
  unknown: undefined,
};

const RETURN_TONE_BEATS: Record<IoReturnTone, IoRecognitionBeat | undefined> = {
  kind: makeBeat({
    id: 'io-return-tone-kind',
    line: 'Kind answer. Not required. Not wasted.',
    remembers: [PLAYER_RETURNED_MEMORY, 'the player answered Io kindly'],
    requiredMemory: { returnTone: 'kind' },
  }),
  evasive: makeBeat({
    id: 'io-return-tone-evasive',
    line: 'You dodged the question. Fine. Couriers start with feet, not confessions.',
    remembers: [PLAYER_RETURNED_MEMORY, 'the player avoided saying why they came back'],
    requiredMemory: { returnTone: 'evasive' },
  }),
  blunt: makeBeat({
    id: 'io-return-tone-blunt',
    line: 'Blunt, then. Saves ink.',
    remembers: [PLAYER_RETURNED_MEMORY, 'the player answered Io bluntly'],
    requiredMemory: { returnTone: 'blunt' },
  }),
  unknown: undefined,
};

const FIRST_RETURN_BEAT: IoRecognitionBeat = {
  id: 'io-return-first',
  line: 'You came back. Good. Vey loses fewer people who do that twice.',
  remembers: [PLAYER_RETURNED_MEMORY],
  requiredMemory: {},
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

  return beat.remembers[beat.remembers.length - 1] ?? PLAYER_RETURNED_MEMORY;
}

// ---------------------------------------------------------------------------
// Vertical-slice authored copy (first meeting → packet inspection → delivery
// return → returning memory). These beats run BEFORE the recognition selector
// above; they exist here so the slice has one source of Io voice.

export const ioFirstMeetingLines = [
  {
    id: 'io-first-meeting-name',
    speaker: 'io',
    text: "You're late. That's all right. The stairs are worse when they like you.",
  },
  {
    id: 'io-first-meeting-packet',
    speaker: 'io',
    text: 'Blue packet. Brass box. No detours you plan to admit to me.',
  },
  {
    id: 'io-first-meeting-route',
    speaker: 'io',
    text: 'Follow the amber signs. Ignore anything pale enough to beg.',
  },
] as const satisfies readonly IoSliceLine[];

export const ioPacketInspectionLines = {
  sealed: {
    id: 'io-packet-sealed-inspection',
    speaker: 'system',
    text: 'The wax is cold. Someone pressed a thumb into it before it hardened.',
  },
  opened: {
    id: 'io-packet-opened-inspection',
    speaker: 'system',
    text: 'The seal gives with a soft crack. Somewhere below, a bell refuses to ring.',
  },
  withheld: {
    id: 'io-packet-withheld-inspection',
    speaker: 'system',
    text: 'The packet stays in your coat. It weighs the same as a small confession.',
  },
  returned: {
    id: 'io-packet-returned-inspection',
    speaker: 'system',
    text: 'The packet comes back to Io’s hand still warm from yours. She does not comment on that.',
  },
} as const satisfies Record<IoPacketMemoryOutcome, IoSliceLine>;

export const ioDeliveryReturnLines = {
  keptSealed: {
    id: 'io-delivery-return-sealed',
    speaker: 'io',
    text: 'Box took it. Seal stayed shut. Good. The city likes a courier who can leave a question breathing.',
  },
  opened: {
    id: 'io-delivery-return-opened',
    speaker: 'io',
    text: 'Box took it. Seal did not survive you. Also useful. Less clean.',
  },
} as const satisfies Record<'keptSealed' | 'opened', IoSliceLine>;

export const ORRA_NAME_DEBT: IoNextJobBeat = {
  id: 'orra-name-debt',
  speaker: 'io',
  jobId: 'orra-name-debt',
  claimTag: 'ORRA-NAME-DEBT',
  text: 'Saint Orra owes somebody a name. Take this claim tag before the debt learns yours.',
};

export const IO_NEXT_JOB_OFFER: IoNextJobBeat = {
  id: 'io-next-job-offer',
  speaker: 'io',
  jobId: ORRA_NAME_DEBT.jobId,
  claimTag: ORRA_NAME_DEBT.claimTag,
  nextBeat: ORRA_NAME_DEBT.id,
  text: 'You handled the blue packet without making me chase you. Next job: Saint Orra, name-debt, claim tag warm enough to bite.',
};

export const ioNextJobBeats = {
  [IO_NEXT_JOB_OFFER.id]: IO_NEXT_JOB_OFFER,
  [ORRA_NAME_DEBT.id]: ORRA_NAME_DEBT,
} as const satisfies Record<string, IoNextJobBeat>;

// Returning-memory lines are the single Io line the slice surface shows on the
// player's SECOND visit. They wrap the corresponding PACKET_BEATS entry so the
// exact recognition line stays in one place — if a beat's text changes above,
// this selector inherits it.
export const ioReturningMemoryLines = {
  keptSealed: {
    id: PACKET_BEATS.sealed.id,
    speaker: 'io',
    text: PACKET_BEATS.sealed.line,
    remembers: 'the courier delivered the first blue packet unopened',
    requiredChoice: 'kept-sealed',
  },
  opened: {
    id: PACKET_BEATS.opened.id,
    speaker: 'io',
    text: PACKET_BEATS.opened.line,
    remembers: 'the courier broke the first blue seal before delivery',
    requiredChoice: 'opened',
  },
} as const satisfies Record<'keptSealed' | 'opened', IoMemoryLine>;

export function selectIoReturningMemoryLine(choice: IoPacketChoice): IoMemoryLine {
  return choice === 'kept-sealed' ? ioReturningMemoryLines.keptSealed : ioReturningMemoryLines.opened;
}

// The persistence layer stores one sentence per Io slice — the single-source
// authored fact the next session can echo. Derived from the recorded packet
// outcome so it never drifts from the beat that produced it.
const AUTHORED_MEMORY_BY_PACKET_OUTCOME: Record<IoPacketMemoryOutcome, string> = {
  sealed: 'You delivered the blue packet with its seal unbroken.',
  opened: 'You opened the blue packet before delivery.',
  withheld: 'You kept the blue packet instead of delivering it.',
  returned: 'You brought the blue packet back to Io.',
};

export function authoredIoMemorySentence(memory: {
  readonly packetOutcome?: IoPacketMemoryOutcome;
  readonly authoredMemorySentence?: string;
}): string | undefined {
  if (memory.authoredMemorySentence) {
    return memory.authoredMemorySentence;
  }

  if (memory.packetOutcome) {
    return AUTHORED_MEMORY_BY_PACKET_OUTCOME[memory.packetOutcome];
  }

  return undefined;
}

// Returning-session line — Io's single line on the SECOND (or later) visit,
// after the first delivery has completed. Guarded on `completedDeliveryIds`
// so a fresh session with no delivery never surfaces a "you came back" line.
export function selectIoReturningLine(
  memory: Pick<IoSliceMemoryRecord, 'completedDeliveryIds' | 'packetOutcome'>,
): IoMemoryLine | undefined {
  if (!memory.completedDeliveryIds.includes(FIRST_PACKET_DELIVERY_ID)) {
    return undefined;
  }

  if (memory.packetOutcome === 'sealed') {
    return ioReturningMemoryLines.keptSealed;
  }

  if (memory.packetOutcome === 'opened') {
    return ioReturningMemoryLines.opened;
  }

  return undefined;
}
