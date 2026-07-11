export type FirstPacketOutcome = 'sealed' | 'opened';
export type FirstRouteBehavior = 'listened' | 'skipped';
export type ReturnTone = 'kind' | 'evasive' | 'blunt';

export interface IoMemoryState {
  firstPacketOutcome?: FirstPacketOutcome;
  firstRouteBehavior?: FirstRouteBehavior;
  returnTone?: ReturnTone;
}

export const IO_UI_COPY = {
  newRun: 'Arrive',
  continueRun: 'Return',
  saving: 'Remembering...',
  saved: 'Remembered',
  loading: 'Returning...',
  packetSealed: 'Seal intact',
  packetOpened: 'Seal broken',
} as const;

export const IO_FIRST_SESSION_LINES = {
  arrival: 'You made it above the water. Good. That is the first qualification.',
  packetHandoff: 'Blue packet. Sign box with three moths painted on it.',
  sealWarning: "Keep the seal closed unless you want me to know you didn't.",
  route: 'Left stair, red string, brass bell. If the stair argues with you, trust the bell.',
  deliveredSealed: 'The bell rang. Good. The city prefers evidence to enthusiasm.',
  deliveredOpened: 'No bell. So either the box lied, or you gave it something already spent.',
  openedLedger: 'Curiosity is not a crime. It is an invoice.',
  returnPrompt: 'You come back later. That is where most couriers fail.',
} as const;

export const IO_RETURNING_MEMORY_LINES: Record<FirstPacketOutcome, string> = {
  sealed: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  opened: 'You came back. The seal did not. I can use one of those facts.',
} as const;

export const IO_ROUTE_MEMORY_LINES: Record<FirstRouteBehavior, string> = {
  listened: 'You listened before you ran. Rare habit. Keep it.',
  skipped: 'You found the box anyway. Next time, let me finish saving your life.',
} as const;

export const IO_RETURN_TONE_LINES: Record<ReturnTone, string> = {
  kind: 'Careful. Kindness is still a weight.',
  evasive: 'That answer has rain under it. I can wait.',
  blunt: 'Good. Blunt tools still open doors.',
} as const;

export function getIoReturningMemoryLine(memory: IoMemoryState): string {
  if (!memory.firstPacketOutcome) {
    return 'Back again. Good. Vey is less cruel to repeat witnesses.';
  }

  return IO_RETURNING_MEMORY_LINES[memory.firstPacketOutcome];
}

export function getIoSecondaryMemoryLine(memory: IoMemoryState): string | undefined {
  if (memory.firstRouteBehavior) {
    return IO_ROUTE_MEMORY_LINES[memory.firstRouteBehavior];
  }

  if (memory.returnTone) {
    return IO_RETURN_TONE_LINES[memory.returnTone];
  }

  return undefined;
}
