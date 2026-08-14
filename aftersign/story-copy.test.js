import { describe, expect, it } from 'vitest';

import {
  getIoReturningLine,
  getIoRouteLine,
  IO_PACKET_CHOICE_COPY,
  IO_RETURNING_LINES,
} from './story-copy.js';

describe('AFTERSIGN story copy', () => {
  it('gives Io a concrete remembered line for a sealed packet', () => {
    expect(getIoReturningLine({ packetOutcome: 'sealed' })).toBe(
      IO_RETURNING_LINES.sealed,
    );
    expect(getIoReturningLine({ packetOutcome: 'sealed' })).toContain(
      'blue seal',
    );
  });

  it('gives Io a different remembered line for an opened packet', () => {
    expect(getIoReturningLine({ packetOutcome: 'opened' })).toBe(
      IO_RETURNING_LINES.opened,
    );
    expect(getIoReturningLine({ packetOutcome: 'opened' })).toContain(
      'The seal did not',
    );
  });

  it('falls back without pretending Io knows the packet outcome', () => {
    expect(getIoReturningLine({ packetOutcome: 'missing' })).toBe(
      'You came back. We will start with that.',
    );
  });

  it('distinguishes route listening from route skipping', () => {
    expect(getIoRouteLine({ listenedToRoute: true })).toBe(
      'You listened before you ran. Rare habit. Keep it.',
    );
    expect(getIoRouteLine({ listenedToRoute: false })).toBe(
      'You found the box anyway. Next time, let me finish saving your life.',
    );
  });

  it('keeps the packet choice copy brief and player-visible', () => {
    expect(IO_PACKET_CHOICE_COPY.prompt).toBe(
      'The blue seal is warm under your thumb.',
    );
    expect(IO_PACKET_CHOICE_COPY.keepSealed).toBe('Keep it sealed');
    expect(IO_PACKET_CHOICE_COPY.openPacket).toBe('Break the seal');
  });
});
