export type MemoryCue =
  | 'first-meeting'
  | 'kept-promise'
  | 'broke-promise'
  | 'left-mid-conversation'
  | 'returned-after-absence';

export type RememberingLineInput = {
  npcName: string;
  playerName: string;
  cue: MemoryCue;
};

const cueTemplates: Record<MemoryCue, (playerName: string) => string> = {
  'first-meeting': (playerName) => `We haven’t done this before, ${playerName}. So I’m listening closely.`,
  'kept-promise': (playerName) => `You said you’d come back, ${playerName}. You did. That matters here.`,
  'broke-promise': (playerName) => `You said you’d come back, ${playerName}. You didn’t. I kept the light on anyway.`,
  'left-mid-conversation': (playerName) => `You vanished in the middle of a sentence, ${playerName}. I heard the silence finish it.`,
  'returned-after-absence': (playerName) => `Long time gone, ${playerName}. I remember the shape you left in this room.`,
};

export function buildRememberingLine(input: RememberingLineInput): string {
  const base = cueTemplates[input.cue](input.playerName);
  return `${input.npcName}: ${base}`;
}
