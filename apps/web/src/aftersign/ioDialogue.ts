export type AftersignPacketOutcome = 'sealed' | 'opened' | 'unknown';

export type AftersignRouteAttention = 'listened' | 'skipped' | 'unknown';

export type AftersignReturnTone = 'kind' | 'evasive' | 'blunt' | 'unknown';

export interface AftersignIoDialogueMemory {
  packetOutcome: AftersignPacketOutcome;
  routeAttention: AftersignRouteAttention;
  returnTone?: AftersignReturnTone;
  returnedAfterClose?: boolean;
}

export interface AftersignIoLine {
  id: string;
  text: string;
  references: string[];
}

const IO_FIRST_MEETING_LINES: AftersignIoLine[] = [
  {
    id: 'io.first.meeting.opening',
    text: 'Night Post is closed to everyone sensible. You look unsensible enough to hire.',
    references: ['first-meeting'],
  },
  {
    id: 'io.first.packet.charge',
    text: 'Blue seal stays closed. Box under the moth sign. Bring me back the part of you that obeyed.',
    references: ['sealed-blue-packet', 'moth-sign-box'],
  },
];

const IO_PACKET_MEMORY_LINES: Record<AftersignPacketOutcome, AftersignIoLine> = {
  sealed: {
    id: 'io.return.packet.sealed',
    text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
    references: ['returned-after-close', 'delivered-blue-packet-sealed'],
  },
  opened: {
    id: 'io.return.packet.opened',
    text: 'You came back. The seal did not. I can use one of those facts.',
    references: ['returned-after-close', 'opened-blue-packet'],
  },
  unknown: {
    id: 'io.return.packet.unknown',
    text: 'You came back with a blank space where a clean answer should be. We can still count that.',
    references: ['returned-after-close', 'missing-packet-outcome'],
  },
};

const IO_ROUTE_MEMORY_LINES: Record<AftersignRouteAttention, AftersignIoLine> = {
  listened: {
    id: 'io.return.route.listened',
    text: 'You listened before you ran. Rare habit. Keep it.',
    references: ['listened-to-route'],
  },
  skipped: {
    id: 'io.return.route.skipped',
    text: 'You found the box anyway. Next time, let me finish saving your life.',
    references: ['skipped-route'],
  },
  unknown: {
    id: 'io.return.route.unknown',
    text: 'You reached the box. How much of that was luck is a number I am still pricing.',
    references: ['unknown-route-attention'],
  },
};

const IO_RETURN_TONE_LINES: Record<AftersignReturnTone, AftersignIoLine> = {
  kind: {
    id: 'io.return.tone.kind',
    text: 'Careful. Kindness gets expensive after midnight.',
    references: ['kind-return-answer'],
  },
  evasive: {
    id: 'io.return.tone.evasive',
    text: 'That answer walked around the room before it came to me.',
    references: ['evasive-return-answer'],
  },
  blunt: {
    id: 'io.return.tone.blunt',
    text: 'Good. A blunt truth is still a tool.',
    references: ['blunt-return-answer'],
  },
  unknown: {
    id: 'io.return.tone.unknown',
    text: 'Silence is an answer. Poorly wrapped, but it carries.',
    references: ['unknown-return-answer'],
  },
};

export function getAftersignIoFirstMeetingLines(): AftersignIoLine[] {
  return IO_FIRST_MEETING_LINES;
}

export function getAftersignIoRecognitionLines(memory: AftersignIoDialogueMemory): AftersignIoLine[] {
  const lines: AftersignIoLine[] = [];

  if (memory.returnedAfterClose) {
    lines.push(IO_PACKET_MEMORY_LINES[memory.packetOutcome]);
  }

  lines.push(IO_ROUTE_MEMORY_LINES[memory.routeAttention]);

  if (memory.returnTone) {
    lines.push(IO_RETURN_TONE_LINES[memory.returnTone]);
  }

  return lines;
}
