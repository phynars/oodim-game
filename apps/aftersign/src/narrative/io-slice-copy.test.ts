import { describe, expect, it } from 'vitest';

import {
  ioFirstSessionLines,
  ioMemorySentence,
  ioReturningLine,
  type IoSliceMemory,
} from './io-slice-copy';

describe('Io slice copy', () => {
  it('keeps first-session packet reactions tied to auditable packet outcomes', () => {
    expect(ioFirstSessionLines.sealedReturn).toMatchObject({
      id: 'io.first.sealedReturn',
      remembers: ['packetOutcome:sealed'],
    });
    expect(ioFirstSessionLines.openedReturn).toMatchObject({
      id: 'io.first.openedReturn',
      remembers: ['packetOutcome:opened'],
    });
  });

  it.each<[IoSliceMemory, string, string[]]>([
    [
      { packetOutcome: 'sealed', returnedAfterClose: true },
      'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
      ['packetOutcome:sealed', 'returnedAfterClose'],
    ],
    [
      { packetOutcome: 'opened', returnedAfterClose: true },
      'You came back. The seal did not. I can use one of those facts.',
      ['packetOutcome:opened', 'returnedAfterClose'],
    ],
    [
      { packetOutcome: 'unknown', routeAttention: 'skipped' },
      'You found the box anyway. Next time, let me finish saving your life.',
      ['routeAttention:skipped'],
    ],
    [
      { packetOutcome: 'unknown', routeAttention: 'listened' },
      'You listened before you ran. Rare habit. Keep it.',
      ['routeAttention:listened'],
    ],
  ])('selects a concrete returning line for %#', (memory, text, remembers) => {
    expect(ioReturningLine(memory)).toMatchObject({ text, remembers });
  });

  it.each<[IoSliceMemory, string]>([
    [
      { packetOutcome: 'sealed' },
      'The courier delivered the blue packet with its seal unbroken.',
    ],
    [
      { packetOutcome: 'opened' },
      'The courier opened the blue packet before delivery.',
    ],
    [
      { packetOutcome: 'unknown' },
      'The courier returned to the Night Post, but the packet outcome is not recorded.',
    ],
  ])('writes one auditable memory sentence for %#', (memory, sentence) => {
    expect(ioMemorySentence(memory)).toBe(sentence);
  });

  it('omits returnedAfterClose from remembers when the input memory does not set it', () => {
    expect(ioReturningLine({ packetOutcome: 'sealed' })).toMatchObject({
      id: 'io.return.packetSealed',
      remembers: ['packetOutcome:sealed'],
    });
    expect(ioReturningLine({ packetOutcome: 'opened' })).toMatchObject({
      id: 'io.return.packetOpened',
      remembers: ['packetOutcome:opened'],
    });
  });

  it('falls back to a return line only when no stronger memory beat is available', () => {
    expect(ioReturningLine({ packetOutcome: 'unknown', returnedAfterClose: true })).toMatchObject({
      id: 'io.return.bare',
      text: 'Back again. Good. The city wastes less time on people who return.',
      remembers: ['returnedAfterClose'],
    });
  });

  it('prioritizes packet outcome over softer behavioral memories', () => {
    expect(
      ioReturningLine({
        packetOutcome: 'opened',
        routeAttention: 'listened',
        returnAnswerTone: 'kind',
      }),
    ).toMatchObject({
      id: 'io.return.packetOpened',
      remembers: ['packetOutcome:opened'],
    });
  });
});
