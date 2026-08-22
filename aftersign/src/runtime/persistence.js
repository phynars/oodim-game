export const createStoragePersistence = ({ storage, storageKey }) => {
  const readStored = () => {
    try {
      const raw = storage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const writeStored = (payload) => {
    storage.setItem(storageKey, JSON.stringify(payload));
  };

  return { readStored, writeStored };
};

export const emptySave = () => ({
  slot: "default",
  revision: 0,
  lastPersistedAt: null,
  dirty: false,
  authority: "local-fallback",
  lastLoadProof: { source: null, revision: null, playerId: null },
});

export const buildIoNextJobDurabilityStamp = ({
  beat,
  playerId,
  returnReason,
  revision,
}) => ({
  parked: beat === "io-next-job",
  beat: typeof beat === "string" ? beat : null,
  playerId: typeof playerId === "string" ? playerId : null,
  returnReason: typeof returnReason === "string" ? returnReason : null,
  revision: typeof revision === "number" ? revision : null,
  stampedAt: new Date().toISOString(),
});

// Persistence runtime factory. Returns the three helpers main.js needs
// to snapshot + write live state: `buildPersistPayload` (pure shape),
// `persist` (local-storage write, stamps `lastPersistedAt` AFTER the
// write succeeds), and `persistAuthoritative` (server write, mirrors
// the same post-write stamp discipline).
export const createPersistHelpers = ({
  state,
  slot,
  clone,
  markStateDirty,
  writeStored,
  writeAuthoritativeSave,
}) => {
  const buildPersistPayload = ({ dirty = false } = {}) => ({
    beat: state.scene.beat,
    player: clone(state.player),
    packet: clone(state.packet),
    delivery: clone(state.delivery),
    memory: clone(state.npcs.io.memory),
    npcs: {
      orra: {
        memory: clone(state.npcs.orra.memory),
        lastLine: state.npcs.orra.lastLine,
        lastLineId: state.npcs.orra.lastLineId,
        lastLineMemoryRefs: [...(state.npcs.orra.lastLineMemoryRefs ?? [])],
      },
    },
    save: {
      revision: state.save.revision,
      dirty,
      ioNextJob: buildIoNextJobDurabilityStamp({
        beat: state.scene.beat,
        playerId: state.player.id,
        returnReason: state.player.returnReason,
        revision: state.save.revision,
      }),
    },
  });

  const persist = ({ dirty = false } = {}) => {
    const payload = buildPersistPayload({ dirty });
    payload.save.lastPersistedAt = new Date().toISOString();
    writeStored(payload);
    state.save.lastPersistedAt = payload.save.lastPersistedAt;
    if (state.save.dirty !== dirty) {
      state.save.dirty = dirty;
    }
    markStateDirty();
  };

  const persistAuthoritative = async ({ dirty = false } = {}) => {
    const payload = buildPersistPayload({ dirty });
    payload.save = {
      ...payload.save,
      lastPersistedAt: new Date().toISOString(),
      authority: "server",
    };
    await writeAuthoritativeSave({
      slot,
      playerId: state.player.id,
      payload,
    });
    state.save.authority = "server";
    state.save.lastPersistedAt = payload.save.lastPersistedAt;
    if (state.save.dirty !== dirty) {
      state.save.dirty = dirty;
    }
    markStateDirty();
  };

  return {
    buildPersistPayload,
    persist,
    persistAuthoritative,
  };
};
