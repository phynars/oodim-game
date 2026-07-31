// Tests for Io's authored slice copy. The single source of truth is
// io-recognition-beat.ts — this file used to test a forked module; the fork
// has been folded back into the canonical one, and these assertions now cover
// the new copy (withheld/returned inspection lines, returning-session guard,
// authored memory sentence) directly against it.

import {
  FIRST_PACKET_DELIVERY_ID,
  IO_OPENED_SEAL_LINE,
  authoredIoMemorySentence,
  ioFirstMeetingLines,
  ioPacketInspectionLines,
  ioReturningMemoryLines,
  selectIoReturningLine,
  type IoPacketMemoryOutcome,
  type IoSliceMemoryRecord,
} from './io-recognition-beat';

function memory(overrides: Partial<IoSliceMemoryRecord> = {}): IoSliceMemoryRecord {
  return {
    completedDeliveryIds: [],
    ...overrides,
  };
}

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
    expect(selectIoReturningLine(memory({ packetOutcome: 'sealed' }))).toBeUndefined();
    expect(selectIoReturningLine(memory({ packetOutcome: 'opened' }))).toBeUndefined();
  });

  it('surfaces the canonical returning line after the delivery is recorded', () => {
    const completed = { completedDeliveryIds: [FIRST_PACKET_DELIVERY_ID] };

    expect(selectIoReturningLine(memory({ ...completed, packetOutcome: 'sealed' }))).toEqual(
      ioReturningMemoryLines.keptSealed,
    );

    const openedLine = selectIoReturningLine(memory({ ...completed, packetOutcome: 'opened' }));
    expect(openedLine).toEqual(ioReturningMemoryLines.opened);
    // Guard against copy drift: the returning line reuses the recognition beat.
    expect(openedLine?.text).toBe(IO_OPENED_SEAL_LINE);
  });

  it('does not invent a returning-session line for outcomes Io cannot yet greet on', () => {
    const completed = { completedDeliveryIds: [FIRST_PACKET_DELIVERY_ID] };

    expect(selectIoReturningLine(memory({ ...completed, packetOutcome: 'withheld' }))).toBeUndefined();
    expect(selectIoReturningLine(memory({ ...completed, packetOutcome: 'returned' }))).toBeUndefined();
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
