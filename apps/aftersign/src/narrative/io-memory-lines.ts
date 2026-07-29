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

export interface IoRecognitionBeatFeel {
  pauseBeforeGreetingMs: number;
  eyeLiftPx: number;
  phoneTiltDegrees: number;
  easing: 'cubic-bezier(.2,.8,.2,1)';
  memoryLineDelayMs: number;
}

export interface IoReturningLines {
  greeting: string;
  packetLine?: string;
  routeLine?: string;
  toneLine?: string;
  recognitionBeat?: IoRecognitionBeatFeel;
}

export const IO_RECOGNITION_BEAT_FEEL: IoRecognitionBeatFeel = {
  pauseBeforeGreetingMs: 180,
  eyeLiftPx: 6,
  phoneTiltDegrees: -4,
  easing: 'cubic-bezier(.2,.8,.2,1)',
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
    recognitionBeat: IO_RECOGNITION_BEAT_FEEL,
  };
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
