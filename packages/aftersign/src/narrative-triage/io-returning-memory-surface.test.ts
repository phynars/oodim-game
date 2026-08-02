import { describe, expect, it } from 'vitest';

import {
  FIRST_PACKET_DELIVERY_ID,
  authoredIoMemorySentence,
  selectIoRecognitionBeat,
  selectIoReturningLine,
  type IoSliceMemoryRecord,
} from './io-recognition-beat';

const returnedWith = (memory: Partial<IoSliceMemoryRecord>): IoSliceMemoryRecord => ({
  completedDeliveryIds: [FIRST_PACKET_DELIVERY_ID],
  ...memory,
});

describe('Io returning-memory surface contract', () => {
  it('does not surface a returning-player line before the first delivery is complete', () => {
    expect(
      selectIoReturningLine({
        completedDeliveryIds: [],
        packetOutcome: 'sealed',
      }),
    ).toBeUndefined();
  });

  it('surfaces the sealed-packet return line from the same beat Io recognizes later', () => {
    const memory = returnedWith({ packetOutcome: 'sealed' });
    const returningLine = selectIoReturningLine(memory);
    const recognitionBeat = selectIoRecognitionBeat(memory);

    expect(returningLine).toMatchObject({
      id: recognitionBeat.id,
      text: recognitionBeat.line,
      requiredChoice: 'kept-sealed',
      remembers: 'the courier delivered the first blue packet unopened',
    });
  });

  it('surfaces the opened-packet return line from the same beat Io recognizes later', () => {
    const memory = returnedWith({ packetOutcome: 'opened' });
    const returningLine = selectIoReturningLine(memory);
    const recognitionBeat = selectIoRecognitionBeat(memory);

    expect(returningLine).toMatchObject({
      id: recognitionBeat.id,
      text: recognitionBeat.line,
      requiredChoice: 'opened',
      remembers: 'the courier broke the first blue seal before delivery',
    });
  });

  it('keeps the authored persistence sentence tied to the stored packet outcome', () => {
    expect(authoredIoMemorySentence({ packetOutcome: 'sealed' })).toBe(
      'You delivered the blue packet with its seal unbroken.',
    );
    expect(authoredIoMemorySentence({ packetOutcome: 'opened' })).toBe(
      'You opened the blue packet before delivery.',
    );
  });
});
