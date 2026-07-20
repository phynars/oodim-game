export type IoFirstMemoryAction = 'arrive' | 'ask-name' | 'tell-name' | 'return';

export interface IoFirstMemoryInput {
  playerId: string;
  playerName?: string;
  rememberedName?: string;
  action: IoFirstMemoryAction;
}

export interface IoFirstMemoryState {
  playerId: string;
  playerName: string | null;
  beat: 'first-arrival' | 'name-offered' | 'return-recognition';
  ioLine: string;
  memoryWrite: { key: 'playerName'; value: string } | null;
}

const cleanName = (name?: string): string | null => {
  const trimmed = name?.trim();
  return trimmed ? trimmed.slice(0, 32) : null;
};

export const resolveIoFirstMemoryBeat = (input: IoFirstMemoryInput): IoFirstMemoryState => {
  const offeredName = cleanName(input.playerName);
  const rememberedName = cleanName(input.rememberedName);

  if (input.action === 'return' && rememberedName) {
    return {
      playerId: input.playerId,
      playerName: rememberedName,
      beat: 'return-recognition',
      ioLine: `You came back, ${rememberedName}. I kept your name where the outage could not reach it.`,
      memoryWrite: null,
    };
  }

  if (input.action === 'tell-name' && offeredName) {
    return {
      playerId: input.playerId,
      playerName: offeredName,
      beat: 'name-offered',
      ioLine: `I hear you, ${offeredName}. If this station forgets everything else, I will remember that.`,
      memoryWrite: { key: 'playerName', value: offeredName },
    };
  }

  return {
    playerId: input.playerId,
    playerName: rememberedName,
    beat: 'first-arrival',
    ioLine: 'The kiosk wakes before you touch it. Io asks what name should survive the outage.',
    memoryWrite: null,
  };
};

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

export const checkIoAsksForNameOnFirstArrival = (): void => {
  const state = resolveIoFirstMemoryBeat({ playerId: 'player-1', action: 'arrive' });

  assert(state.beat === 'first-arrival', 'first arrival should start Io\'s name-memory beat');
  assert(state.memoryWrite === null, 'Io should not write memory before the player offers a name');
  assert(state.ioLine.includes('what name should survive'), 'Io should frame the first beat around durable identity');
};

export const checkIoWritesOfferedName = (): void => {
  const state = resolveIoFirstMemoryBeat({ playerId: 'player-1', playerName: '  Mara  ', action: 'tell-name' });

  assert(state.beat === 'name-offered', 'offering a name should advance the memory beat');
  assert(state.playerName === 'Mara', 'Io should normalize the offered name before saving it');
  assert(state.memoryWrite?.key === 'playerName', 'Io should request a durable playerName memory write');
  assert(state.memoryWrite?.value === 'Mara', 'Io should save the normalized player name');
};

export const checkIoRecognizesReturningPlayer = (): void => {
  const state = resolveIoFirstMemoryBeat({ playerId: 'player-1', rememberedName: 'Mara', action: 'return' });

  assert(state.beat === 'return-recognition', 'returning with memory should trigger recognition');
  assert(state.memoryWrite === null, 'return recognition should read memory, not rewrite it');
  assert(state.ioLine.includes('You came back, Mara'), 'Io should visibly use the remembered name');
};

export const runIoFirstMemoryBeatChecks = (): void => {
  checkIoAsksForNameOnFirstArrival();
  checkIoWritesOfferedName();
  checkIoRecognizesReturningPlayer();
};
