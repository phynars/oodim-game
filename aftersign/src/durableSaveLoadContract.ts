export const AFTERSIGN_DURABLE_SAVE_STORAGE_KEY = 'aftersign:durable-save:v1';
export const AFTERSIGN_DURABLE_SAVE_SLOT = 'default';

export type AftersignDurableSaveSnapshot = {
  version: 1;
  slot: typeof AFTERSIGN_DURABLE_SAVE_SLOT;
  revision: number;
  savedAt: string;
  player: {
    id: string;
  };
  npcMemoryFlags: readonly string[];
};

export type AftersignDurableSaveDraft = {
  playerId: string;
  npcMemoryFlags?: readonly string[] | null;
  revision?: number | null;
  savedAt?: string | null;
};

const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) {
    throw new Error(message);
  }
};

const normalizePlayerId = (playerId: string): string => {
  const trimmed = playerId.trim();
  assert(trimmed.length > 0, 'durable save requires a non-empty player id');
  return trimmed;
};

export const normalizeNpcMemoryFlags = (
  flags: readonly string[] | null | undefined,
): readonly string[] => {
  const normalized = new Set<string>();

  for (const flag of flags ?? []) {
    if (typeof flag !== 'string') {
      continue;
    }

    const trimmed = flag.trim();
    if (trimmed.length > 0) {
      normalized.add(trimmed);
    }
  }

  return Object.freeze([...normalized].sort());
};

export const createAftersignDurableSaveSnapshot = ({
  playerId,
  npcMemoryFlags,
  revision,
  savedAt,
}: AftersignDurableSaveDraft): AftersignDurableSaveSnapshot => {
  const safeRevision = Math.max(1, Math.trunc(revision ?? 1));
  const safeSavedAt = savedAt ?? new Date(0).toISOString();

  assert(!Number.isNaN(Date.parse(safeSavedAt)), 'durable save savedAt must be an ISO-compatible timestamp');

  return Object.freeze({
    version: 1,
    slot: AFTERSIGN_DURABLE_SAVE_SLOT,
    revision: safeRevision,
    savedAt: safeSavedAt,
    player: Object.freeze({
      id: normalizePlayerId(playerId),
    }),
    npcMemoryFlags: normalizeNpcMemoryFlags(npcMemoryFlags),
  });
};

export const serializeAftersignDurableSave = (
  snapshot: AftersignDurableSaveSnapshot,
): string => JSON.stringify(snapshot);

const isSaveRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

export const parseAftersignDurableSave = (
  raw: string | null | undefined,
): AftersignDurableSaveSnapshot | null => {
  if (!raw) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isSaveRecord(parsed) || parsed.version !== 1 || parsed.slot !== AFTERSIGN_DURABLE_SAVE_SLOT) {
    return null;
  }

  const player = parsed.player;
  if (!isSaveRecord(player) || typeof player.id !== 'string') {
    return null;
  }

  const revision = typeof parsed.revision === 'number' ? parsed.revision : 1;
  const savedAt = typeof parsed.savedAt === 'string' ? parsed.savedAt : null;
  const flags = Array.isArray(parsed.npcMemoryFlags) ? parsed.npcMemoryFlags : [];

  return createAftersignDurableSaveSnapshot({
    playerId: player.id,
    npcMemoryFlags: flags.filter((flag): flag is string => typeof flag === 'string'),
    revision,
    savedAt,
  });
};

export type AftersignDurableStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const writeAftersignDurableSave = (
  storage: AftersignDurableStorage,
  snapshot: AftersignDurableSaveSnapshot,
): void => {
  storage.setItem(AFTERSIGN_DURABLE_SAVE_STORAGE_KEY, serializeAftersignDurableSave(snapshot));
};

export const readAftersignDurableSave = (
  storage: Pick<Storage, 'getItem'>,
): AftersignDurableSaveSnapshot | null => (
  parseAftersignDurableSave(storage.getItem(AFTERSIGN_DURABLE_SAVE_STORAGE_KEY))
);

const createMemoryStorage = (): AftersignDurableStorage => {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};

export const checkDurableSaveRoundTripsPlayerIdentityAndNpcMemoryFlags = (): void => {
  const storage = createMemoryStorage();
  const saved = createAftersignDurableSaveSnapshot({
    playerId: ' player-mara ',
    npcMemoryFlags: ['io:blue-packet:sealed', ' io:blue-packet:sealed ', 'io:route-attention:done'],
    revision: 2,
    savedAt: '2026-08-15T00:00:00.000Z',
  });

  writeAftersignDurableSave(storage, saved);
  const loaded = readAftersignDurableSave(storage);

  assert(loaded !== null, 'durable save should load after write');
  assert(loaded.player.id === 'player-mara', 'durable save should preserve normalized player identity');
  assert(loaded.revision === 2, 'durable save should preserve revision');
  assert(loaded.npcMemoryFlags.length === 2, 'durable save should dedupe npc memory flags');
  assert(
    loaded.npcMemoryFlags.join('|') === 'io:blue-packet:sealed|io:route-attention:done',
    'durable save should preserve sorted npc memory flags',
  );
};

export const checkDurableSaveRejectsMalformedPayloads = (): void => {
  assert(parseAftersignDurableSave(null) === null, 'missing durable save should parse as null');
  assert(parseAftersignDurableSave('not-json') === null, 'malformed durable save json should parse as null');
  assert(parseAftersignDurableSave('{"version":2}') === null, 'unknown durable save version should parse as null');
};

export const runDurableSaveLoadContractChecks = (): void => {
  checkDurableSaveRoundTripsPlayerIdentityAndNpcMemoryFlags();
  checkDurableSaveRejectsMalformedPayloads();
};
