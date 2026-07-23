export type AftersignPacketOutcome = 'sealed' | 'opened' | 'withheld' | 'returned';
export type AftersignInstructionOutcome = 'listened' | 'skipped';
export type AftersignReturnTone = 'kind' | 'evasive' | 'blunt';

export type AftersignIoMemoryLine = Readonly<{
  id: string;
  line: string;
  references: ReadonlyArray<'packetOutcome' | 'instructionOutcome' | 'returnTone'>;
}>;

export const AFTERSIGN_IO_FIRST_BRIEFING_LINES = [
  'Night Post keeps the city stitched after dark.',
  'Blue packet. Sealed. Sign box across the stair.',
  'Read the lantern marks. Step where they agree.',
  'Bring me back the fact of what you did.',
] as const;

export const AFTERSIGN_IO_PACKET_MEMORY_LINES: Record<
  AftersignPacketOutcome,
  AftersignIoMemoryLine
> = {
  sealed: {
    id: 'io.packet.sealed',
    line: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
    references: ['packetOutcome'],
  },
  opened: {
    id: 'io.packet.opened',
    line: 'You came back. The seal did not. I can use one of those facts.',
    references: ['packetOutcome'],
  },
  withheld: {
    id: 'io.packet.withheld',
    line: 'You came back without the packet. That is still an answer. Not yet a good one.',
    references: ['packetOutcome'],
  },
  returned: {
    id: 'io.packet.returned',
    line: 'You brought it back instead of choosing for it. Caution is not trust, but it keeps good records.',
    references: ['packetOutcome'],
  },
};

export const AFTERSIGN_IO_INSTRUCTION_MEMORY_LINES: Record<
  AftersignInstructionOutcome,
  AftersignIoMemoryLine
> = {
  listened: {
    id: 'io.instructions.listened',
    line: 'You listened before you ran. Rare habit. Keep it.',
    references: ['instructionOutcome'],
  },
  skipped: {
    id: 'io.instructions.skipped',
    line: 'You found the box anyway. Next time, let me finish saving your life.',
    references: ['instructionOutcome'],
  },
};

export const AFTERSIGN_IO_RETURN_TONE_LINES: Record<
  AftersignReturnTone,
  AftersignIoMemoryLine
> = {
  kind: {
    id: 'io.return.kind',
    line: 'Kind answer. Expensive habit. Vey may bill you for it.',
    references: ['returnTone'],
  },
  evasive: {
    id: 'io.return.evasive',
    line: 'You stepped around the question. Fine. I mark the shape of the step.',
    references: ['returnTone'],
  },
  blunt: {
    id: 'io.return.blunt',
    line: 'Blunt answer. Useful edge. Mind who it cuts.',
    references: ['returnTone'],
  },
};

export type SelectAftersignIoMemoryLineInput = Readonly<{
  packetOutcome?: AftersignPacketOutcome;
  instructionOutcome?: AftersignInstructionOutcome;
  returnTone?: AftersignReturnTone;
}>;

export function selectAftersignIoMemoryLine(
  memory: SelectAftersignIoMemoryLineInput,
): AftersignIoMemoryLine | null {
  if (memory.packetOutcome) {
    return AFTERSIGN_IO_PACKET_MEMORY_LINES[memory.packetOutcome];
  }

  if (memory.instructionOutcome) {
    return AFTERSIGN_IO_INSTRUCTION_MEMORY_LINES[memory.instructionOutcome];
  }

  if (memory.returnTone) {
    return AFTERSIGN_IO_RETURN_TONE_LINES[memory.returnTone];
  }

  return null;
}
