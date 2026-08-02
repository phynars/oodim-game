import { describe, expect, it } from 'vitest';

import {
  FIRST_PACKET_DELIVERY_ID,
  IO_OPENED_SEAL_LINE,
  authoredIoMemorySentence,
  buildIoAuthoredMemorySentence,
  ioFirstMeetingLines,
  ioPacketInspectionLines,
  ioReturningMemoryLines,
  isIoRecognitionBeatAllowed,
  selectIoRecognitionBeat,
  selectIoReturningLine,
  type IoPacketMemoryOutcome,
  type IoReturnTone,
  type IoRouteAttention,
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

  it('selects the shared broken-seal line for a player who opened the packet', () => {
    const beat = selectIoRecognitionBeat(
      returnedWith({ completedDeliveryIds: ['io-blue-packet'], packetOutcome: 'opened', routeAttention: 'listened' }),
    );

    expect(beat.id).toBe('io-return-blue-seal-broken');
    expect(beat.line).toBe(IO_OPENED_SEAL_LINE);
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

  it.each([
    ['listened', 'io-return-route-listened', 'You listened before you ran. Rare habit. Keep it.'],
    ['skipped', 'io-return-route-skipped', 'You found the box anyway. Next time, let me finish saving your life.'],
  ] as const)('falls back to %s route memory when the packet delivery has not been completed', (routeAttention, id, line) => {
    const beat = selectIoRecognitionBeat(returnedWith({ packetOutcome: 'sealed', routeAttention }));

    expect(beat.id).toBe(id);
    expect(beat.line).toBe(line);
  });

  it.each([
    ['kind', 'io-return-tone-kind', 'Kind answer. Not required. Not wasted.'],
    ['evasive', 'io-return-tone-evasive', 'You dodged the question. Fine. Couriers start with feet, not confessions.'],
    ['blunt', 'io-return-tone-blunt', 'Blunt, then. Saves ink.'],
  ] as const)('falls back to %s return-tone memory after route memory', (returnTone, id, line) => {
    const beat = selectIoRecognitionBeat(
      returnedWith({ routeAttention: 'unknown' as IoRouteAttention, returnTone: returnTone as IoReturnTone }),
    );

    expect(beat.id).toBe(id);
    expect(beat.line).toBe(line);
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

// Migrated from the retired io-slice-copy.test.ts. The slice copy used to live
// in a forked module; it has been folded into io-recognition-beat.ts and these
// assertions now cover the canonical surface — first-meeting lines, packet
// inspection lines, the returning-session guard, and the authored memory
// sentence — directly against it.
describe('Io slice copy (canonical)', () => {
  it('keeps first-meeting lines short enough for a mobile dialogue card', () => {
    expect(ioFirstMeetingLines).toHaveLength(3);

    for (const line of ioFirstMeetingLines) {
      expect(line.text.length).toBeLessThanOrEqual(150);
    }
  });

  it('provides a packet-inspection line for every recorded packet outcome', () => {
    const outcomes: readonly IoPacketMemoryOutcome[] = ['sealed', 'opened', 'withheld', 'returned'];

    for (const outcome of outcomes) {
      const line = ioPacketInspectionLines[outcome];
      expect(line.text.length).toBeGreaterThan(0);
      expect(line.id).toContain(outcome);
    }
  });

  it('does not surface a returning-session line before the first delivery completes', () => {
    expect(selectIoReturningLine(returnedWith({ packetOutcome: 'sealed' }))).toBeUndefined();
    expect(selectIoReturningLine(returnedWith({ packetOutcome: 'opened' }))).toBeUndefined();
  });

  it('surfaces the canonical returning line after the delivery is recorded', () => {
    const completed = { completedDeliveryIds: [FIRST_PACKET_DELIVERY_ID] };

    expect(selectIoReturningLine(returnedWith({ ...completed, packetOutcome: 'sealed' }))).toEqual(
      ioReturningMemoryLines.keptSealed,
    );

    const openedLine = selectIoReturningLine(returnedWith({ ...completed, packetOutcome: 'opened' }));
    expect(openedLine).toEqual(ioReturningMemoryLines.opened);
    // Guard against copy drift: the returning line reuses the recognition beat.
    expect(openedLine?.text).toBe(IO_OPENED_SEAL_LINE);
  });

  it('does not invent a returning-session line for outcomes Io cannot yet greet on', () => {
    const completed = { completedDeliveryIds: [FIRST_PACKET_DELIVERY_ID] };

    expect(selectIoReturningLine(returnedWith({ ...completed, packetOutcome: 'withheld' }))).toBeUndefined();
    expect(selectIoReturningLine(returnedWith({ ...completed, packetOutcome: 'returned' }))).toBeUndefined();
  });

  it('turns each packet outcome into one authored memory sentence for persistence', () => {
    expect(authoredIoMemorySentence({ packetOutcome: 'sealed' })).toBe(
      'You delivered the blue packet with its seal unbroken.',
    );
    expect(authoredIoMemorySentence({ packetOutcome: 'opened' })).toBe(
      'You opened the blue packet before delivery.',
    );
    expect(authoredIoMemorySentence({ packetOutcome: 'withheld' })).toBe(
      'You kept the blue packet instead of delivering it.',
    );
    expect(authoredIoMemorySentence({ packetOutcome: 'returned' })).toBe(
      'You brought the blue packet back to Io.',
    );
  });

  it('returns undefined when there is no packet outcome yet', () => {
    expect(authoredIoMemorySentence({})).toBeUndefined();
  });

  it('prefers a persisted authored sentence over deriving a new one', () => {
    expect(
      authoredIoMemorySentence({
        packetOutcome: 'sealed',
        authoredMemorySentence: 'Io filed this exact sentence last session.',
      }),
    ).toBe('Io filed this exact sentence last session.');
  });
});
