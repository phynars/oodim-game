export type VoiceSeed = {
  character: string;
  posture: string;
  rhythm: string;
  memoryHook: string;
  line: string;
};

export const characterVoiceSeeds: VoiceSeed[] = [
  {
    character: "Iona",
    posture: "calm control masking fear",
    rhythm: "short clauses, then one long reveal",
    memoryHook: "references the first promise the player broke",
    line: "You were early once. I still built the night around it.",
  },
  {
    character: "Rook",
    posture: "protective, suspicious, unexpectedly tender",
    rhythm: "hard start, soft finish",
    memoryHook: "remembers which door the player refused to open",
    line: "You don't owe me bravery. Just don't lie when the lock looks back.",
  },
  {
    character: "Marek",
    posture: "playful cruelty with real curiosity underneath",
    rhythm: "question, jab, confession",
    memoryHook: "remembers the player's chosen name and whether they changed it",
    line: "Names are bets. Yours changed once. I kept the receipt.",
  },
];
