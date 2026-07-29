import { describe, expect, it } from 'vitest';

import {
  IO_RETURNING_LINES_FEEL,
  scheduleIoReturningLinesPlayback,
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

describe('scheduleIoReturningLinesPlayback', () => {
  it('renders first contact as a single unstyled greeting step at t=0', () => {
    const lines = selectIoReturningLines({
      hasReturned: false,
      packetOutcome: 'unknown',
      routeAttention: 'unknown',
    });

    expect(scheduleIoReturningLinesPlayback(lines)).toEqual([
      {
        kind: 'greeting',
        text: 'You made it to the Night Post. Good. We can use people who arrive intact.',
        startAtMs: 0,
        transform: { liftPx: 0, tiltDegrees: 0, easing: 'cubic-bezier(.2,.8,.2,1)' },
      },
    ]);
  });

  it('holds the greeting for the feel-spec pause before the first memory line', () => {
    // Greeting fires at pauseBeforeGreetingMs, packet line at
    // pauseBeforeGreetingMs + memoryLineDelayMs — 180 + 260 = 440ms with
    // the shipped feel numbers. If either feel value drifts, this fails.
    const lines = selectIoReturningLines({
      hasReturned: true,
      packetOutcome: 'sealed',
      routeAttention: 'unknown',
    });

    const steps = scheduleIoReturningLinesPlayback(lines);

    expect(steps.map((s) => ({ kind: s.kind, startAtMs: s.startAtMs }))).toEqual([
      { kind: 'greeting', startAtMs: IO_RETURNING_LINES_FEEL.pauseBeforeGreetingMs },
      {
        kind: 'packet',
        startAtMs:
          IO_RETURNING_LINES_FEEL.pauseBeforeGreetingMs +
          IO_RETURNING_LINES_FEEL.memoryLineDelayMs,
      },
    ]);
    expect(steps[0].startAtMs).toBe(180);
    expect(steps[1].startAtMs).toBe(440);
  });

  it('stacks packet, route, and tone memory lines at successive delay offsets', () => {
    const lines = selectIoReturningLines({
      hasReturned: true,
      packetOutcome: 'sealed',
      routeAttention: 'listened',
      returnTone: 'kind',
      lastSeenBucket: 'later',
    });

    const steps = scheduleIoReturningLinesPlayback(lines);

    expect(steps.map((s) => s.kind)).toEqual(['greeting', 'packet', 'route', 'tone']);
    // 180, 440, 700, 960 — greeting + 3 memory lines at 260ms cadence.
    expect(steps.map((s) => s.startAtMs)).toEqual([180, 440, 700, 960]);
  });

  it('closes the memory-line gaps when packet or route memory is unknown', () => {
    // Only the tone line survives → it must slot into the FIRST memory
    // offset (440ms), not the third — the schedule packs known lines, it
    // does not leave silent holes where the unknown ones would have been.
    const lines = selectIoReturningLines({
      hasReturned: true,
      packetOutcome: 'unknown',
      routeAttention: 'unknown',
      returnTone: 'blunt',
    });

    const steps = scheduleIoReturningLinesPlayback(lines);

    expect(steps.map((s) => ({ kind: s.kind, startAtMs: s.startAtMs }))).toEqual([
      { kind: 'greeting', startAtMs: 180 },
      { kind: 'tone', startAtMs: 440 },
    ]);
  });

  it('carries the feel-spec eye lift, phone tilt, and easing on every returning step', () => {
    // Every returning step must reach the renderer with the same visual
    // transform — a 6px lift, a -4deg tilt, on the shared decel easing.
    // These numbers ARE the recognition beat's feel; if they drift, the
    // renderer cannot honor the pinned contract.
    const lines = selectIoReturningLines({
      hasReturned: true,
      packetOutcome: 'sealed',
      routeAttention: 'listened',
      returnTone: 'kind',
      lastSeenBucket: 'later',
    });

    const steps = scheduleIoReturningLinesPlayback(lines);

    for (const step of steps) {
      expect(step.transform).toEqual({
        liftPx: IO_RETURNING_LINES_FEEL.eyeLiftPx,
        tiltDegrees: IO_RETURNING_LINES_FEEL.phoneTiltDegrees,
        easing: IO_RETURNING_LINES_FEEL.easing,
      });
    }
    // Anchor the pinned numbers once so a silent drift of the constants
    // still fails at least one assertion in this file.
    expect(steps[0].transform).toEqual({
      liftPx: 6,
      tiltDegrees: -4,
      easing: 'cubic-bezier(.2,.8,.2,1)',
    });
  });
});
