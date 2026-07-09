export type FlagshipStoryBeat = {
  id: string;
  state: 'locked' | 'available' | 'active' | 'complete';
};

export type FlagshipNpcMemory = {
  id: string;
  npcId: string;
  playerId: string;
  summary: string;
  referencedAt?: number;
};

export type FlagshipNpcState = {
  id: string;
  displayName: string;
  trust: number;
  rememberedMemoryIds: string[];
  currentLine?: string;
};

export type FlagshipSaveState = {
  playerId: string;
  revision: number;
  sceneId: string;
  storyFlags: Record<string, boolean | number | string>;
  memories: FlagshipNpcMemory[];
};

export type FlagshipGameState = {
  version: 1;
  sceneId: string;
  player: {
    id: string;
    flags: Record<string, boolean | number | string>;
  };
  story: {
    currentBeatId: string;
    beats: FlagshipStoryBeat[];
  };
  npcs: FlagshipNpcState[];
  save: FlagshipSaveState;
};

export type FlagshipHarnessApi = {
  getState(): FlagshipGameState;
  chooseStoryOption(optionId: string): Promise<void> | void;
  recordNpcMemory(input: Omit<FlagshipNpcMemory, 'id'> & { id?: string }): Promise<FlagshipNpcMemory> | FlagshipNpcMemory;
  forceSave(): Promise<FlagshipSaveState> | FlagshipSaveState;
  loadSave(playerId: string): Promise<FlagshipSaveState> | FlagshipSaveState;
};

type FlagshipWindow = Window & {
  __game?: FlagshipHarnessApi;
};

export function getFlagshipHarness(pageWindow: Window): FlagshipHarnessApi {
  const game = (pageWindow as FlagshipWindow).__game;
  if (!game) {
    throw new Error('Expected window.__game to expose the flagship harness API.');
  }

  if (typeof game.getState !== 'function') {
    throw new Error('Expected window.__game.getState to be a function.');
  }

  return game;
}

export function assertSerializableFlagshipState(state: FlagshipGameState): void {
  const cloned = JSON.parse(JSON.stringify(state)) as FlagshipGameState;

  if (cloned.version !== 1) {
    throw new Error(`Expected flagship harness version 1, got ${String(cloned.version)}.`);
  }

  if (!cloned.sceneId) {
    throw new Error('Expected flagship state to include a sceneId.');
  }

  if (!cloned.player?.id) {
    throw new Error('Expected flagship state to include a durable player id.');
  }

  if (!cloned.story?.currentBeatId) {
    throw new Error('Expected flagship state to include a current story beat id.');
  }

  if (!Array.isArray(cloned.story.beats)) {
    throw new Error('Expected flagship state story.beats to be an array.');
  }

  if (!Array.isArray(cloned.npcs)) {
    throw new Error('Expected flagship state npcs to be an array.');
  }

  if (!cloned.save || cloned.save.playerId !== cloned.player.id) {
    throw new Error('Expected flagship save state to belong to the current player.');
  }
}

export function assertStoryBeatTransition(
  before: FlagshipGameState,
  after: FlagshipGameState,
  expectedBeatId: string,
  expectedFlag: string,
): void {
  if (before.story.currentBeatId === after.story.currentBeatId) {
    throw new Error(`Expected story beat to advance from ${before.story.currentBeatId}.`);
  }

  if (after.story.currentBeatId !== expectedBeatId) {
    throw new Error(`Expected story beat ${expectedBeatId}, got ${after.story.currentBeatId}.`);
  }

  if (after.player.flags[expectedFlag] !== true) {
    throw new Error(`Expected story flag ${expectedFlag} to be true after the beat transition.`);
  }
}

export function assertNpcReferencesPriorMemory(
  state: FlagshipGameState,
  npcId: string,
  memoryId: string,
): void {
  const npc = state.npcs.find((candidate) => candidate.id === npcId);
  if (!npc) {
    throw new Error(`Expected NPC ${npcId} to exist in flagship state.`);
  }

  if (!npc.rememberedMemoryIds.includes(memoryId)) {
    throw new Error(`Expected NPC ${npcId} to remember memory ${memoryId}.`);
  }

  const remembered = state.save.memories.find((memory) => memory.id === memoryId && memory.npcId === npcId);
  if (!remembered) {
    throw new Error(`Expected save state to contain memory ${memoryId} for NPC ${npcId}.`);
  }

  if (!npc.currentLine?.includes(memoryId)) {
    throw new Error(`Expected NPC ${npcId} currentLine to reference prior memory id ${memoryId}.`);
  }
}

export function assertDurableSaveLoaded(
  beforeSave: FlagshipGameState,
  afterLoad: FlagshipGameState,
): void {
  if (afterLoad.save.playerId !== beforeSave.player.id) {
    throw new Error('Expected loaded save to preserve player identity.');
  }

  if (afterLoad.save.revision < beforeSave.save.revision) {
    throw new Error('Expected loaded save revision to be at least the saved revision.');
  }

  if (afterLoad.sceneId !== beforeSave.sceneId) {
    throw new Error(`Expected loaded scene ${beforeSave.sceneId}, got ${afterLoad.sceneId}.`);
  }

  for (const [key, value] of Object.entries(beforeSave.player.flags)) {
    if (afterLoad.player.flags[key] !== value) {
      throw new Error(`Expected loaded player flag ${key} to equal ${String(value)}.`);
    }
  }

  const missingMemory = beforeSave.save.memories.find(
    (memory) => !afterLoad.save.memories.some((loadedMemory) => loadedMemory.id === memory.id),
  );
  if (missingMemory) {
    throw new Error(`Expected loaded save to preserve NPC memory ${missingMemory.id}.`);
  }
}
