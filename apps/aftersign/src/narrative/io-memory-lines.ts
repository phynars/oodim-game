export type IoPacketOutcome = 'sealed' | 'opened' | 'unknown';
export type IoRouteAttention = 'listened' | 'skipped' | 'unknown';
export type IoReturnTone = 'kind' | 'evasive' | 'blunt' | 'unknown';

export interface IoMemoryRecord {
  hasReturned: boolean;
  packetOutcome: IoPacketOutcome;
  routeAttention: IoRouteAttention;
  returnTone?: IoReturnTone;
  lastSeenBucket?: 'same-night' | 'later' | 'long-absence';
}

// Feel-spec for the returning-lines deck. This is DELIBERATELY not named
// after `io-recognition-beat` — that cue lives in packages/aftersign and has
// a pinned `{ kind: "io-recognition-beat", ... }` shape and consumer. This
// object is the greeting deck's own timing/easing contract, consumed by the
// lines renderer when it plays a returning greeting.
export const IO_RETURNING_LINES_EASING = 'cubic-bezier(.2,.8,.2,1)' as const;

export interface IoReturningLinesFeel {
  pauseBeforeGreetingMs: number;
  eyeLiftPx: number;
  phoneTiltDegrees: number;
  easing: typeof IO_RETURNING_LINES_EASING;
  memoryLineDelayMs: number;
}

export interface IoReturningLines {
  greeting: string;
  packetLine?: string;
  routeLine?: string;
  toneLine?: string;
  returningLinesFeel?: IoReturningLinesFeel;
}

export const IO_RETURNING_LINES_FEEL: IoReturningLinesFeel = {
  pauseBeforeGreetingMs: 180,
  eyeLiftPx: 6,
  phoneTiltDegrees: -4,
  easing: IO_RETURNING_LINES_EASING,
  memoryLineDelayMs: 260,
};

const FIRST_MEETING: IoReturningLines = {
  greeting: 'You made it to the Night Post. Good. We can use people who arrive intact.',
};

export function selectIoReturningLines(memory: IoMemoryRecord): IoReturningLines {
  if (!memory.hasReturned) {
    return FIRST_MEETING;
  }

  return {
    greeting: selectGreeting(memory.lastSeenBucket),
    packetLine: selectPacketLine(memory.packetOutcome),
    routeLine: selectRouteLine(memory.routeAttention),
    toneLine: selectToneLine(memory.returnTone ?? 'unknown'),
    returningLinesFeel: IO_RETURNING_LINES_FEEL,
  };
}

// ----- Playback schedule ---------------------------------------------------
// Turn a returning-lines deck into an ordered sequence of playback steps a
// lines renderer can walk without re-inventing the timing math. This is the
// real consumer of `IoReturningLinesFeel`: every field in the feel-spec
// (pauseBeforeGreetingMs, memoryLineDelayMs, eyeLiftPx, phoneTiltDegrees,
// easing) is read here and shows up in the returned steps. Drifting any of
// those numbers changes the schedule this function produces, so the schedule
// tests break — that's the load-bearing use that pins the feel numbers.

export interface IoReturningLinesPlaybackStep {
  kind: 'greeting' | 'packet' | 'route' | 'tone';
  text: string;
  /** Milliseconds from the start of the beat that this step becomes visible. */
  startAtMs: number;
  /** Visual transform to apply to Io while this step plays. */
  transform: {
    liftPx: number;
    tiltDegrees: number;
    easing: typeof IO_RETURNING_LINES_EASING;
  };
}

/**
 * Compute the ordered playback schedule for a returning-lines deck. Pure and
 * deterministic: consumers (renderers, tests, previewers) get the exact
 * cue-start times and transforms without duplicating the feel math.
 *
 * First-contact decks (no `returningLinesFeel` attached) render as a single
 * greeting step at t=0 with no transform, matching the "direct, unstyled"
 * first-meeting brief.
 */
export function scheduleIoReturningLinesPlayback(
  lines: IoReturningLines,
): IoReturningLinesPlaybackStep[] {
  const feel = lines.returningLinesFeel;
  if (!feel) {
    return [
      {
        kind: 'greeting',
        text: lines.greeting,
        startAtMs: 0,
        transform: { liftPx: 0, tiltDegrees: 0, easing: IO_RETURNING_LINES_EASING },
      },
    ];
  }

  const transform = {
    liftPx: feel.eyeLiftPx,
    tiltDegrees: feel.phoneTiltDegrees,
    easing: feel.easing,
  };

  const steps: IoReturningLinesPlaybackStep[] = [
    {
      kind: 'greeting',
      text: lines.greeting,
      startAtMs: feel.pauseBeforeGreetingMs,
      transform,
    },
  ];

  const memoryLines: ReadonlyArray<{ kind: IoReturningLinesPlaybackStep['kind']; text?: string }> = [
    { kind: 'packet', text: lines.packetLine },
    { kind: 'route', text: lines.routeLine },
    { kind: 'tone', text: lines.toneLine },
  ];

  let memoryIndex = 0;
  for (const line of memoryLines) {
    if (!line.text) {
      continue;
    }
    memoryIndex += 1;
    steps.push({
      kind: line.kind,
      text: line.text,
      startAtMs: feel.pauseBeforeGreetingMs + feel.memoryLineDelayMs * memoryIndex,
      transform,
    });
  }

  return steps;
}

function selectGreeting(lastSeenBucket: IoMemoryRecord['lastSeenBucket']): string {
  if (lastSeenBucket === 'long-absence') {
    return 'Long walk back. Still, you came.';
  }

  if (lastSeenBucket === 'same-night') {
    return 'Back already. The city must be feeling generous.';
  }

  return 'You came back.';
}

function selectPacketLine(packetOutcome: IoPacketOutcome): string | undefined {
  if (packetOutcome === 'sealed') {
    return 'So did the blue seal, unbroken. That gives me two facts to trust.';
  }

  if (packetOutcome === 'opened') {
    return 'The seal did not. I can use one of those facts.';
  }

  return undefined;
}

function selectRouteLine(routeAttention: IoRouteAttention): string | undefined {
  if (routeAttention === 'listened') {
    return 'You listened before you ran. Rare habit. Keep it.';
  }

  if (routeAttention === 'skipped') {
    return 'You found the box anyway. Next time, let me finish saving your life.';
  }

  return undefined;
}

function selectToneLine(returnTone: IoReturnTone): string | undefined {
  if (returnTone === 'kind') {
    return 'Kind answer. Not soft. There is a difference.';
  }

  if (returnTone === 'evasive') {
    return 'You stepped around the question. I marked the footprint.';
  }

  if (returnTone === 'blunt') {
    return 'Blunt works. So does a doorstop. Use either carefully.';
  }

  return undefined;
}
