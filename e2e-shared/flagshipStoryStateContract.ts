// Shared flagship story/state harness contract.
//
// This mirrors the AUTHORITATIVE FlagshipGameSurface shape defined in
// docs/flagship/story-state-contract.md. Every field name, enum value,
// and required line fragment below traces to a rule in that document.
// If the doc and this file disagree, the doc wins — update this file
// in the same PR that changes the doc, not later.

export type FlagshipSceneBeat =
  | 'arrival'
  | 'packet-offered'
  | 'packet-choice'
  | 'packet-delivered'
  | 'io-return-recognition'
  | 'return-tone-choice'
  | 'io-next-job';

export type FlagshipDeliveryOutcome =
  | 'unknown'
  | 'sealed'
  | 'opened'
  | 'withheld'
  | 'returned';

export type FlagshipChoiceId =
  | 'keep-sealed'
  | 'open-packet'
  | 'deliver-packet'
  | 'return-to-io'
  | 'choose-return-tone'
  | 'ask-for-next-job';

export type FlagshipAnswerTone = 'kind' | 'evasive' | 'blunt' | 'unset';
export type FlagshipIoTrustPosture = 'untested' | 'trusted-seal' | 'useful-breach';
export type FlagshipIoMemoryKind =
  | 'delivery-outcome'
  | 'return'
  | 'route-attention'
  | 'answer-tone';

export type FlagshipIoMemory = {
  id: string;
  kind: FlagshipIoMemoryKind;
  subject: 'player';
  predicate: string;
  object: string;
  deliveryId?: 'blue-packet';
  sessionId: string;
  source: 'server';
};

export type FlagshipPlayerFlags = {
  io_intro_seen?: boolean;
  io_route_listened?: boolean;
  returned_after_first_session?: boolean;
  answer_tone?: FlagshipAnswerTone;
} & Record<string, boolean | number | string>;

export type FlagshipSave = {
  slot: 'default';
  revision: number;
  lastPersistedAt: string | null;
  dirty: boolean;
  authority: 'server' | 'local-fallback';
  lastLoadProof: {
    source: 'server' | 'local-fallback' | null;
    revision: number | null;
    playerId: string | null;
  };
};

export type FlagshipInput = {
  choose(choiceId: FlagshipChoiceId): Promise<void>;
  advance(): Promise<void>;
  forceSave(): Promise<void>;
  forceReload(options?: { clearLocalState?: boolean }): Promise<void>;
  waitForStoryIdle(): Promise<void>;
};

export type FlagshipGameSurface = {
  version: 1;
  build: { slug: 'aftersign'; mode: 'test' | 'dev' | 'prod' };
  scene: { id: 'io-night-post-kiosk'; act: 'act-1-seal'; beat: FlagshipSceneBeat; ready: boolean };
  player: { id: string; name: string | null; flags: FlagshipPlayerFlags };
  delivery: { id: 'blue-packet'; outcome: FlagshipDeliveryOutcome };
  npcs: {
    io: {
      id: 'io';
      displayName: 'Io Vale';
      present: boolean;
      trustPosture: FlagshipIoTrustPosture;
      memories: FlagshipIoMemory[];
      lastLine: string | null;
      lastLineMemoryRefs: string[];
    };
  };
  save: FlagshipSave;
  input: FlagshipInput;
};

export type FlagshipBreakMode =
  | 'drop-memory'
  | 'wrong-io-line'
  | 'local-only-save'
  | 'orra-io-contamination';

import { ioRecognitionLinesFor } from '../aftersign/src/ioRecognitionDialogue';

export const IO_RETURN_LINES: Record<'sealed' | 'opened', readonly string[]> = {
  sealed: ioRecognitionLinesFor('sealed'),
  opened: ioRecognitionLinesFor('opened'),
};

export const IO_RETURN_MEMORY_ID: Record<'sealed' | 'opened', string> = {
  sealed: 'io-remembers-blue-packet-sealed',
  opened: 'io-remembers-blue-packet-opened',
};

type FlagshipWindow = Window & { __game?: FlagshipGameSurface };

export function getFlagshipSurface(pageWindow: Window): FlagshipGameSurface {
  const game = (pageWindow as FlagshipWindow).__game;
  if (!game) throw new Error('Expected window.__game to expose the flagship harness API.');
  if (game.version !== 1) {
    throw new Error(`Expected window.__game.version === 1, got ${String(game.version)}.`);
  }
  return game;
}

export function assertSerializableFlagshipSurface(surface: FlagshipGameSurface): void {
  const cloned = JSON.parse(JSON.stringify(surface)) as FlagshipGameSurface;
  if (cloned.version !== 1) throw new Error(`Expected flagship surface version 1, got ${String(cloned.version)}.`);
  if (cloned.build?.slug !== 'aftersign') throw new Error(`Expected build.slug 'aftersign', got ${String(cloned.build?.slug)}.`);
  if (cloned.scene?.id !== 'io-night-post-kiosk') throw new Error(`Expected scene.id 'io-night-post-kiosk', got ${String(cloned.scene?.id)}.`);
  if (cloned.scene.act !== 'act-1-seal') throw new Error(`Expected scene.act 'act-1-seal', got ${String(cloned.scene.act)}.`);
  if (typeof cloned.scene.ready !== 'boolean') throw new Error('Expected scene.ready to be a boolean.');
  if (!cloned.player?.id) throw new Error('Expected player.id to be a non-empty durable identity.');
  if (cloned.delivery?.id !== 'blue-packet') throw new Error(`Expected delivery.id 'blue-packet', got ${String(cloned.delivery?.id)}.`);
  if (!cloned.npcs?.io) throw new Error('Expected npcs.io to be present.');
  if (cloned.npcs.io.id !== 'io') throw new Error(`Expected npcs.io.id 'io', got ${String(cloned.npcs.io.id)}.`);
  if (!Array.isArray(cloned.npcs.io.memories)) throw new Error('Expected npcs.io.memories to be an array.');
  if (!Array.isArray(cloned.npcs.io.lastLineMemoryRefs)) throw new Error('Expected npcs.io.lastLineMemoryRefs to be an array.');
  if (!cloned.save) throw new Error('Expected save block to be present.');
  if (cloned.save.slot !== 'default') throw new Error(`Expected save.slot 'default', got ${String(cloned.save.slot)}.`);
  if (typeof cloned.save.revision !== 'number') throw new Error('Expected save.revision to be a number.');
  if (cloned.save.authority !== 'server' && cloned.save.authority !== 'local-fallback') {
    throw new Error(`Expected save.authority in {'server','local-fallback'}, got ${String(cloned.save.authority)}.`);
  }
  if (!cloned.save.lastLoadProof) throw new Error('Expected save.lastLoadProof to be present.');
}

export function assertStoryBeatTransition(
  before: FlagshipGameSurface,
  after: FlagshipGameSurface,
  expectedBeat: FlagshipSceneBeat,
  expectedFlag?: keyof FlagshipPlayerFlags,
): void {
  if (before.scene.beat === after.scene.beat) {
    throw new Error(`Expected scene.beat to advance from '${before.scene.beat}'.`);
  }
  if (after.scene.beat !== expectedBeat) {
    throw new Error(`Expected scene.beat '${expectedBeat}', got '${after.scene.beat}'.`);
  }
  if (expectedFlag !== undefined && after.player.flags[expectedFlag] !== true) {
    throw new Error(`Expected player.flags.${String(expectedFlag)} to be true after beat '${expectedBeat}', got ${String(after.player.flags[expectedFlag])}.`);
  }
}

export function assertNpcReferencesPriorMemory(
  surface: FlagshipGameSurface,
  priorOutcome: 'sealed' | 'opened',
): void {
  const requiredMemoryId = IO_RETURN_MEMORY_ID[priorOutcome];
  const canonicalLines = IO_RETURN_LINES[priorOutcome];
  const io = surface.npcs.io;
  if (!io.lastLineMemoryRefs.includes(requiredMemoryId)) throw new Error(`Expected npcs.io.lastLineMemoryRefs to contain '${requiredMemoryId}' for prior outcome '${priorOutcome}', got [${io.lastLineMemoryRefs.join(', ')}].`);
  const memory = io.memories.find((candidate) => candidate.id === requiredMemoryId);
  if (!memory) throw new Error(`Expected npcs.io.memories to contain memory id '${requiredMemoryId}' for prior outcome '${priorOutcome}'.`);
  if (memory.source !== 'server') throw new Error(`Expected memory '${requiredMemoryId}' source === 'server' (durable), got '${memory.source}'.`);
  if (memory.kind !== 'delivery-outcome') throw new Error(`Expected memory '${requiredMemoryId}' kind === 'delivery-outcome', got '${memory.kind}'.`);
  if (!io.lastLine) throw new Error(`Expected npcs.io.lastLine to be non-null after returning-session recognition (prior outcome '${priorOutcome}').`);
  if (!canonicalLines.includes(io.lastLine)) throw new Error(`Expected npcs.io.lastLine to be one of the canonical recognition lines for prior outcome '${priorOutcome}' (see aftersign/src/ioRecognitionDialogue.ts), got: ${io.lastLine}`);
  if (io.lastLine.includes(requiredMemoryId)) throw new Error(`npcs.io.lastLine must NOT contain the raw memory id '${requiredMemoryId}'. Ids belong in lastLineMemoryRefs; the line should contain the authored fragment.`);
}

export function assertDurableSaveLoaded(beforeSave: FlagshipGameSurface, afterLoad: FlagshipGameSurface): void {
  if (afterLoad.save.authority !== 'server') throw new Error(`Expected save.authority === 'server' after durable reload, got ${String(afterLoad.save.authority)}.`);
  const proof = afterLoad.save.lastLoadProof;
  if (proof.source !== 'server') throw new Error(`Expected save.lastLoadProof.source === 'server' after clearLocalState reload, got ${String(proof.source)}. A local-only save cannot satisfy this after local state is cleared.`);
  if (proof.playerId !== beforeSave.player.id) throw new Error(`Expected save.lastLoadProof.playerId === '${beforeSave.player.id}', got '${String(proof.playerId)}'.`);
  if (proof.revision === null || proof.revision < beforeSave.save.revision) throw new Error(`Expected save.lastLoadProof.revision >= ${beforeSave.save.revision}, got ${String(proof.revision)}.`);
  if (afterLoad.save.dirty !== false) throw new Error(`Expected save.dirty === false after durable reload, got ${String(afterLoad.save.dirty)}.`);
  if (afterLoad.player.id !== beforeSave.player.id) throw new Error(`Expected player.id to survive durable reload ('${beforeSave.player.id}'), got '${afterLoad.player.id}'.`);
  if (afterLoad.scene.id !== beforeSave.scene.id) throw new Error(`Expected scene.id to survive durable reload ('${beforeSave.scene.id}'), got '${afterLoad.scene.id}'.`);
  if (afterLoad.save.revision < beforeSave.save.revision) throw new Error(`Expected save.revision to be >= ${beforeSave.save.revision} after durable reload, got ${afterLoad.save.revision}.`);
  for (const [key, value] of Object.entries(beforeSave.player.flags)) {
    if (afterLoad.player.flags[key] !== value) throw new Error(`Expected player.flags['${key}'] === ${JSON.stringify(value)} to survive durable reload, got ${JSON.stringify(afterLoad.player.flags[key])}.`);
  }
  for (const memory of beforeSave.npcs.io.memories) {
    const loaded = afterLoad.npcs.io.memories.find((candidate) => candidate.id === memory.id);
    if (!loaded) throw new Error(`Expected Io memory '${memory.id}' to survive durable reload; not found in loaded memories.`);
    if (loaded.source !== 'server') throw new Error(`Expected loaded Io memory '${memory.id}' source === 'server' (durable), got '${loaded.source}'.`);
  }
}
