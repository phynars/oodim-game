import { describe, expect, it } from 'vitest';

import {
  IO_RETURNING_LINES_FEEL,
  selectIoReturningLines,
} from './io-memory-lines';

describe('selectIoReturningLines', () => {
  it('keeps first contact direct and usable before any return memory exists', () => {
    expect(
      selectIoReturningLines({
        hasReturned: false,
        packetOutcome: 'unknown',
        routeAttention: 'unknown',
      }),
    ).toEqual({
      greeting: 'You made it to the Night Post. Good. We can use people who arrive intact.',
    });
  });

  it('names the sealed blue packet outcome as a concrete remembered fact', () => {
    expect(
      selectIoReturningLines({
        hasReturned: true,
        packetOutcome: 'sealed',
        routeAttention: 'unknown',
      }).packetLine,
    ).toBe('So did the blue seal, unbroken. That gives me two facts to trust.');
  });

  it('names the opened packet outcome without pretending Io trusts it', () => {
    expect(
      selectIoReturningLines({
        hasReturned: true,
        packetOutcome: 'opened',
        routeAttention: 'unknown',
      }).packetLine,
    ).toBe('The seal did not. I can use one of those facts.');
  });

  it('remembers whether the player listened to the route briefing', () => {
    expect(
      selectIoReturningLines({
        hasReturned: true,
        packetOutcome: 'unknown',
        routeAttention: 'listened',
      }).routeLine,
    ).toBe('You listened before you ran. Rare habit. Keep it.');

    expect(
      selectIoReturningLines({
        hasReturned: true,
        packetOutcome: 'unknown',
        routeAttention: 'skipped',
      }).routeLine,
    ).toBe('You found the box anyway. Next time, let me finish saving your life.');
  });

  it('does not attach the returning-lines feel to the first-contact deck', () => {
    expect(
      selectIoReturningLines({
        hasReturned: false,
        packetOutcome: 'unknown',
        routeAttention: 'unknown',
      }).returningLinesFeel,
    ).toBeUndefined();
  });

  it('locks the returning-lines feel numbers so a renderer cannot drift them silently', () => {
    // These are the measurable acceptance values a lines renderer must
    // honor: 180ms pre-greet pause, 6px eye lift, -4deg phone tilt, a
    // 260ms delay before the memory line, on the shared decel easing.
    // If a future PR wants to change any of them, this test must change
    // in the same diff — that is the whole point of pinning them.
    expect(
      selectIoReturningLines({
        hasReturned: true,
        packetOutcome: 'sealed',
        routeAttention: 'listened',
        returnTone: 'kind',
        lastSeenBucket: 'later',
      }).returningLinesFeel,
    ).toEqual({
      pauseBeforeGreetingMs: 180,
      eyeLiftPx: 6,
      phoneTiltDegrees: -4,
      easing: 'cubic-bezier(.2,.8,.2,1)',
      memoryLineDelayMs: 260,
    });
  });

  it('exports the same feel constant that selectIoReturningLines attaches', () => {
    expect(
      selectIoReturningLines({
        hasReturned: true,
        packetOutcome: 'unknown',
        routeAttention: 'unknown',
      }).returningLinesFeel,
    ).toBe(IO_RETURNING_LINES_FEEL);
  });

  it('keeps optional return-tone memory short and ledger-edged', () => {
    expect(
      selectIoReturningLines({
        hasReturned: true,
        packetOutcome: 'unknown',
        routeAttention: 'unknown',
        returnTone: 'evasive',
      }).toneLine,
    ).toBe('You stepped around the question. I marked the footprint.');
  });
});
