import { describe, expect, it } from 'vitest';

import {
  getIoAuditableMemorySentence,
  getIoReturningLine,
  IO_FIRST_SESSION_LINES,
  type IoSliceMemory,
} from './io-slice-copy';

describe('Io slice copy', () => {
  it('returns first-session greeting when Io has no stored memory', () => {
    expect(getIoReturningLine({})).toEqual(IO_FIRST_SESSION_LINES.greeting);
    expect(getIoAuditableMemorySentence({})).toBeNull();
  });

  it('grounds the sealed-packet returning line in the stored packet outcome', () => {
    const memory: IoSliceMemory = {
      packetOutcome: 'sealed',
      returnedAfterClose: true,
      heardRouteInstructions: false,
      returnAnswerTone: 'blunt',
    };

    expect(getIoReturningLine(memory)).toEqual({
      id: 'io.return.packet.sealed',
      text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
      remembers: 'packetOutcome',
    });
    expect(getIoAuditableMemorySentence(memory)).toBe(
      'Io remembers that the player delivered the blue packet with its seal unbroken.',
    );
  });

  it('grounds the opened-packet returning line in the stored packet outcome', () => {
    const memory: IoSliceMemory = {
      packetOutcome: 'opened',
      returnedAfterClose: true,
    };

    expect(getIoReturningLine(memory)).toEqual({
      id: 'io.return.packet.opened',
      text: 'You came back. The seal did not. I can use one of those facts.',
      remembers: 'packetOutcome',
    });
    expect(getIoAuditableMemorySentence(memory)).toBe(
      'Io remembers that the player opened the blue packet before returning.',
    );
  });

  it('falls back to route memory only when packet memory is absent', () => {
    expect(getIoReturningLine({ heardRouteInstructions: true })).toEqual({
      id: 'io.return.route.listened',
      text: 'You listened before you ran. Rare habit. Keep it.',
      remembers: 'heardRouteInstructions',
    });

    expect(getIoReturningLine({ heardRouteInstructions: false })).toEqual({
      id: 'io.return.route.skipped',
      text: 'You found the box anyway. Next time, let me finish saving your life.',
      remembers: 'heardRouteInstructions',
    });
  });

  it('keeps tone memories concrete and auditable', () => {
    expect(getIoReturningLine({ returnAnswerTone: 'evasive' })).toEqual({
      id: 'io.return.tone.evasive',
      text: 'You dodged the question. Fine. Dodging keeps couriers alive until it does not.',
      remembers: 'returnAnswerTone',
    });
    expect(getIoAuditableMemorySentence({ returnAnswerTone: 'evasive' })).toBe(
      'Io remembers that the player gave an evasive answer about why they came back.',
    );
  });
});
