export type AftersignMemoryRecord = {
  npcId: string;
  beatId: string;
  sentence: string;
  trust: 'guarded' | 'open' | 'strained';
  updatedAt: string;
};

export type AftersignSaveData = {
  version: 1;
  playerId: string;
  routeId: string;
  packetChoice?: 'return_unopened' | 'open_and_read' | 'deliver_late';
  memories: AftersignMemoryRecord[];
};

export type AftersignMemoryStore = {
  load(playerId: string): AftersignSaveData;
  save(data: AftersignSaveData): void;
  clear(playerId: string): void;
};

const SAVE_PREFIX = 'aftersign:save:';

export function createEmptySave(playerId: string): AftersignSaveData {
  return {
    version: 1,
    playerId,
    routeId: 'kiosk-io-vertical-slice',
    memories: [],
  };
}

export function rememberIoPacketChoice(
  save: AftersignSaveData,
  packetChoice: NonNullable<AftersignSaveData['packetChoice']>,
  now = new Date().toISOString(),
): AftersignSaveData {
  const sentenceByChoice: Record<NonNullable<AftersignSaveData['packetChoice']>, string> = {
    return_unopened: 'You brought the blue packet back unopened.',
    open_and_read: 'You opened the blue packet before you brought it back.',
    deliver_late: 'You delivered the blue packet after the tide bell.',
  };

  const trustByChoice: Record<NonNullable<AftersignSaveData['packetChoice']>, AftersignMemoryRecord['trust']> = {
    return_unopened: 'open',
    open_and_read: 'strained',
    deliver_late: 'guarded',
  };

  const ioMemory: AftersignMemoryRecord = {
    npcId: 'io',
    beatId: 'blue-packet-choice',
    sentence: sentenceByChoice[packetChoice],
    trust: trustByChoice[packetChoice],
    updatedAt: now,
  };

  return {
    ...save,
    packetChoice,
    memories: [
      ...save.memories.filter(
        (memory) => memory.npcId !== ioMemory.npcId || memory.beatId !== ioMemory.beatId,
      ),
      ioMemory,
    ],
  };
}

export function getIoRememberedLine(save: AftersignSaveData): string | null {
  return save.memories.find((memory) => memory.npcId === 'io' && memory.beatId === 'blue-packet-choice')?.sentence ?? null;
}

export function serializeSave(data: AftersignSaveData): string {
  return JSON.stringify(data);
}

export function parseSave(playerId: string, raw: string | null): AftersignSaveData {
  if (!raw) {
    return createEmptySave(playerId);
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AftersignSaveData>;

    if (parsed.version !== 1 || parsed.playerId !== playerId || !Array.isArray(parsed.memories)) {
      return createEmptySave(playerId);
    }

    return {
      version: 1,
      playerId,
      routeId: typeof parsed.routeId === 'string' ? parsed.routeId : 'kiosk-io-vertical-slice',
      packetChoice: isPacketChoice(parsed.packetChoice) ? parsed.packetChoice : undefined,
      memories: parsed.memories.filter(isMemoryRecord),
    };
  } catch {
    return createEmptySave(playerId);
  }
}

export function createBrowserMemoryStore(storage: Storage): AftersignMemoryStore {
  return {
    load(playerId) {
      return parseSave(playerId, storage.getItem(saveKey(playerId)));
    },
    save(data) {
      storage.setItem(saveKey(data.playerId), serializeSave(data));
    },
    clear(playerId) {
      storage.removeItem(saveKey(playerId));
    },
  };
}

function saveKey(playerId: string): string {
  return `${SAVE_PREFIX}${playerId}`;
}

function isPacketChoice(value: unknown): value is NonNullable<AftersignSaveData['packetChoice']> {
  return value === 'return_unopened' || value === 'open_and_read' || value === 'deliver_late';
}

function isMemoryRecord(value: unknown): value is AftersignMemoryRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Partial<AftersignMemoryRecord>;
  return (
    typeof record.npcId === 'string' &&
    typeof record.beatId === 'string' &&
    typeof record.sentence === 'string' &&
    (record.trust === 'guarded' || record.trust === 'open' || record.trust === 'strained') &&
    typeof record.updatedAt === 'string'
  );
}
