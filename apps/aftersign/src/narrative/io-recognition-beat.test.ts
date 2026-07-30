import { describe, expect, it } from 'vitest';

import {
  buildIoAuthoredMemorySentence,
  isIoRecognitionBeatAllowed,
  selectIoRecognitionBeat,
  type IoSliceMemoryRecord,
} from './io-recognition-beat';

const returnedWith = (memory: Partial<IoSliceMemoryRecord>): IoSliceMemoryRecord => ({
  completedDeliveryIds: [],
  ...memory,
});

describe('selectIoRecognitionBeat', () => {
  it('prioritizes the sealed blue-packet memory after the first delivery is complete', () => {
    const beat = selectIoRecognitionBeat(
      returnedWith({ completedDeliveryIds: ['io-blue-packet'], packetOutcome: 'sealed', routeAttention: 'skipped' }),
    );

    expect(beat.id).toBe('io-return-blue-seal-unbroken');
    expect(beat.line).toBe('You came back. So did the blue seal, unbroken. Two facts. I can work with two.');
    expect(beat.remembers).toContain('the player delivered the blue packet unopened');
  });

  it('selects the broken-seal line for a player who opened the packet', () => {
    const beat = selectIoRecognitionBeat(
      returnedWith({ completedDeliveryIds: ['io-blue-packet'], packetOutcome: 'opened', routeAttention: 'listened' }),
    );

    expect(beat.id).toBe('io-return-blue-seal-broken');
    expect(beat.line).toBe('You came back. The seal did not. I can use one of those facts.');
    expect(beat.remembers).toContain('the player opened the blue packet');
  });

  it('covers non-delivery packet outcomes without pretending they were delivered', () => {
    expect(
      selectIoRecognitionBeat(returnedWith({ completedDeliveryIds: ['io-blue-packet'], packetOutcome: 'withheld' })).line,
    ).toBe('You came back without the packet. That is not failure yet. It is inventory.');

    expect(
      selectIoRecognitionBeat(returnedWith({ completedDeliveryIds: ['io-blue-packet'], packetOutcome: 'returned' })).line,
    ).toBe('You brought it back instead of pretending the route was clean. Useful habit.');
  });

  it('falls back to route memory when the packet delivery has not been completed', () => {
    const beat = selectIoRecognitionBeat(returnedWith({ packetOutcome: 'sealed', routeAttention: 'skipped' }));

    expect(beat.id).toBe('io-return-route-skipped');
    expect(beat.line).toBe('You found the box anyway. Next time, let me finish saving your life.');
  });

  it('falls back to return-tone memory after route memory', () => {
    const beat = selectIoRecognitionBeat(returnedWith({ routeAttention: 'unknown', returnTone: 'evasive' }));

    expect(beat.id).toBe('io-return-tone-evasive');
    expect(beat.line).toBe('You dodged the question. Fine. Couriers start with feet, not confessions.');
  });

  it('uses a first-return line when no specific memory is available', () => {
    const beat = selectIoRecognitionBeat(returnedWith({}));

    expect(beat.id).toBe('io-return-first');
    expect(beat.line).toBe('You came back. Good. Vey loses fewer people who do that twice.');
  });
});

describe('isIoRecognitionBeatAllowed', () => {
  it('rejects a line whose required memory does not match the stored action', () => {
    const openedMemory = returnedWith({ completedDeliveryIds: ['io-blue-packet'], packetOutcome: 'opened' });
    const sealedBeat = selectIoRecognitionBeat(
      returnedWith({ completedDeliveryIds: ['io-blue-packet'], packetOutcome: 'sealed' }),
    );

    expect(isIoRecognitionBeatAllowed(sealedBeat, openedMemory)).toBe(false);
  });

  it('accepts a line whose required memory matches the stored action', () => {
    const openedMemory = returnedWith({ completedDeliveryIds: ['io-blue-packet'], packetOutcome: 'opened' });
    const openedBeat = selectIoRecognitionBeat(openedMemory);

    expect(isIoRecognitionBeatAllowed(openedBeat, openedMemory)).toBe(true);
  });
});

describe('buildIoAuthoredMemorySentence', () => {
  it('keeps an authored sentence only when the selected beat is allowed by the same memory', () => {
    expect(
      buildIoAuthoredMemorySentence(
        returnedWith({
          completedDeliveryIds: ['io-blue-packet'],
          packetOutcome: 'sealed',
          authoredMemorySentence: 'the blue seal came back unbroken',
        }),
      ),
    ).toBe('the blue seal came back unbroken');
  });

  it('falls back to the selected beat memory when no authored sentence is stored', () => {
    expect(
      buildIoAuthoredMemorySentence(returnedWith({ completedDeliveryIds: ['io-blue-packet'], packetOutcome: 'opened' })),
    ).toBe('the player opened the blue packet');
  });
});
