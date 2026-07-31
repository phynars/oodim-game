export type IoPacketChoice = 'kept-sealed' | 'opened';
export type IoReturnTone = 'kind' | 'evasive' | 'blunt';

export interface IoSliceLine {
  readonly id: string;
  readonly speaker: 'io' | 'system';
  readonly text: string;
}

export interface IoMemoryLine extends IoSliceLine {
  readonly remembers: string;
  readonly requiredChoice: IoPacketChoice;
}

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
} as const satisfies Record<'sealed' | 'opened', IoSliceLine>;

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

export const ioReturningMemoryLines = {
  keptSealed: {
    id: 'io-returning-memory-sealed',
    speaker: 'io',
    text: 'You came back. So did the blue seal, unbroken. Two facts. I can work with two.',
    remembers: 'the courier delivered the first blue packet unopened',
    requiredChoice: 'kept-sealed',
  },
  opened: {
    id: 'io-returning-memory-opened',
    speaker: 'io',
    text: 'You came back. The seal did not. I can use one of those facts.',
    remembers: 'the courier broke the first blue seal before delivery',
    requiredChoice: 'opened',
  },
} as const satisfies Record<'keptSealed' | 'opened', IoMemoryLine>;

export const ioReturnToneLines = {
  kind: {
    id: 'io-return-tone-kind',
    speaker: 'io',
    text: 'Kind answer. Dangerous tool. Keep it sharp.',
  },
  evasive: {
    id: 'io-return-tone-evasive',
    speaker: 'io',
    text: "That wasn't an answer. It was weather. Try again when it clears.",
  },
  blunt: {
    id: 'io-return-tone-blunt',
    speaker: 'io',
    text: 'Blunt, then. Fine. Blunt things still open doors if the hand is steady.',
  },
} as const satisfies Record<IoReturnTone, IoSliceLine>;

export function selectIoReturningMemoryLine(choice: IoPacketChoice): IoMemoryLine {
  return choice === 'kept-sealed' ? ioReturningMemoryLines.keptSealed : ioReturningMemoryLines.opened;
}
