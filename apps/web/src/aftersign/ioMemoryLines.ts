export type AftersignPacketOutcome = 'sealed' | 'opened';
export type AftersignInstructionAttention = 'listened' | 'skipped';
export type AftersignReturnReasonTone = 'kind' | 'evasive' | 'blunt';

export interface AftersignIoMemoryContext {
  packetOutcome?: AftersignPacketOutcome;
  instructionAttention?: AftersignInstructionAttention;
  returnReasonTone?: AftersignReturnReasonTone;
  returnedAfterClose?: boolean;
}

export interface AftersignIoMemoryLine {
  id: string;
  text: string;
  references: readonly string[];
}

export const AFTERSIGN_IO_MEMORY_LINES = {
  packetSealed: {
    id: 'io-return-packet-sealed',
    text: 'You came back. So did the blue seal, unbroken. Two facts I can use.',
    references: ['returnedAfterClose', 'packetOutcome:sealed'],
  },
  packetOpened: {
    id: 'io-return-packet-opened',
    text: 'You came back. The seal did not. I can use one of those facts.',
    references: ['returnedAfterClose', 'packetOutcome:opened'],
  },
  listened: {
    id: 'io-route-listened',
    text: 'You listened before you ran. Rare habit. Keep it.',
    references: ['instructionAttention:listened'],
  },
  skipped: {
    id: 'io-route-skipped',
    text: 'You found the box anyway. Next time, let me finish saving your life.',
    references: ['instructionAttention:skipped'],
  },
  kindReturn: {
    id: 'io-return-tone-kind',
    text: 'Kind answer. Dangerous habit. Useful one.',
    references: ['returnReasonTone:kind'],
  },
  evasiveReturn: {
    id: 'io-return-tone-evasive',
    text: 'You dodged the question. Fine. Just do not dodge the work.',
    references: ['returnReasonTone:evasive'],
  },
  bluntReturn: {
    id: 'io-return-tone-blunt',
    text: 'Blunt answer. Saves time. Costs skin.',
    references: ['returnReasonTone:blunt'],
  },
} as const satisfies Record<string, AftersignIoMemoryLine>;

export function chooseAftersignIoReturningLine(
  context: AftersignIoMemoryContext,
): AftersignIoMemoryLine {
  if (context.returnedAfterClose && context.packetOutcome === 'sealed') {
    return AFTERSIGN_IO_MEMORY_LINES.packetSealed;
  }

  if (context.returnedAfterClose && context.packetOutcome === 'opened') {
    return AFTERSIGN_IO_MEMORY_LINES.packetOpened;
  }

  if (context.instructionAttention === 'skipped') {
    return AFTERSIGN_IO_MEMORY_LINES.skipped;
  }

  if (context.instructionAttention === 'listened') {
    return AFTERSIGN_IO_MEMORY_LINES.listened;
  }

  if (context.returnReasonTone === 'kind') {
    return AFTERSIGN_IO_MEMORY_LINES.kindReturn;
  }

  if (context.returnReasonTone === 'evasive') {
    return AFTERSIGN_IO_MEMORY_LINES.evasiveReturn;
  }

  if (context.returnReasonTone === 'blunt') {
    return AFTERSIGN_IO_MEMORY_LINES.bluntReturn;
  }

  return AFTERSIGN_IO_MEMORY_LINES.listened;
}
