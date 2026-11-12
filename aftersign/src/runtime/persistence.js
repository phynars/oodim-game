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
    try {
      storage.setItem(storageKey, JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
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
  // #2446 — thunk returning the third-NPC red-tag-delivery flag from
  // the slice state in main.js. Optional for backwards-compat with
  // any contract test that constructs the helpers without it; when
  // omitted the field is simply absent from the payload (same
  // byte-for-byte shape as pre-#2446). The field is `undefined` /
  // omitted when the flag is false, mirroring
  // `encodeAftersignDurableSave`'s optional emit.
  getRedTagDeliveredToThirdNpc = () => false,
}) => {
  const buildPersistPayload = ({ dirty = false } = {}) => ({
    beat: state.scene.beat,
    player: clone(state.player),
    packet: clone(state.packet),
    delivery: clone(state.delivery),
    story: {
      endingId: state.story?.endingId ?? null,
      endingCause: state.story?.endingCause ?? null,
      maudBellArchiveEndingId: state.story?.maudBellArchiveEndingId ?? null,
      maudBellArchiveName: state.story?.maudBellArchiveName ?? null,
    },
    memory: clone(state.npcs.io.memory),
    npcs: {
      orra: {
        memory: clone(state.npcs.orra.memory),
        lastLine: state.npcs.orra.lastLine,
        lastLineId: state.npcs.orra.lastLineId,
        lastLineMemoryRefs: [...(state.npcs.orra.lastLineMemoryRefs ?? [])],
      },
    },
    ...(getRedTagDeliveredToThirdNpc() === true
      ? { redTagDeliveredToThirdNpc: true }
      : {}),
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
    const persisted = writeStored(payload);
    if (persisted === false) {
      // A browser storage failure is recoverable: leave the live save
      // dirty so the caller can present a retryable, non-blocking
      // failure state (#2715).
      state.save.dirty = true;
      markStateDirty();
      return false;
    }
    state.save.lastPersistedAt = payload.save.lastPersistedAt;
    if (state.save.dirty !== dirty) {
      state.save.dirty = dirty;
    }
    markStateDirty();
    return true;
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
